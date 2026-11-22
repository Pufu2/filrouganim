#!/usr/bin/env python3
"""Fabrique le site Fil Roug'Anim dans le dossier _site/.

Usage :
    python3 build.py              # version en ligne (adresses propres : /bafa/paris/)
    python3 build.py --apercu     # version d'aperçu (liens relatifs vers index.html)

Repris du générateur de Jeuphorie (Markdown + Jinja2 + YAML).
Les sessions passées disparaissent toutes seules à chaque fabrication.
"""

import argparse
import collections
import datetime as dt
import hashlib
import html
import json
import math
import os
import posixpath
import re
import shutil
import sys
import urllib.error
import unicodedata
import urllib.parse
import urllib.request
from urllib.parse import quote
from pathlib import Path

import markdown
import yaml
from markupsafe import Markup
from jinja2 import Environment, FileSystemLoader, select_autoescape

RACINE = Path(__file__).resolve().parent
SORTIE = RACINE / "_site"

MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]
MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
FORMULES = {"internat": "Internat", "demi-pension": "Demi-pension", "externat": "Externat", "alternance": "En alternance",
            "apprentissage": "En apprentissage", "distance": "À distance"}
# Budgets proposés dans la recherche, selon le diplôme : seuls ceux qui trient vraiment les sessions sont gardés
BUDGETS = {"BAFA": [300, 350, 400, 450, 500, 600, 700, 800, 1000], "BAFD": [400, 500, 600, 700, 800, 1000, 1200],
           "PSC1": [40, 50, 60, 70, 80, 100], "BSB": [300, 400, 500, 600, 700], "CQP-AP": [1000, 1500, 2000, 3000, 4000],
           "CC-ACM": [500, 1000, 1500, 2000, 3000], "CPJEPS": [1000, 2000, 3000, 4000, 5000, 6000], "BPJEPS": [2000, 3000, 4000, 5000, 6000, 7000, 8000, 10000],
           "DEJEPS": [3000, 5000, 7000, 9000, 12000, 15000], "DESJEPS": [5000, 7000, 9000, 12000, 15000, 20000],
           "": [100, 300, 500, 800, 1000, 3000, 6000, 10000]}
SOURCES = {"catalogue-apprentissage": "Catalogue national de l'apprentissage (Carif-Oref)", "offre-info": "Offre Info (Carif-Oref)",
           "ministere": "Liste officielle des sessions déclarées (bafa-bafd.jeunes.gouv.fr)",
           "foromes": "Calendrier national des formations (ministère, FOROMES)"}


# ---------------------------------------------------------------- lecture

def ville_propre(v):
    """Une même ville écrite de plusieurs façons par les sources : « Paris-75012 », « Lyon-7e-Arrondissement »,
    « Marseille,marseille-2e-Arrondissement » → « Paris 12e », « Lyon 7e », « Marseille 2e »."""
    v = " ".join((v or "").split())
    m = re.match(r"(?i)(paris|lyon|marseille)\b.*?(?:(\d{1,2})(?:e|er|eme|ème)?(?:[- ]arrondissement)?|(?:75|69|13)0?(\d\d))$", v)
    if m:
        n = int(m.group(2) or m.group(3))
        maxi = {"paris": 20, "lyon": 9, "marseille": 16}[m.group(1).lower()]
        if 1 <= n <= maxi:
            return f"{m.group(1).capitalize()} {n}{'er' if n == 1 else 'e'}"
    return v.split(",")[0].strip(" -")  # « Fontaine-lès-Dijon, Bourgogne, France » → « Fontaine-lès-Dijon »


def lire_yaml(chemin):
    with open(chemin, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def lire_markdown(chemin):
    """Renvoie (entête, corps) d'un fichier Markdown avec entête YAML."""
    texte = Path(chemin).read_text(encoding="utf-8")
    if texte.startswith("---"):
        _, entete, corps = texte.split("---", 2)
        return yaml.safe_load(entete) or {}, corps.strip()
    return {}, texte.strip()


def convertir_markdown(texte):
    md = markdown.Markdown(extensions=["extra", "sane_lists", "smarty", "toc"],
                           extension_configs={
                               "smarty": {"substitutions": {
                                   "left-double-quote": "«&nbsp;",
                                   "right-double-quote": "&nbsp;»"}},
                               "toc": {"permalink": False}})
    rendu = md.convert(texte)
    # [[à compléter : ...]] devient une zone surlignée, bien visible
    return re.sub(r"\[\[(.+?)\]\]", r'<mark class="a-completer">\1</mark>', rendu)


# ---------------------------------------------------------------- outils

def en_date(d):
    if d is None or isinstance(d, dt.date):
        return d
    return dt.date.fromisoformat(str(d))


def paragraphes(texte):
    """Texte écrit par une structure depuis son compte : jamais de HTML, seulement des paragraphes."""
    blocs = [b.strip() for b in re.split(r"\n\s*\n", texte.replace("\r", "")) if b.strip()]
    return "".join("<p>" + html.escape(b).replace("\n", "<br>") + "</p>" for b in blocs)


# Libellés partagés avec la page Mon compte (gabarits/compte.html)
TYPES_STRUCTURE = {"accueil-de-loisirs": "Accueil de loisirs", "sejours": "Organisateur de séjours", "accueil-de-jeunes": "Accueil de jeunes",
                   "periscolaire": "Accueil périscolaire", "association": "Association", "collectivite": "Collectivité", "autre": "Structure d'animation"}
# les trois familles de structures (accueil, onglets) : des mots qui se distinguent vraiment
FAMILLES_STRUCTURE = [("periscolaire", "Périscolaire"), ("extrascolaire", "Extrascolaire"), ("sejours", "Séjours")]
FAMILLE_DE = {"periscolaire": "periscolaire", "accueil-de-loisirs": "extrascolaire", "accueil-de-jeunes": "extrascolaire", "sejours": "sejours"}
# ce qu'organise une structure (plusieurs choix possibles) et son statut (version 14 du schéma)
ACCUEILS = {"periscolaire": "Périscolaire", "extrascolaire": "Extrascolaire", "accueil-de-jeunes": "Accueil de jeunes", "sejours": "Séjours",
            "mini-camps": "Mini-camps", "autre": "Autre accueil"}
STATUTS = {"association": "Association", "collectivite": "Collectivité", "entreprise": "Entreprise", "autre": "Autre"}
FAMILLE_ACCUEIL = {"periscolaire": "periscolaire", "extrascolaire": "extrascolaire", "accueil-de-jeunes": "extrascolaire", "sejours": "sejours",
                   "mini-camps": "sejours"}


def familles_structure(st):
    """Les familles (périscolaire, extrascolaire, séjours) d'une structure, séparées par des espaces (filtre de l'annuaire)."""
    f = [FAMILLE_ACCUEIL[a] for a in (st.get("accueils") or []) if a in FAMILLE_ACCUEIL] or [FAMILLE_DE.get(st.get("type"), st.get("type") or "")]
    return " ".join(dict.fromkeys(f))


def nature_structure(st):
    """Ce qu'organise la structure, en mots : « Périscolaire · Extrascolaire », sinon son type."""
    a = [ACCUEILS[x] for x in (st.get("accueils") or []) if x in ACCUEILS and x != "autre"]
    return " · ".join(a[:3]) if a else TYPES_STRUCTURE.get(st.get("type"), "Structure d'animation")


def ages_structure(st):
    """« 3 à 11 ans » (âges libres), sinon None."""
    a, b = st.get("age_min"), st.get("age_max")
    if a is None or b is None:
        return None
    return f"{a} an{'s' if a > 1 else ''}" if a == b else f"{a} à {b} ans"
PUBLICS = {"3-5": "3-5 ans", "6-11": "6-11 ans", "12-14": "12-14 ans", "15-17": "15-17 ans", "handicap": "Enfants en situation de handicap",
           "familles": "Familles", "18-25": "18-25 ans"}
DIPLOMES_PROFIL = {"stagiaire-bafa": "Stagiaire BAFA", "bafa": "BAFA", "stagiaire-bafd": "Stagiaire BAFD", "bafd": "BAFD", "psc1": "PSC1",
                   "surveillant-baignade": "Surveillant de baignade", "cqp-ap": "CQP animateur périscolaire", "cpjeps": "CPJEPS",
                   "bpjeps": "BPJEPS", "dejeps": "DEJEPS", "desjeps": "DESJEPS", "autre": "Autre diplôme"}
RECHERCHE = {"stage-pratique": "Stage pratique BAFA", "ete": "Séjours ou centre l'été", "petites-vacances": "Petites vacances",
             "mercredis": "Mercredis", "periscolaire": "Périscolaire (soirs, midis)", "annee": "Poste à l'année",
             "direction": "Direction ou adjoint", "alternance": "Alternance (BPJEPS, DEJEPS)"}
EXPERIENCES = {"petite-enfance": "Moins de 6 ans", "enfants": "6-11 ans", "ados": "Ados", "handicap": "Enfants en situation de handicap",
               "sejours": "Séjours avec nuitées", "itinerance": "Séjours itinérants, camping", "etranger": "Séjours à l'étranger",
               "periscolaire": "Périscolaire", "direction": "Direction, adjoint", "baignade": "Surveillance de baignade"}
CONTRATS = {"cee": "Contrat d'engagement éducatif", "cdd": "CDD", "cdi": "CDI", "stage-pratique": "Stage pratique BAFA",
            "apprentissage": "Apprentissage", "benevole": "Bénévolat"}

LIMITE_LISTE = 60  # au-delà, une page de liste renvoie vers la recherche pour le reste

# Thèmes des approfondissements du BAFA : chaque organisme écrit le sien, on les range en grandes familles
THEMES_APPRO = [
    ("jeux", "Jeux et grands jeux", r"\bjeux?\b|veillee|escape|enigme"),
    ("petite-enfance", "Petite enfance", r"petite enfance|jeunes enfants|tout.petits|maternel|3.6 ans|moins de 6"),
    ("handicap", "Handicap et accueil inclusif", r"handicap|inclusi"),
    ("activites-manuelles", "Activités manuelles et créativité", r"manuel|creati|bricol|recup|\barts?\b|cuisine|mains"),
    ("sejours", "Séjours de vacances", r"sejour|colo"),
    ("accueil-de-loisirs", "Accueil de loisirs et périscolaire", r"accueils? de loisirs|periscol|alsh|en ville|sa ville"),
    ("expression-spectacle", "Spectacle, expression et musique", r"spectacle|expression|theatre|musique|musical|danse|chant|cirque|conte|clown|culturel|talent"),
    ("sport", "Sport et activités physiques", r"sport|physique|\bvtt\b|velo|escalade|glisse|\bski\b|equestre"),
    ("nature-plein-air", "Nature, mer et plein air", r"\bmer\b|nature|plein air|environnement|\bcamps?\b|montagne|ferme|neige|\bski\b|dehors|nautique|terre"),
    ("multi-activites", "Multi activités", r"multi"),
    ("assistant-sanitaire", "Assistant sanitaire", r"sanitaire"),
    ("6-12-ans", "Les 6-12 ans", r"6.12|6 a 12"),
    ("ados", "Préados et ados", r"\bados?\b|adolescen|preado"),
    ("conflits", "Gestion des conflits", r"conflit|non violente|difficult"),
    ("numerique", "Numérique, médias et sciences", r"numeri|media|video|photo|scien|vlog"),
]


def sans_accents(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()


def sans_cedex(ville):
    return re.sub(r"[\s-]+cedex.*$", "", ville or "", flags=re.I).strip()


def themes_de(theme):
    t = sans_accents(theme)
    return [k for k, _, motif in THEMES_APPRO if re.search(motif, t)]


OUTILS = [("/outils/taux-d-encadrement/", "Taux d'encadrement", "Combien d'animateurs, de diplômés et de stagiaires pour votre accueil."),
          ("/outils/salaire-cee/", "Contrat d'engagement éducatif", "La rémunération minimale et les 80 jours sur 12 mois."),
          ("/outils/mon-parcours-bafa/", "Mon parcours BAFA", "Les dates limites du stage pratique et de l'approfondissement.")]


def date_fr(d, annee=True):
    d = en_date(d)
    jour = "1er" if d.day == 1 else str(d.day)
    return f"{jour} {MOIS[d.month - 1]}" + (f" {d.year}" if annee else "")


def dates_fr(debut, fin):
    """« du 6 au 13 février 2027 », « du 28 décembre 2026 au 3 janvier 2027 »."""
    debut, fin = en_date(debut), en_date(fin)
    if not fin:
        return f"à partir du {date_fr(debut)}"
    if debut.year != fin.year:
        return f"du {date_fr(debut)} au {date_fr(fin)}"
    if debut.month != fin.month:
        return f"du {date_fr(debut, False)} au {date_fr(fin)}"
    jour = "1er" if debut.day == 1 else str(debut.day)
    return f"du {jour} au {date_fr(fin)}"


def euros(n):
    if n is None:
        return ""
    return (f"{n:,.0f}" if float(n).is_integer() else f"{n:,.2f}").replace(",", " ").replace(".", ",") + " €"


def resume(texte, n=158):
    texte = " ".join(str(texte).split())
    if len(texte) <= n:
        return texte
    return texte[:n - 1].rsplit(" ", 1)[0].rstrip(" ,;:.") + "…"


def fichier_de_sortie(url):
    """/bafa/ -> bafa/index.html ; /404.html -> 404.html"""
    if url.endswith("/"):
        return url.lstrip("/") + "index.html"
    return url.lstrip("/")


def faire_lien(depuis, vers, apercu, base=""):
    """Construit un lien. En aperçu, liens relatifs vers les fichiers."""
    if vers.startswith(("http://", "https://", "mailto:", "#")):
        return vers
    ancre = ""
    if "#" in vers:
        vers, ancre = vers.split("#", 1)
        ancre = "#" + ancre
    if not apercu:
        return base.rstrip("/") + vers + ancre
    dossier = posixpath.dirname(fichier_de_sortie(depuis))
    if vers == "/":
        return posixpath.relpath("index.html", dossier or ".") + ancre
    return posixpath.relpath(fichier_de_sortie(vers), dossier or ".") + ancre


def slug(texte):
    """« Saint-Ouen-sur-Seine » -> « saint-ouen-sur-seine »"""
    import unicodedata
    t = unicodedata.normalize("NFD", texte).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


_CARTE = None


def carte_deps(zones, classe="carte-deps"):
    """La carte de France des départements, ceux de « zones » en couleur (SVG en ligne, sans script)."""
    global _CARTE
    if _CARTE is None:
        f = RACINE / "statique" / "carte-departements.json"
        _CARTE = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    if not _CARTE:
        return ""
    z = {str(d) for d in zones or []}
    chemins = "".join(f'<path class="{"on" if code in z else ""}" d="{v["d"]}"><title>{html.escape(v["nom"])} ({code})</title></path>'
                      for code, v in _CARTE["departements"].items())
    return Markup(f'<svg class="{classe}" viewBox="0 0 {_CARTE["largeur"]} {_CARTE["hauteur"]}" role="img" aria-label="Départements : {", ".join(sorted(z))}">{chemins}</svg>')


SEJ_TYPES = {"sejour": ("Séjour", "nuits"), "mini_sejour": ("Mini-séjour", "nuits"), "accueil_vacances": ("Accueil de loisirs (vacances)", "journee"),
             "accueil_mercredis": ("Accueil de loisirs (mercredis)", "journee"), "accueil_periscolaire": ("Périscolaire", "journee")}
SEJ_ENVIES = {"nature": "Nature et animaux", "mer": "Mer et plage", "montagne": "Montagne", "sports": "Sports", "equitation": "Équitation", "nautique": "Sports nautiques",
              "arts": "Arts, cirque et spectacle", "sciences": "Sciences et numérique", "langues": "Langues et étranger", "itinerance": "Itinérance et aventure", "decouverte": "Découverte"}
SEJ_HEBERG = {"centre": "Centre de vacances", "camping": "Camping, sous tente", "gite": "Gîte", "auberge": "Auberge de jeunesse", "famille": "En famille d'accueil", "aucun": "À la journée"}
SEJ_UNITES = {"sejour": "le séjour", "jour": "la journée", "semaine": "la semaine", "quotient": "selon le quotient"}
SEJ_TRANSPORT = {"train": "train", "car": "car", "avion": "avion", "autre": "transport"}


def json_ld(objet):
    """JSON-LD sûr à placer dans une balise <script>."""
    return json.dumps(objet, ensure_ascii=False, indent=1).replace("<", "\\u003c").replace(">", "\\u003e")


# ---------------------------------------------------------------- fabrique

class Site:
    def __init__(self, apercu=False, aujourdhui=None):
        self.apercu = apercu
        self.aujourdhui = aujourdhui or dt.date.today()
        self.config = lire_yaml(RACINE / "config.yml")
        ed = self.config.get("editeur", {})
        self.config["editeur_ok"] = all(not str(v).startswith("[[") for v in ed.values())
        self.donnees = {f.stem: lire_yaml(f) for f in (RACINE / "donnees").glob("*.yml")}
        t = self.donnees["territoire"]
        self.regions = {r["id"]: dict(r, deps=[]) for r in t["regions"]}
        self.departements = {d["code"]: d for d in t["departements"]}
        for d in self.departements.values():
            d["reg"] = self.regions[d["region"]]
            d["reg"]["deps"].append(d)
        self.periodes = [{**p, "debut": en_date(p["debut"]), "fin": en_date(p["fin"]),
                          "zones": {z: {"debut": en_date(v["debut"]), "fin": en_date(v["fin"])} for z, v in p.get("zones", {}).items()}}
                         for p in t["periodes"]]
        self.types = t["types"]
        self.diplomes = {d["id"]: d for d in t["diplomes"]}
        # spécialités (mentions) des diplômes professionnels : {"BPJEPS": {"asec": {...}}}
        self.specialites = {di: {sp["id"]: sp for sp in liste} for di, liste in self.donnees.get("specialites", {}).items()}
        self.organismes = {o["id"]: o for o in self.donnees["organismes"]["organismes"]}
        # formule partenaire : active tant que « partenaire_jusqu » n'est pas passé
        for o in self.organismes.values():
            fin = en_date(o.get("partenaire_jusqu")) if o.get("partenaire_jusqu") else None
            o["partenaire"] = bool(o.get("partenaire")) and (fin is None or fin >= self.aujourdhui)
        # les organismes partenaires inscrits sur le site (comptes vérifiés, départements payés) : leur fiche et leurs zones
        for x in self.lire_supabase("rpc/partenaires_publics", "organismes partenaires") or []:
            o = self.organismes.get(x.get("organisme_id"))
            if not o:
                continue
            for k in ("inscription", "habilitation"):
                if x.get(k) and not o.get(k):
                    o[k] = x[k]
            if x.get("presentation"):
                o["presentation_partenaire"] = x["presentation"]
            if x.get("zones"):
                o["partenaire"], o["zones"] = True, list(x["zones"])
                o["partenaire_jusqu"] = x.get("fin")
        # les partenaires de chaque département (un, ou deux dans les plus grands départements)
        self.zone_partenaire = {}
        for o in self.organismes.values():
            for d in (o.get("zones") or []) if o["partenaire"] else []:
                d = str(d).zfill(2) if str(d).isdigit() else str(d)
                self.zone_partenaire.setdefault(d, [])
                if o not in self.zone_partenaire[d]:
                    self.zone_partenaire[d].append(o)
        self.geo = (self.donnees.get("geo-communes") or {}).get("communes") or {}
        # centre de chaque département (moyenne de ses communes connues) : cartes des fiches, jamais une adresse
        _somme = {}
        for _cle, _g in self.geo.items():
            if _g:
                _t = _somme.setdefault(_cle.split("|")[0], [0.0, 0.0, 0])
                _t[0] += _g[0]; _t[1] += _g[1]; _t[2] += 1
        self.centres_dep = {d: [round(t[0] / t[2], 4), round(t[1] / t[2], 4)] for d, t in _somme.items()}
        self.sessions = self.charger_sessions()
        self.stats = self.calculer_stats()
        self.filtres = self.calculer_filtres()
        self.stats["villes"] = self.villes_populaires()
        self.faq = self.donnees.get("faq", {}).get("questions", [])
        self.offres = self.charger_offres()
        self.env = Environment(loader=FileSystemLoader(RACINE / "gabarits"),
                               autoescape=select_autoescape(["html", "xml"]),
                               trim_blocks=True, lstrip_blocks=True)
        self.env.filters.update(date_fr=date_fr, euros=euros, resume=resume,
                                majuscule=lambda t: t[:1].upper() + t[1:] if t else t,
                                mois_court=lambda d: MOIS_COURTS[en_date(d).month - 1],
                                markdown=convertir_markdown, paragraphes=paragraphes,
                                milliers=lambda n: f"{int(n or 0):,}".replace(",", "\u202f"))
        self.env.globals.update(AIDES={k: v for k, v in (self.donnees.get('aides') or {}).items() if k != 'regles'}, AIDES_REGLES=(self.donnees.get('aides') or {}).get('regles') or {}, SEJ_TYPES=SEJ_TYPES, SEJ_ENVIES=SEJ_ENVIES, SEJ_HEBERG=SEJ_HEBERG, SEJ_UNITES=SEJ_UNITES, SEJ_TRANSPORT=SEJ_TRANSPORT, EXEMPLES=self.donnees.get("exemples") or {}, CENTRES_DEP=self.centres_dep, DIPLOMES_PROFIL_NOMS=DIPLOMES_PROFIL, dates_fr=dates_fr, FORMULES=FORMULES, OUTILS=OUTILS, TYPES_STRUCTURE=TYPES_STRUCTURE, FAMILLES_STRUCTURE=FAMILLES_STRUCTURE, FAMILLE_DE=FAMILLE_DE,
                                PUBLICS=PUBLICS, ACCUEILS_ST=list(ACCUEILS.items()), STATUTS=STATUTS, familles_structure=familles_structure, nature_structure=nature_structure, ages_structure=ages_structure, DIPLOMES_PROFIL=DIPLOMES_PROFIL, RECHERCHE=RECHERCHE, EXPERIENCES=EXPERIENCES, CONTRATS=CONTRATS,
                                mois_nom=lambda m: f"{MOIS[int(m[5:7]) - 1]} {m[:4]}", carte_deps=carte_deps)
        self.pages = []

    # -- sessions
    def periode_de(self, jour, dep):
        """Les vacances qui contiennent ce jour, aux dates de la zone (A, B, C) du département."""
        for p in self.periodes:
            z = p["zones"].get(dep["zone"], p)
            if z["debut"] <= jour <= z["fin"]:
                return p
        return None

    def dates_vacances(self, p, dep=None):
        """« du 13 février au 1er mars 2027 » pour la zone du département, ou les trois zones."""
        if not p["zones"]:
            return dates_fr(p["debut"], p["fin"])
        if dep:
            z = p["zones"][dep["zone"]]
            return dates_fr(z["debut"], z["fin"]) + f" (zone {dep['zone']})"
        return " ; ".join(f"zone {k} : {dates_fr(v['debut'], v['fin'])}" for k, v in sorted(p["zones"].items()))

    def charger_sessions(self):
        sessions, ids = [], set()
        # sessions.yml : relevées sur les pages des organismes ; sessions-pro.yml : diplômes professionnels
        # de toutes les écoles (outils/relever_pro.py), dont l'école n'a pas forcément de fiche (organisme_nom)
        toutes = self.donnees["sessions"]["sessions"] + (self.donnees.get("sessions-pro", {}).get("sessions") or [])
        for s in toutes:
            s = dict(s)
            if s["id"] in ids:
                sys.exit(f"Identifiant de session en double : {s['id']}")
            ids.add(s["id"])
            if s["organisme"] not in self.organismes and not (s["organisme"] is None and s.get("organisme_nom")):
                sys.exit(f"Organisme inconnu dans la session {s['id']} : {s['organisme']}")
            if s.get("specialite") and s["specialite"] not in self.specialites.get(s["diplome"], {}):
                sys.exit(f"Spécialité inconnue dans la session {s['id']} : {s['diplome']} {s['specialite']}")
            if s["departement"] not in self.departements:
                sys.exit(f"Département inconnu dans la session {s['id']} : {s['departement']}")
            s["debut"], s["fin"] = en_date(s["debut"]), en_date(s.get("fin"))
            s["releve_le"], s["verifie_le"] = en_date(s.get("releve_le")), en_date(s.get("verifie_le"))
            if (s["fin"] or s["debut"]) < self.aujourdhui:
                continue  # session passée : elle disparaît du site
            s["org"] = self.organismes.get(s["organisme"]) or {"id": None, "nom": s["organisme_nom"], "site": s["url"], "en_ligne": False}
            # la clé de l'organisme pour compter les clics vers lui (son identifiant, ou son nom simplifié)
            s["org_cle"] = (s["org"]["id"] or ("x-" + slug(s["org"]["nom"] or "inconnu")))[:80]
            s["sp"] = self.specialites.get(s["diplome"], {}).get(s.get("specialite"))
            s["source_nom"] = SOURCES.get(s.get("source"))
            s["ville"] = ville_propre(s["ville"])
            s["dep"] = self.departements[s["departement"]]
            s["periode"] = self.periode_de(s["debut"], s["dep"])
            s["type_nom"] = {"formation-generale": "Formation générale", "approfondissement": "Approfondissement",
                             "qualification": "Qualification", "perfectionnement": "Perfectionnement",
                             "parcours": "Formation complète", "session": "Session"}[s["type"]]
            if s["diplome"] == "BAFA" and s["type"] == "qualification":
                s["diplome"] = "BSB"  # la qualification surveillant de baignade : une formation à part sur le site
            s["dipl"] = self.diplomes[s["diplome"]]
            s["mois"] = s["debut"].strftime("%Y-%m")
            sessions.append(s)
        # Classement (expliqué sur /classement-des-sessions/) : date de début, puis prix, puis organisme
        sessions.sort(key=lambda s: (s["debut"], s["prix"] is None, s["prix"] or 0, s["org"]["nom"], s["ville"]))
        return sessions

    def charger_offres(self):
        """Offres de stages et de jobs (étape 2) : celles dont la date d'expiration est passée disparaissent."""
        offres, ids = [], set()
        obligatoires = ["id", "intitule", "poste", "contrat", "structure", "ville", "departement", "debut",
                        "texte", "candidater", "publiee_le", "expire_le"]
        for o in self.donnees.get("offres", {}).get("offres", []) or []:
            manque = [c for c in obligatoires if not o.get(c)]
            if manque:
                sys.exit(f"Offre {o.get('id')} : champs manquants {manque}")
            if o["id"] in ids:
                sys.exit(f"Identifiant d'offre en double : {o['id']}")
            if o["departement"] not in self.departements:
                sys.exit(f"Offre {o['id']} : département inconnu {o['departement']}")
            ids.add(o["id"])
            o = dict(o)
            for c in ("debut", "fin", "publiee_le", "expire_le"):
                o[c] = en_date(o.get(c))
            if o["expire_le"] < self.aujourdhui:
                continue
            o["dep"] = self.departements[o["departement"]]
            offres.append(o)
        for o in self.offres_en_ligne():
            if o["expire_le"] >= self.aujourdhui and o["departement"] in self.departements:
                o["dep"] = self.departements[o["departement"]]
                offres.append(o)
        offres.sort(key=lambda o: (not o.get("une"), o["debut"], o["id"]))   # les offres « à la une » (structures abonnées) d'abord
        return offres

    def lire_supabase(self, chemin, quoi):
        """Lecture publique de la base des comptes (Supabase) : seulement ce que les règles d'accès montrent à tous."""
        sb = self.config.get("supabase") or {}
        if not (sb.get("url") and sb.get("cle")):
            return []
        requete = urllib.request.Request(f"{sb['url']}/rest/v1/{chemin}",
                                         headers={"apikey": sb["cle"], "Authorization": f"Bearer {sb['cle']}"})
        try:
            with urllib.request.urlopen(requete, timeout=30) as r:
                return json.load(r)
        except Exception as e:
            if isinstance(e, urllib.error.HTTPError) and e.code in (400, 404):
                # tables ou colonnes pas encore créées (supabase/schema.sql pas encore relancé)
                print(f"Attention : {quoi} pas encore lisibles dans Supabase ({e})", file=sys.stderr)
                return []
            # en ligne (GitHub Actions), mieux vaut ne pas publier que publier un site sans ses offres
            if os.environ.get("CI"):
                sys.exit(f"{quoi} illisibles : {e}")
            print(f"Attention : {quoi} non lues ({e})", file=sys.stderr)
            return []

    def offres_en_ligne(self):
        """Offres publiées par les structures vérifiées depuis leur compte.
        Les règles d'accès de la base ne laissent passer que les offres en ligne et non expirées."""
        champs = ("id,intitule,poste,contrat,ville,departement,debut,fin,public,remuneration_montant,"
                  "remuneration_unite,loge,diplomes,texte,candidater,expire_le,cree_le,nb_postes,type_accueil,age_min,age_max,"
                  "structures(id,nom,type,site,slug,fondatrice,page_publique)")
        lignes = self.lire_supabase(f"offres?select={champs},centre_id&order=debut", "centres des offres") \
            or self.lire_supabase(f"offres?select={champs}&order=debut", "offres des comptes")
        if lignes == [] and self.config.get("supabase"):
            # base pas encore en version 3 : lecture avec les colonnes de la version 1
            ancien = champs.split(",nb_postes")[0] + ",structures(nom,type,site)"
            lignes = self.lire_supabase(f"offres?select={ancien}&order=debut", "offres des comptes (version 1)")
        offres = []
        for l in lignes:
            st = l.get("structures") or {}
            offres.append({
                "id": str(l["id"]), "intitule": l["intitule"], "poste": l["poste"], "contrat": l["contrat"], "centre_id": l.get("centre_id"),
                "structure": {"id": st.get("id"), "nom": st.get("nom", ""), "type": st.get("type"), "site": st.get("site"),
                              "fondatrice": st.get("fondatrice"),
                              "slug": st.get("slug") if st.get("page_publique") else None},
                "ville": l["ville"], "departement": l["departement"],
                "debut": en_date(l["debut"]), "fin": en_date(l.get("fin")), "public": l.get("public"),
                "remuneration": ({"montant": float(l["remuneration_montant"]), "unite": l.get("remuneration_unite") or "jour",
                                  "brut": True} if l.get("remuneration_montant") else None),
                "loge": l.get("loge"), "diplomes": [l["diplomes"]] if l.get("diplomes") else [],
                "nb_postes": l.get("nb_postes") or 1, "type_accueil": l.get("type_accueil"),
                "age_min": l.get("age_min"), "age_max": l.get("age_max"),
                "texte": l["texte"], "brut": True, "candidater": l["candidater"],
                "publiee_le": en_date(l["cree_le"][:10]), "expire_le": en_date(l["expire_le"])})
        # les offres des structures abonnées : « à la une », en tête des listes, avec l'étiquette « Partenaire »
        abonnees = {x if isinstance(x, str) else (x.get("structures_abonnees") or x.get("id")) for x in (self.lire_supabase("rpc/structures_abonnees", "structures abonnées") or [])}
        for o in offres:
            o["une"] = o["structure"]["id"] in abonnees
            o["structure"]["abonnee"] = o["une"]
        return sorted(offres, key=lambda o: not o["une"])

    def point_structure(self, st):
        """Où placer la structure sur la carte de sa fiche : sa ville si on la connaît, sinon le centre du département."""
        return self.geo.get(f"{st['departement']}|{st['ville']}") or self.centres_dep.get(st["departement"])

    def mois_dispo(self, p):
        """Les 12 mois à venir, et ceux où le candidat est disponible (comme la bande de la fiche dans « Mon espace »)."""
        noms = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
        d, f = p.get("dispo_debut"), p.get("dispo_fin")
        mois = []
        for i in range(12):
            a, m = self.aujourdhui.year + (self.aujourdhui.month - 1 + i) // 12, (self.aujourdhui.month - 1 + i) % 12 + 1
            cle = (a, m)
            on = bool(d) and cle >= (d.year, d.month) and (not f or cle <= (f.year, f.month))
            mois.append({"nom": noms[m - 1], "annee": a if (m == 1 or i == 0) else None, "on": on})
        return mois

    def points_profil(self, p):
        """Les départements d'un profil (le sien en premier), au centre du département : jamais une adresse."""
        pts = []
        for i, d in enumerate([p["departement"]] + [x for x in p.get("mobilite") or [] if x != "france"]):
            c = self.centres_dep.get(d)
            nom = self.departements[d]["nom"] if d in self.departements else d
            if c:
                pts.append([c[0], c[1], nom, 1 if i == 0 else 0])
        return pts

    def structures_en_ligne(self):
        """Pages publiques des structures vérifiées (les règles d'accès ne montrent que celles-là)."""
        champs = "id,nom,type,ville,departement,site,presentation,fondatrice,slug,accroche,couleur,publics,activites,lieux,projet,avantages"
        filtre = "&page_publique=is.true&slug=not.is.null&order=nom"
        # le logo et les photos (version 4 du schéma) ; sans eux si la base n'a pas encore ces colonnes
        # le statut, les accueils et les âges (version 14) ; le logo et les photos (version 4)
        lignes = (self.lire_supabase(f"structures?select={champs},logo,photos,statut,accueils,age_min,age_max,banniere{filtre}", "bannières des structures")
                  or self.lire_supabase(f"structures?select={champs},logo,photos,statut,accueils,age_min,age_max{filtre}", "accueils des structures")
                  or self.lire_supabase(f"structures?select={champs},logo,photos{filtre}", "logos et photos des structures")
                  or self.lire_supabase(f"structures?select={champs}{filtre}", "pages des structures"))
        # les structures abonnées : l'étiquette « Partenaire » et la tête de l'annuaire
        abonnees = {x if isinstance(x, str) else (x.get("structures_abonnees") or x.get("id")) for x in (self.lire_supabase("rpc/structures_abonnees", "structures abonnées") or [])}
        sortie = [dict(l, exemple=False, abonnee=l.get("id") in abonnees) for l in lignes if l.get("departement") in self.departements]
        return sorted(sortie, key=lambda l: not l["abonnee"])

    def pages_sejours(self, structures):
        """« Inscrire mon enfant » : la fiche de chaque séjour publié par une structure vérifiée (les règles d'accès ne
        montrent que ceux-là), et la fiche d'exemple. Indexée seulement si une date est à venir. Voir docs/PLAN-SEJOURS.md."""
        par_id = {st.get("id"): st for st in structures if st.get("id")}
        lignes = self.lire_supabase("sejours?select=id,structure_id,type,slug,titre,accroche,description,programme,vie_sur_place,encadrement_texte,infos_pratiques,envies,age_min,age_max,capacite,taux_encadrement,pays,region_dest,ville,departement,hebergement,transport,horaires,prix_min,prix_unite,prix_texte,inclus,aides,pass_colo,numero_declaration,photos,statut,cree_le,maj_le&statut=eq.publie&order=cree_le", "séjours") or []
        ids = ",".join(str(l["id"]) for l in lignes)
        dates = self.lire_supabase(f"sejours_dates?select=*&sejour_id=in.({ids})&order=debut", "dates des séjours") if ids else []
        auj = dt.date.today()
        self.sejours = []
        for l in lignes:
            st = par_id.get(l.get("structure_id"))
            if not st:
                continue  # structure sans page publique : sa fiche séjour viendra avec sa page
            sj = dict(l, structure=st, exemple=False, url=f"/enfants/{st['slug']}/{l['slug']}/",
                      dates=[dict(d, debut=en_date(d["debut"]), fin=en_date(d["fin"])) for d in dates or [] if d["sejour_id"] == l["id"]])
            sj["a_venir"] = [d for d in sj["dates"] if d["fin"] >= auj]
            self.sejours.append(sj)
            if sj["a_venir"]:
                st.setdefault("sejours", []).append(sj)
        for st in structures:
            if st.get("sejours"):
                st["sejours"].sort(key=lambda x: x["a_venir"][0]["debut"])
                st["frise"] = self.frise_ete(st["sejours"])
        for sj in self.sejours:
            sj["proches"] = sorted([x for x in self.sejours if x is not sj and x["a_venir"] and x["age_min"] <= sj["age_max"] and x["age_max"] >= sj["age_min"]],
                                   key=lambda x: (x["structure"]["id"] == sj["structure"]["id"], x["departement"] != sj["departement"], x["a_venir"][0]["debut"]))[:4]
            self.ajouter(sj["url"], "sejour.html", titre=self.titre_sejour(sj), description=self.desc_sejour(sj), indexer=bool(sj["a_venir"]),
                         sejour=sj, schema=self.schema_sejour(sj),
                         fil=[("Inscrire mon enfant", "/enfants/"), (sj["structure"]["nom"], f"/trouver-un-poste/structures/{sj['structure']['slug']}/"), (sj["titre"], sj["url"])])
        ex = (self.donnees.get("exemples") or {})
        if ex.get("sejour") and ex.get("structure"):
            sj = dict(ex["sejour"], exemple=True, id=None, url="/enfants/exemple/", proches=[], photos=[],
                      structure=dict(ex["structure"], exemple=True, url="/recruter/exemple-de-page-structure/"))
            sj["dates"] = [dict(d, debut=en_date(d["debut"]), fin=en_date(d["fin"])) for d in sj["dates"]]
            sj["a_venir"] = sj["dates"]
            # la page structure d'exemple montre aussi sa section « Nos séjours »
            for pg in self.pages:
                if pg["url"] == "/recruter/exemple-de-page-structure/":
                    pg["structure"]["sejours"] = [sj]
                    pg["structure"]["frise"] = self.frise_ete([sj])
            self.ajouter("/enfants/exemple/", "sejour.html", titre="Exemple de fiche séjour", indexer=False, sejour=sj, schema="",
                         description="À quoi ressemble la fiche d'un séjour sur Fil Roug'Anim : un exemple fictif.",
                         fil=[("Inscrire mon enfant", "/enfants/"), ("Exemple de fiche séjour", "/enfants/exemple/")])

    def pages_sejours_google(self):
        """Les pages « Inscrire mon enfant » pour Google (docs/PLAN-SEJOURS.md, partie 6) : par période, par âge, par envie,
        au départ d'une ville, par destination, et les accueils de loisirs par ville. Une page n'existe que si elle a au
        moins une offre (3 pour les départs et les destinations) ; elle n'est montrée à Google qu'à partir de 3 offres."""
        a_venir = [sj for sj in self.sejours if sj["a_venir"]]
        self.familles_sejours = {}
        if not a_venir:
            return
        nuits = [sj for sj in a_venir if not sj["type"].startswith("accueil")]
        familles = collections.OrderedDict()   # (famille, url) -> (titre, h1, intro, séjours)
        # les périodes : d'après les dates à venir de chaque séjour
        def saisons(sj):
            out = set()
            for d in sj["a_venir"]:
                for x in (d["debut"], d["fin"]):
                    m, an = x.month, x.year
                    if m in (7, 8): out.add(("ete", an))
                    elif m in (2, 3): out.add(("hiver", an))
                    elif m in (4, 5): out.add(("printemps", an))
                    elif m in (10, 11): out.add(("toussaint", an))
                    elif m == 12: out.add(("noel", an))
                    elif m == 1: out.add(("noel", an - 1))
            return out
        NOMS_P = {"ete": ("l'été", "Été"), "hiver": ("les vacances d'hiver", "Hiver"), "printemps": ("les vacances de printemps", "Printemps"),
                  "toussaint": ("la Toussaint", "Toussaint"), "noel": ("Noël", "Noël")}
        par_p = collections.defaultdict(list)
        for sj in a_venir:
            if sj["type"] not in ("accueil_mercredis", "accueil_periscolaire"):
                for k in saisons(sj):
                    par_p[k].append(sj)
        for (k, an), ls in sorted(par_p.items(), key=lambda x: (x[0][1], ["hiver", "printemps", "ete", "toussaint", "noel"].index(x[0][0]))):
            familles[("periode", f"/enfants/{k}-{an}/")] = (f"Colonies de vacances {NOMS_P[k][1].lower()} {an} : séjours pour enfants et ados",
                f"Séjours et colos, {NOMS_P[k][1].lower()} {an}", f"Les séjours et les accueils de loisirs pour {NOMS_P[k][0]} {an}, publiés par des structures vérifiées.", ls, f"{NOMS_P[k][1]} {an}")
        # les âges
        for b, (a0, a1) in [("3-5", (3, 5)), ("6-8", (6, 8)), ("9-11", (9, 11)), ("12-14", (12, 14)), ("15-17", (15, 17)), ("ados", (12, 17))]:
            ls = [sj for sj in a_venir if sj["age_min"] <= a1 and sj["age_max"] >= a0]
            if ls:
                nom = "les ados" if b == "ados" else f"les {b} ans"
                familles[("age", f"/enfants/{b if b == 'ados' else b + '-ans'}/")] = (f"Colo pour {nom} : séjours et accueils de loisirs",
                    f"Séjours pour {nom}", f"Colos, mini-séjours et accueils de loisirs adaptés à {nom}.", ls, "Ados" if b == "ados" else f"{b} ans")
        # les envies (et l'étranger)
        ENV = [("mer", "mer", "à la mer", "Mer et plage"), ("montagne", "montagne", "à la montagne", "Montagne"), ("equitation", "equitation", "équitation", "Équitation"),
               ("nautique", "sports-nautiques", "sports nautiques", "Sports nautiques"), ("langues", "linguistique", "linguistique", "Linguistique"),
               ("nature", "nature", "nature et animaux", "Nature"), ("arts", "arts-cirque", "arts et cirque", "Arts et cirque"), ("sciences", "sciences", "sciences et numérique", "Sciences"),
               ("itinerance", "itinerance", "itinérante", "Itinérance"), ("sports", "sports", "sportive", "Sports"), ("decouverte", "decouverte", "découverte", "Découverte")]
        for cle, sl, mot, court in ENV:
            ls = [sj for sj in a_venir if cle in (sj.get("envies") or [])]
            if ls:
                familles[("envie", f"/enfants/{sl}/")] = (f"Colo {mot} : séjours pour enfants et ados", f"Colo {mot}",
                    f"Les séjours et accueils de loisirs « {SEJ_ENVIES[cle].lower()} », pour les 3-17 ans.", ls, court)
        etr = [sj for sj in nuits if (sj.get("pays") or "FR") != "FR"]
        if etr:
            familles[("envie", "/enfants/etranger/")] = ("Séjours à l'étranger pour enfants et ados", "Séjours à l'étranger",
                "Séjours linguistiques et colos à l'étranger. Pensez à la pièce d'identité et à l'autorisation de sortie du territoire.", etr, "Étranger")
        # les départs (villes avec au moins 3 séjours au départ)
        par_v = collections.defaultdict(list)
        for sj in nuits:
            for v in {t.get("ville") for t in sj.get("transport") or [] if t.get("ville")}:
                par_v[v.split("(")[0].strip()].append(sj)
        for v, ls in sorted(par_v.items()):
            if len(ls) >= 3:
                familles[("depart", f"/enfants/depart-{slug(v)}/")] = (f"Colonies de vacances au départ de {v}", f"Séjours au départ de {v}",
                    f"Les colos et séjours avec un départ organisé depuis {v}.", ls, v)
        # les destinations : la région en France, le pays à l'étranger
        PAYS = {"ES": "Espagne", "GB": "Angleterre", "IE": "Irlande", "IT": "Italie", "DE": "Allemagne", "MT": "Malte", "US": "États-Unis", "CA": "Canada", "PT": "Portugal", "GR": "Grèce", "CH": "Suisse", "BE": "Belgique", "NL": "Pays-Bas"}
        par_d = collections.defaultdict(list)
        for sj in nuits:
            if (sj.get("pays") or "FR") == "FR" and sj.get("departement") in self.departements:
                r = self.departements[sj["departement"]]["reg"]
                par_d[(r["slug"], r["nom"], r["a"])].append(sj)
            elif sj.get("pays") in PAYS:
                par_d[(slug(PAYS[sj["pays"]]), PAYS[sj["pays"]], "en " + PAYS[sj["pays"]])].append(sj)
        for (sl, nom, a_), ls in sorted(par_d.items()):
            if len(ls) >= 3:
                familles[("destination", f"/enfants/{sl}/")] = (f"Colos {a_} : séjours pour enfants et ados", f"Séjours {a_}", f"Les colos et séjours {a_}.", ls, nom)
        # les accueils de loisirs, par ville
        par_ville = collections.defaultdict(list)
        for sj in a_venir:
            if sj["type"].startswith("accueil") and sj.get("ville") and sj.get("departement"):
                par_ville[(sj["departement"], sj["ville"])].append(sj)
        for (dep, v), ls in sorted(par_ville.items()):
            familles[("accueil", f"/enfants/accueils-de-loisirs/{dep}/{slug(v)}/")] = (f"Accueils de loisirs à {v} : vacances et mercredis",
                f"Accueils de loisirs à {v}", f"Les accueils de loisirs de {v} ({dep}) pour les vacances et les mercredis : horaires, prix et demande de place en ligne.", ls, v)
        # les croisements utiles (période × âge, période × envie), seulement à partir de 5 offres
        periodes_f = [(url, v) for (fam, url), v in familles.items() if fam == "periode"]
        autres_f = [(fam, url, v) for (fam, url), v in familles.items() if fam in ("age", "envie")]
        for purl, pv in periodes_f:
            ids_p = {id(x) for x in pv[3]}
            for fam, aurl, av in autres_f:
                ls = [x for x in av[3] if id(x) in ids_p]
                if len(ls) >= 5:
                    sous = aurl.rstrip("/").split("/")[-1]
                    familles[("croise", f"{purl}{sous}/")] = (f"{av[1]} · {pv[4]}", f"{av[1]}, {pv[4].lower()}",
                        av[2].rstrip(".") + f", pour {pv[4].lower()}.", ls, f"{pv[4]} · {av[4]}")
        # les pages
        self.familles_sejours = collections.defaultdict(list)
        for (fam, url), (titre, h1, intro, ls, court) in familles.items():
            self.familles_sejours[fam].append({"url": url, "nom": court, "n": len(ls)})
        for (fam, url), (titre, h1, intro, ls, court) in familles.items():
            ls = sorted(ls, key=lambda x: (not x["structure"].get("abonnee"), x["a_venir"][0]["debut"]))
            schema = [json.loads(self.schema_sejour(x)) for x in ls[:10] if x["a_venir"]]
            self.ajouter(url, "sejours-liste.html", titre=titre, h1=h1, intro=intro, indexer=len(ls) >= 3, sejours_page=ls, famille_sj=fam,
                         description=(intro + f" {len(ls)} offre{'s' if len(ls) > 1 else ''}, demande de place en ligne et sans frais.")[:300],
                         schema=json_ld([e for x in schema for e in x]) if schema else "",
                         voisines=self.familles_sejours, fil=[("Inscrire mon enfant", "/enfants/"), (court, url)])
        for pg in self.pages:
            if pg["url"] == "/enfants/":
                pg["voisines"] = self.familles_sejours
        # l'accueil : la bande « Les séjours à venir » (structures abonnées d'abord, signalées), à partir de 3 offres
        une = sorted(a_venir, key=lambda x: (not x["structure"].get("abonnee"), x["a_venir"][0]["debut"]))[:6]
        for pg in self.pages:
            if pg["url"] == "/":
                pg["sejours_une"] = une if len(a_venir) >= 3 else []

    # ------------------------------------------------------------------------------------------------------------
    def pages_locales(self, structures):
        """Les pages locales pour Google : pour chaque département, région et grande ville, une page par public et par
        sujet (emploi d'animateur, stage pratique, direction ; recruter des animateurs, un directeur, un stagiaire ;
        centre de loisirs, colo, périscolaire). Chaque page est remplie avec les vraies données du lieu : offres,
        structures vérifiées, séjours, sessions de formation proches, vacances de la zone, départements voisins."""
        auj = self.aujourdhui
        deps = list(self.departements.values())
        par_reg = collections.defaultdict(list)
        for d in deps:
            par_reg[d["reg"]["id"]].append(d)
        bafa = [s for s in self.sessions if s["diplome"] == "BAFA"]
        bafd = [s for s in self.sessions if s["diplome"] == "BAFD"]
        pros = [s for s in self.sessions if s["diplome"] in ("BPJEPS", "CPJEPS", "DEJEPS", "DESJEPS")]
        st_url = {st["slug"]: f"/trouver-un-poste/structures/{st['slug']}/" for st in structures}
        sej = [x for x in getattr(self, "sejours", []) if x.get("a_venir")]

        def dist(a, b):
            if not a or not b:
                return 9999
            la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
            h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
            return 6371 * 2 * math.asin(math.sqrt(h))
        voisins = {}
        for d in deps:
            c = self.centres_dep.get(d["code"])
            voisins[d["code"]] = sorted([x for x in deps if x is not d], key=lambda x: dist(c, self.centres_dep.get(x["code"])))[:5]
        def vacances(dep):
            out = []
            for p in self.periodes:
                if (p["zones"][dep["zone"]]["fin"] if p["zones"] else p["fin"]) >= auj:
                    out.append((p["court"], self.dates_vacances(p, dep)))
            return out[:5]
        def un(n, mot, pl=None):
            return f"{n} {mot if n <= 1 else (pl or mot + 's')}"
        def var(cle, choix):
            return choix[sum(ord(c) for c in cle) % len(choix)]
        def carte_st(st):
            acc = ", ".join(ACCUEILS.get(a, a).lower() for a in (st.get("accueils") or [])[:3] if a != "autre")
            return {"nom": st["nom"], "url": st_url[st["slug"]], "sous": f"{TYPES_STRUCTURE.get(st['type'], 'Structure')} · {st['ville']}" + (f" · {acc}" if acc else "")}
        def carte_sj(x):
            return {"titre": x["titre"], "url": x["url"], "sous": f"{SEJ_TYPES.get(x['type'], ('Séjour',))[0]} · {x['age_min']}-{x['age_max']} ans · {x['structure']['nom']}" + (f" · dès {int(x['prix_min'])} €" if x.get("prix_min") else "")}
        def fg(ls):
            return [s for s in ls if s["type"] in ("formation-generale", "parcours")]
        def prix_min(ls):
            p = [s["prix"] for s in ls if s.get("prix")]
            return f"{int(min(p))} €" if p else None

        familles = collections.defaultdict(list)   # (public, sujet) -> [(nom, url)]
        a_faire = []                                # (url, titre, h1, description, intro, local, faq, fil, indexer)
        TP, REC, ENF = ("Animateurs & directeurs", "/trouver-un-poste/offres/"), ("Structures", "/recruter/"), ("Inscrire mon enfant", "/enfants/")
        cee = "Un animateur en colo ou en accueil de loisirs pendant les vacances est le plus souvent embauché en contrat d'engagement éducatif (CEE) : au moins 2,20 fois le SMIC horaire par jour travaillé, 80 jours au plus sur 12 mois, et un repos quotidien et hebdomadaire encadré par la loi. À l'année (périscolaire, mercredis), c'est un CDD ou un CDI à temps partiel, souvent dans une mairie ou une association."
        stage = "Le stage pratique du BAFA dure au moins 14 jours effectifs, dans un accueil collectif de mineurs déclaré (colo, accueil de loisirs, périscolaire, en une ou deux parties). Il doit commencer dans les 18 mois qui suivent la formation générale, et tout le BAFA se termine en 30 mois au plus. Le stage peut être rémunéré : en pratique, la plupart des stagiaires en colo sont payés en CEE."
        direction = "Un séjour de vacances ou un accueil de loisirs est dirigé par un titulaire du BAFD (ou stagiaire BAFD), ou d'un diplôme professionnel de l'animation. Pour un accueil de loisirs de plus de 80 mineurs ouvert plus de 80 jours par an, un diplôme professionnel est demandé (BPJEPS, DEJEPS…)."
        taux = ["En accueil de loisirs et en séjour de vacances : un animateur pour 8 enfants de moins de 6 ans, un pour 12 enfants de 6 ans et plus.",
                "En périscolaire : un pour 10 enfants de moins de 6 ans et un pour 14 de 6 ans et plus (un pour 14 et un pour 18 avec un projet éducatif territorial).",
                "Dans l'équipe : au moins la moitié de diplômés BAFA (ou équivalent), au plus 20 % sans qualification."]

        for d in deps:
            code, nom, a_, de = d["code"], d["nom"], d["a"], d["de"]
            v_liens = voisins[code]
            s_dep, f_dep = [s for s in bafa if s["departement"] == code], fg([s for s in bafa if s["departement"] == code])
            ap_dep = [s for s in s_dep if s["type"] == "approfondissement"]
            d_dep = [s for s in bafd if s["departement"] == code]
            p_dep = [s for s in pros if s["departement"] == code]
            o_dep = [o for o in self.offres if o["departement"] == code]
            o_stage = [o for o in o_dep if o["poste"] in ("stagiaire-bafa", "stagiaire_bafa") or "stag" in (o["poste"] or "") or "stage" in (o["intitule"] or "").lower()]
            o_dir = [o for o in o_dep if "direct" in (o["poste"] or "") or "direct" in (o["intitule"] or "").lower()]
            st_dep = [st for st in structures if st["departement"] == code]
            st_acc = [st for st in st_dep if set(st.get("accueils") or []) & {"periscolaire", "extrascolaire", "accueil-de-jeunes"}]
            sj_depart = [x for x in sej if x.get("departement") == code or any((t.get("ville") or "") and self.geo.get(f"{code}|{t.get('ville')}") for t in (x.get("transport") or []))]
            sj_acc = [x for x in sej if x["type"].startswith("accueil") and x.get("departement") == code]
            vac = vacances(d)
            villes_s = [v for v, _ in collections.Counter(s["ville"] for s in f_dep).most_common(6)]
            ville_txt = (", ".join(villes_s[:-1]) + " et " + villes_s[-1]) if len(villes_s) > 1 else (villes_s[0] if villes_s else "")
            org_n = len({s["org"]["nom"] for s in s_dep})

            # ---------------- animateurs : emploi d'animateur
            url = f"/trouver-un-poste/emploi-animateur/{d['slug']}/"
            blocs = []
            blocs.append({"titre": f"Les offres d'animation {a_}", "offres": o_dep[:8], "large": True,
                          "vide": None if o_dep else f"Pas d'offre en ligne {a_} en ce moment. Les structures vérifiées publient au fil de l'année, surtout de janvier à mai pour l'été : créez votre profil, elles peuvent vous écrire avant même de publier.",
                          "lien": ("Toutes les offres, avec les filtres", "/trouver-un-poste/offres/")})
            blocs.append({"titre": f"Les structures qui recrutent {a_}", "structures": [carte_st(x) for x in st_dep[:12]],
                          "paras": [f"Centres de loisirs, mairies, associations et organisateurs de colos : {un(len(st_dep), 'structure vérifiée')} {a_} sur Fil Roug'Anim." if st_dep else
                                    var(code, [f"Les premières structures {de} arrivent sur le site. En attendant, décrivez le poste que vous cherchez : votre demande part chez les structures les plus proches de chez vous.",
                                               f"Aucune structure {de} n'a encore sa page ici. Décrivez ce que vous cherchez : les structures vérifiées les plus proches reçoivent votre demande et vous répondent."])],
                          "lien": ("Décrire le poste que je cherche", "/trouver-un-poste/demande/")})
            blocs.append({"titre": "Le contrat et la paie", "paras": [cee]})
            blocs.append({"titre": f"Pas encore le BAFA ? Les sessions {a_}", "sessions": f_dep[:5],
                          "paras": [f"{un(len(f_dep), 'session')} de formation générale à venir {a_}" + (f", surtout à {ville_txt}" if ville_txt else "") + (f", à partir de {prix_min(f_dep)}" if prix_min(f_dep) else "") + "." if f_dep else f"Pas de session de formation générale relevée {a_} pour l'instant : regardez les départements voisins plus bas."],
                          "lien": (f"Toutes les sessions BAFA {a_}", f"/se-former/sessions/{d['slug']}/")})
            if vac:
                blocs.append({"titre": f"Quand on recrute {a_}", "paras": [f"Le département est en zone {d['zone']} des vacances scolaires. Les structures cherchent leurs équipes 2 à 4 mois avant chaque période : pour l'été, dès janvier."], "vacances": vac})
            faq = [{"q": f"Combien gagne un animateur {a_} ?", "r": "En contrat d'engagement éducatif, au moins 2,20 fois le SMIC horaire par jour travaillé, souvent davantage en colo (nourri, logé). En périscolaire, la paie est horaire, selon la grille de la mairie ou de l'association."},
                   {"q": "Faut-il le BAFA pour être animateur ?", "r": "Non, pas toujours : une équipe peut compter jusqu'à 20 % d'animateurs sans qualification. Mais le BAFA (ou un équivalent) est demandé pour la plupart des postes, et au moins la moitié de l'équipe doit l'avoir."},
                   {"q": f"Où trouver un stage pratique BAFA {a_} ?", "r": "Dans les centres de loisirs de votre ville, les colos et le périscolaire. Créez votre profil sur Fil Roug'Anim et décrivez ce que vous cherchez : les structures de votre secteur reçoivent votre demande."}]
            a_faire.append((url, f"Emploi animateur {nom} ({code}) : offres, structures et BAFA", f"Emploi d'animateur {a_}",
                            f"Travailler comme animateur {a_} ({code}) : les offres en ligne, les structures vérifiées qui recrutent, le contrat CEE et la paie, les sessions BAFA proches et les vacances de la zone {d['zone']}.",
                            f"Colos, centres de loisirs, périscolaire : tout pour trouver un poste d'animateur {a_}, avec les offres, les structures du département et les sessions BAFA proches.",
                            {"public": "anim", "sur": f"Animateurs · {nom} ({code})", "chiffres": [(len(o_dep), "offres en ligne"), (len(st_dep), "structures vérifiées"), (len(f_dep), "sessions BAFA à venir")],
                             "actions": [("Créer mon profil", "/compte/?inscription=1&role=candidat", True), ("Décrire ce que je cherche", "/trouver-un-poste/demande/", False)], "blocs": blocs},
                            faq, [TP, ("Emploi animateur", "/trouver-un-poste/emploi-animateur/"), (nom, url)], True, ("anim", "emploi"), nom))

            # ---------------- animateurs : stage pratique BAFA
            url = f"/trouver-un-poste/stage-pratique-bafa/{d['slug']}/"
            blocs = [{"titre": f"Les offres de stage pratique {a_}", "offres": (o_stage or o_dep)[:8], "large": True,
                      "vide": None if (o_stage or o_dep) else f"Aucune offre de stage en ligne {a_} aujourd'hui. Le plus efficace : décrire ce que vous cherchez (dates, type d'accueil, âge des enfants). Votre demande part chez les structures les plus proches.",
                      "lien": ("Décrire le stage que je cherche", "/trouver-un-poste/demande/")},
                     {"titre": "Les règles du stage pratique", "paras": [stage]},
                     {"titre": f"Où faire son stage {a_}", "structures": [carte_st(x) for x in st_dep[:10]],
                      "points": [("Accueils de loisirs :", f"les centres des mairies {de}, les mercredis et pendant les vacances : le plus simple pour un premier stage, sans dormir sur place."),
                                 ("Colos et séjours :", "souvent logé et nourri, au départ de votre ville ou ailleurs en France."),
                                 ("Périscolaire :", "le matin, le midi et le soir, en semaine : le stage se fait alors en plusieurs parties.")]},
                     {"titre": f"Après le stage : l'approfondissement {a_}", "sessions": ap_dep[:4],
                      "paras": [f"{un(len(ap_dep), 'session')} d'approfondissement ou de qualification à venir {a_}." if ap_dep else f"Pas d'approfondissement relevé {a_} pour l'instant : les sessions des départements voisins sont plus bas."],
                      "lien": ("Les approfondissements BAFA", "/se-former/sessions/approfondissement/")}]
            if vac:
                blocs.append({"titre": "Les vacances de la zone, pour caler votre stage", "vacances": vac})
            faq = [{"q": "Le stage pratique BAFA est-il payé ?", "r": "Souvent oui, en contrat d'engagement éducatif, surtout en colo. Ce n'est pas obligatoire : certaines structures proposent un stage non rémunéré, mais c'est de plus en plus rare."},
                   {"q": "Combien de temps dure le stage pratique ?", "r": "14 jours effectifs au minimum, en une ou deux parties, dans un accueil collectif de mineurs déclaré."},
                   {"q": "Dans quel délai faire le stage après la formation générale ?", "r": "Il doit commencer dans les 18 mois qui suivent la formation générale ; l'ensemble du BAFA se termine en 30 mois au plus."}]
            a_faire.append((url, f"Stage pratique BAFA {nom} ({code}) : offres et structures", f"Trouver son stage pratique BAFA {a_}",
                            f"Stage pratique BAFA {a_} ({code}) : les offres de stage, les structures vérifiées qui accueillent des stagiaires, les règles (14 jours, 18 mois) et les approfondissements proches.",
                            f"Accueil de loisirs, colo ou périscolaire : les pistes concrètes pour trouver votre stage pratique BAFA {a_}, et les règles à connaître.",
                            {"public": "anim", "sur": f"Stage pratique BAFA · {nom}", "chiffres": [(len(o_stage or o_dep), "offres de stage"), (len(st_dep), "structures vérifiées"), (len(ap_dep), "approfondissements à venir")],
                             "actions": [("Décrire le stage que je cherche", "/trouver-un-poste/demande/", True), ("Créer mon profil", "/compte/?inscription=1&role=candidat", False)], "blocs": blocs},
                            faq, [TP, ("Stage pratique BAFA", "/trouver-un-poste/stage-pratique-bafa/"), (nom, url)], True, ("anim", "stage"), nom))

            # ---------------- animateurs : direction
            url = f"/trouver-un-poste/emploi-directeur/{d['slug']}/"
            blocs = [{"titre": f"Les postes de direction {a_}", "offres": o_dir[:8], "large": True,
                      "vide": None if o_dir else f"Pas d'offre de direction en ligne {a_} aujourd'hui. Les postes de directeur se pourvoient souvent par le bouche-à-oreille : un profil complet (BAFD, expériences, disponibilités) permet aux structures de vous trouver.",
                      "lien": ("Créer mon profil de directeur", "/compte/?inscription=1&role=candidat")},
                     {"titre": "Ce qu'il faut pour diriger", "paras": [direction]},
                     {"titre": f"Le BAFD {a_}", "sessions": d_dep[:5],
                      "paras": [f"{un(len(d_dep), 'session')} BAFD à venir {a_}." if d_dep else f"Pas de session BAFD relevée {a_} pour l'instant."] + ([f"Et {un(len(p_dep), 'formation professionnelle')} (BPJEPS, DEJEPS…) dans le département."] if p_dep else []),
                      "lien": ("Toutes les sessions BAFD", "/se-former/sessions/bafd/")},
                     {"titre": f"Les structures {de}", "structures": [carte_st(x) for x in st_dep[:10]],
                      "vide": None if st_dep else f"Les structures {de} arrivent sur le site : décrivez le poste de direction que vous cherchez, votre demande leur parvient.",
                      "lien": ("Décrire le poste que je cherche", "/trouver-un-poste/demande/")}]
            faq = [{"q": "Combien gagne un directeur de colo ?", "r": "En contrat d'engagement éducatif, la paie est fixée par jour et dépasse le minimum légal (2,20 SMIC horaire) ; elle dépend de l'organisateur, de la taille du séjour et de l'expérience. À l'année, un directeur d'accueil de loisirs est souvent salarié d'une mairie ou d'une association."},
                   {"q": "Peut-on diriger en étant stagiaire BAFD ?", "r": "Oui : le stage pratique du BAFD se fait justement en situation de direction (ou d'adjoint), dans un accueil déclaré."}]
            a_faire.append((url, f"Directeur ACM {nom} ({code}) : postes de direction, BAFD", f"Diriger un séjour ou un accueil {a_}",
                            f"Directeur de colo ou d'accueil de loisirs {a_} ({code}) : les postes de direction, les règles (BAFD, diplômes professionnels), les sessions BAFD et les structures du département.",
                            f"Directeur, directrice ou adjoint : les postes de direction {a_}, ce qu'il faut pour diriger et les formations proches.",
                            {"public": "anim", "sur": f"Direction · {nom} ({code})", "chiffres": [(len(o_dir), "postes de direction"), (len(d_dep), "sessions BAFD"), (len(st_dep), "structures vérifiées")],
                             "actions": [("Créer mon profil", "/compte/?inscription=1&role=candidat", True), ("Décrire ce que je cherche", "/trouver-un-poste/demande/", False)], "blocs": blocs},
                            faq, [TP, ("Emploi directeur", "/trouver-un-poste/emploi-directeur/"), (nom, url)], True, ("anim", "direction"), nom))

            # ---------------- structures : recruter des animateurs
            url = f"/recruter/animateurs-bafa/{d['slug']}/"
            blocs = [{"titre": f"Le vivier d'animateurs {a_}",
                      "paras": [(f"{un(len(f_dep), 'session')} de formation générale BAFA à venir {a_}" + (f" (dont à {ville_txt})" if ville_txt else "") + f", par {un(org_n, 'organisme')} : autant de stagiaires qui chercheront leur stage pratique dans les 18 mois." if f_dep else f"Peu de sessions BAFA {a_} : les stagiaires viennent aussi des départements voisins.") ,
                                "Sur Fil Roug'Anim, les animateurs et directeurs créent un profil gratuit : diplômes, disponibilités, départements où ils peuvent travailler. Les structures vérifiées les consultent et leur écrivent directement."],
                      "sessions": f_dep[:3]},
                     {"titre": "Publier une offre, gratuitement", "points": [("Votre page :", "votre projet, vos publics, vos photos, visibles dans l'annuaire et sur Google."),
                                                                             ("Une offre gratuite :", "stage pratique, job d'été ou poste à l'année, avec candidature directe."),
                                                                             ("Les demandes des animateurs :", f"ceux qui décrivent le poste qu'ils cherchent {a_} arrivent chez les structures les plus proches.")],
                      "lien": ("Créer la page de ma structure", "/compte/?inscription=1&role=structure")},
                     {"titre": "Les taux d'encadrement", "points": taux},
                     {"titre": f"Les structures déjà présentes {a_}", "structures": [carte_st(x) for x in st_dep[:10]],
                      "vide": None if st_dep else f"Aucune structure {de} n'a encore sa page : les premières sont les plus visibles."}]
            if vac:
                blocs.append({"titre": "Le calendrier de recrutement", "paras": [f"Zone {d['zone']} : publiez 2 à 4 mois avant chaque période, dès janvier pour l'été."], "vacances": vac})
            faq = [{"q": f"Comment recruter un animateur BAFA {a_} ?", "r": "Publiez une offre gratuite sur Fil Roug'Anim et consultez les profils des animateurs de votre secteur. Pensez aux organismes de formation BAFA du département : leurs stagiaires cherchent un stage pratique."},
                   {"q": "Quel contrat pour un animateur de vacances ?", "r": "Le contrat d'engagement éducatif (CEE) est fait pour les accueils collectifs de mineurs occasionnels : au moins 2,20 SMIC horaire par jour, 80 jours au plus sur 12 mois."},
                   {"q": "Combien coûte Fil Roug'Anim ?", "r": "La page de la structure et une offre sont gratuites. L'abonnement donne accès aux profils complets et aux demandes des animateurs de votre secteur."}]
            a_faire.append((url, f"Recruter des animateurs BAFA {nom} ({code})", f"Recruter des animateurs {a_}",
                            f"Recruter des animateurs BAFA {a_} ({code}) : le vivier (sessions BAFA, stagiaires), l'offre gratuite, les taux d'encadrement et le calendrier de la zone {d['zone']}.",
                            f"Centres de loisirs, mairies, associations, organisateurs de colos {de} : trouvez vos animateurs et vos stagiaires BAFA, avec une page et une offre gratuites.",
                            {"public": "struct", "sur": f"Structures · {nom} ({code})", "chiffres": [(len(f_dep), "sessions BAFA à venir"), (org_n, "organismes de formation"), (len(st_dep), "structures déjà présentes")],
                             "actions": [("Publier une offre gratuite", "/compte/?inscription=1&role=structure", True), ("Voir un exemple de page", "/recruter/exemple-de-page-structure/", False)], "blocs": blocs},
                            faq, [REC, ("Recruter des animateurs", "/recruter/animateurs-bafa/"), (nom, url)], True, ("struct", "animateurs"), nom))

            # ---------------- structures : recruter un directeur
            url = f"/recruter/directeur-bafd/{d['slug']}/"
            blocs = [{"titre": "Qui peut diriger votre accueil", "paras": [direction]},
                     {"titre": f"Les futurs directeurs formés {a_}", "sessions": d_dep[:4],
                      "paras": [f"{un(len(d_dep), 'session')} BAFD à venir {a_} : leurs stagiaires cherchent un stage pratique de direction ou d'adjoint." if d_dep else f"Pas de session BAFD relevée {a_} en ce moment : les stagiaires BAFD des départements voisins peuvent venir chez vous."]},
                     {"titre": "Trouver votre directeur ou votre adjoint", "points": [("Publiez l'offre :", "gratuitement, avec les dates, le public et la paie."),
                                                                                       ("Consultez les profils :", "les directeurs et adjoints du secteur, avec leurs diplômes et leurs disponibilités."),
                                                                                       ("Pensez aux stagiaires BAFD :", "un adjoint aujourd'hui, un directeur demain.")],
                      "lien": ("Créer la page de ma structure", "/compte/?inscription=1&role=structure")}]
            faq = [{"q": "Un stagiaire BAFD peut-il diriger ?", "r": "Oui, c'est le principe du stage pratique du BAFD, dans un accueil déclaré, avec le suivi de l'organisme de formation."},
                   {"q": "Quand faut-il un diplôme professionnel ?", "r": "Pour diriger un accueil de loisirs de plus de 80 mineurs ouvert plus de 80 jours par an : BPJEPS, DEJEPS ou équivalent."}]
            a_faire.append((url, f"Recruter un directeur BAFD {nom} ({code})", f"Recruter un directeur ou un adjoint {a_}",
                            f"Recruter un directeur de colo ou d'accueil de loisirs {a_} ({code}) : qui peut diriger, les stagiaires BAFD du département, publier une offre gratuite.",
                            f"Directeur, directrice ou adjoint pour votre accueil de loisirs ou votre séjour {a_} : les règles et les pistes concrètes.",
                            {"public": "struct", "sur": f"Structures · {nom} ({code})", "chiffres": [(len(d_dep), "sessions BAFD à venir"), (len(p_dep), "formations professionnelles"), (len(st_dep), "structures présentes")],
                             "actions": [("Publier une offre gratuite", "/compte/?inscription=1&role=structure", True)], "blocs": blocs},
                            faq, [REC, ("Recruter un directeur", "/recruter/directeur-bafd/"), (nom, url)], True, ("struct", "directeur"), nom))

            # ---------------- structures : accueillir un stagiaire BAFA
            url = f"/recruter/stagiaire-bafa/{d['slug']}/"
            blocs = [{"titre": f"Les stagiaires BAFA {de}", "sessions": f_dep[:4],
                      "paras": [f"{un(len(f_dep), 'session')} de formation générale à venir {a_}" + (f" (à {ville_txt})" if ville_txt else "") + " : chaque stagiaire doit faire 14 jours de stage pratique dans un accueil déclaré." if f_dep else "Les stagiaires viennent aussi des départements voisins : un stage en colo se fait souvent loin de chez soi."]},
                     {"titre": "Ce que dit la règle", "paras": [stage]},
                     {"titre": "Bien accueillir un stagiaire", "points": [("Un tuteur :", "un animateur expérimenté ou le directeur suit le stagiaire et l'évalue à la fin."),
                                                                         ("Des missions claires :", "préparer et mener des activités, participer à la vie quotidienne et aux réunions d'équipe."),
                                                                         ("L'appréciation :", "le directeur remplit l'appréciation du stage sur le site du BAFA à la fin.")],
                      "lien": ("Publier une offre de stage", "/compte/?inscription=1&role=structure")}]
            if vac:
                blocs.append({"titre": "Les périodes où les stagiaires cherchent", "vacances": vac})
            faq = [{"q": "Faut-il payer un stagiaire BAFA ?", "r": "Ce n'est pas obligatoire, mais c'est l'usage en colo (contrat d'engagement éducatif). Un stage non payé reste possible : dites-le clairement dans l'offre."},
                   {"q": "Combien de stagiaires dans l'équipe ?", "r": "Les stagiaires BAFA comptent dans les animateurs qualifiés « en cours » : au moins la moitié de l'équipe doit être diplômée, et au plus 20 % sans qualification."}]
            a_faire.append((url, f"Stagiaire BAFA {nom} ({code}) : accueillir un stagiaire", f"Accueillir un stagiaire BAFA {a_}",
                            f"Accueillir un stagiaire BAFA {a_} ({code}) : les sessions du département, les règles du stage pratique, le tutorat et l'offre de stage gratuite.",
                            f"Des stagiaires BAFA cherchent leur stage pratique {a_} : comment les trouver et bien les accueillir.",
                            {"public": "struct", "sur": f"Structures · {nom} ({code})", "chiffres": [(len(f_dep), "sessions de formation générale"), (org_n, "organismes de formation")],
                             "actions": [("Publier une offre de stage", "/compte/?inscription=1&role=structure", True)], "blocs": blocs},
                            faq, [REC, ("Accueillir un stagiaire", "/recruter/stagiaire-bafa/"), (nom, url)], True, ("struct", "stagiaire"), nom))

            # ---------------- parents : centre de loisirs
            url = f"/enfants/centre-de-loisirs/{d['slug']}/"
            caf = f"La CAF {de} aide souvent les familles pour les accueils de loisirs (tarif selon le quotient familial, aides aux vacances) : regardez votre compte CAF ou demandez à la mairie."
            blocs = [{"titre": f"Les accueils de loisirs en ligne {a_}", "sejours": [carte_sj(x) for x in sj_acc[:10]], "large": True,
                      "vide": None if sj_acc else f"Pas encore d'accueil de loisirs publié {a_}. Décrivez ce que vous cherchez (âge, mercredis ou vacances, ville) : votre demande part chez les structures les plus proches, qui vous répondent.",
                      "lien": ("Décrire mon besoin", "/enfants/demande/")},
                     {"titre": f"Les structures {de}", "structures": [carte_st(x) for x in (st_acc or st_dep)[:10]],
                      "vide": None if (st_acc or st_dep) else "Les structures du département arrivent sur le site."},
                     {"titre": "Comment ça marche", "points": [("Pour qui :", "les enfants de 3 à 17 ans, le plus souvent 3-11 ans, les mercredis et pendant les vacances."),
                                                                ("L'inscription :", "auprès de la mairie ou de l'association, souvent par période ; les places partent vite avant l'été."),
                                                                ("Le prix :", "selon le quotient familial dans la plupart des communes."), ("Les aides :", caf)]},
                     {"titre": "Qui encadre vos enfants", "points": taux[:1] + taux[2:] + ["Chaque accueil est déclaré au service départemental de la jeunesse (SDJES), qui peut le contrôler."]}]
            if vac:
                blocs.append({"titre": f"Les vacances {a_} (zone {d['zone']})", "vacances": vac})
            faq = [{"q": "À partir de quel âge en centre de loisirs ?", "r": "Dès 3 ans, quand l'enfant est scolarisé, et jusqu'à 17 ans selon les accueils (souvent jusqu'à 11 ou 12 ans, avec des accueils ados à part)."},
                   {"q": "Combien coûte un centre de loisirs ?", "r": "Le prix dépend de la commune et du quotient familial : de quelques euros à une vingtaine d'euros la journée, repas compris le plus souvent."},
                   {"q": "Comment trouver une place ?", "r": "Inscrivez-vous tôt auprès de la mairie ou de l'association. Sur Fil Roug'Anim, décrivez votre besoin : les structures proches vous répondent."}]
            a_faire.append((url, f"Centre de loisirs {nom} ({code}) : mercredis et vacances", f"Centres de loisirs {a_}",
                            f"Centres de loisirs {a_} ({code}) : les accueils pour les mercredis et les vacances, les structures vérifiées, le prix, les aides de la CAF et les dates des vacances de la zone {d['zone']}.",
                            f"Les mercredis et les vacances de vos enfants {a_} : les accueils de loisirs, comment s'inscrire, les aides, et qui encadre.",
                            {"public": "parent", "sur": f"Parents · {nom} ({code})", "chiffres": [(len(sj_acc), "accueils en ligne"), (len(st_acc or st_dep), "structures vérifiées")],
                             "actions": [("Décrire mon besoin", "/enfants/demande/", True), ("Voir toutes les offres", "/enfants/", False)], "blocs": blocs},
                            faq, [ENF, ("Centres de loisirs", "/enfants/centre-de-loisirs/"), (nom, url)], True, ("parent", "loisirs"), nom))

            # ---------------- parents : colonies de vacances
            url = f"/enfants/colonie-de-vacances/{d['slug']}/"
            sj_nuits = [x for x in sj_depart if not x["type"].startswith("accueil")]
            pc = (self.donnees.get("aides") or {}).get("pass_colo") or {}
            blocs = [{"titre": f"Les colos au départ {de} ou {a_}", "sejours": [carte_sj(x) for x in sj_nuits[:10]], "large": True,
                      "vide": None if sj_nuits else f"Pas encore de séjour publié au départ {de}. Toutes les colos de France sont dans « Inscrire mon enfant », et vous pouvez décrire votre besoin pour recevoir des propositions.",
                      "lien": ("Toutes les colos", "/enfants/")},
                     {"titre": "Les aides pour partir", "paras": [pc.get("texte") or "Le Pass Colo aide les enfants de 11 ans à partir en colo.", caf.replace("les accueils de loisirs", "les colos")],
                      "lien": ("Le guide des aides et le calculateur", "/enfants/aides/")},
                     {"titre": "Bien choisir une colo", "points": [("Un séjour déclaré :", "chaque colo est déclarée au service de la jeunesse ; demandez le numéro de déclaration."),
                                                                  ("L'équipe :", "un directeur BAFD ou diplômé, un animateur pour 12 enfants de 6 ans et plus."),
                                                                  ("Le transport :", "regardez la ville de départ et ce qui est compris dans le prix."),
                                                                  ("Les nouvelles :", "sur Fil Roug'Anim, l'équipe peut tenir un carnet de séjour : vous recevez les nouvelles de la journée.")]}]
            if vac:
                blocs.append({"titre": f"Les vacances de la zone {d['zone']}", "vacances": vac})
            faq = [{"q": "À quel âge partir en colo ?", "r": "Dès 4 ou 6 ans pour des mini-séjours, plus souvent à partir de 6 ans, et jusqu'à 17 ans avec des séjours ados."},
                   {"q": "Combien coûte une colo ?", "r": "Selon la durée, l'activité et le transport : quelques centaines d'euros la semaine le plus souvent. Les aides (Pass Colo, CAF, CSE, mairie) réduisent beaucoup le reste à payer."},
                   {"q": "Comment avoir des nouvelles pendant la colo ?", "r": "Demandez à l'organisateur comment il donne des nouvelles. Avec un espace parent sur Fil Roug'Anim, vous recevez le carnet de séjour écrit par l'équipe."}]
            a_faire.append((url, f"Colonie de vacances {nom} ({code}) : colos au départ {de}", f"Colonies de vacances {a_}",
                            f"Colonies de vacances au départ {de} ({code}) : les séjours publiés, le Pass Colo et les aides de la CAF, bien choisir, et les dates des vacances de la zone {d['zone']}.",
                            f"Les colos pour vos enfants au départ {de} ou {a_} : les séjours, les aides pour partir et ce qu'il faut vérifier.",
                            {"public": "parent", "sur": f"Parents · {nom} ({code})", "chiffres": [(len(sj_nuits), "séjours au départ du département"), (len(sej), "séjours en France")],
                             "actions": [("Voir les colos", "/enfants/", True), ("Les aides pour partir", "/enfants/aides/", False)], "blocs": blocs},
                            faq, [ENF, ("Colonies de vacances", "/enfants/colonie-de-vacances/"), (nom, url)], True, ("parent", "colo"), nom))

            # ---------------- parents : périscolaire
            url = f"/enfants/periscolaire/{d['slug']}/"
            sj_peri = [x for x in sej if x["type"] == "accueil_periscolaire" and x.get("departement") == code]
            blocs = [{"titre": f"Le périscolaire {a_}", "sejours": [carte_sj(x) for x in sj_peri[:10]], "large": True,
                      "vide": None if sj_peri else "Le périscolaire est organisé par la mairie (ou une association qu'elle choisit) : l'inscription se fait auprès d'elle. Vous cherchez autre chose ? Décrivez votre besoin.",
                      "lien": ("Décrire mon besoin", "/enfants/demande/")},
                     {"titre": "Comment ça marche", "points": [("Les temps :", "le matin avant la classe, la pause du midi, le soir après la classe, et souvent le mercredi."),
                                                              ("L'inscription :", "à la mairie ou sur son portail famille, en général avant la rentrée."),
                                                              ("Le prix :", "selon le quotient familial dans la plupart des communes.")]},
                     {"titre": "Qui encadre vos enfants", "points": [taux[1], taux[2]]},
                     {"titre": f"Les structures {de}", "structures": [carte_st(x) for x in (st_acc or st_dep)[:8]],
                      "vide": None if (st_acc or st_dep) else "Les structures du département arrivent sur le site."}]
            faq = [{"q": "Qui organise le périscolaire ?", "r": "La commune, directement ou par une association ; l'accueil est déclaré au service départemental de la jeunesse quand il est un accueil collectif de mineurs."},
                   {"q": "Le périscolaire est-il obligatoire ?", "r": "Non : c'est un service proposé aux familles, en plus du temps de classe."}]
            a_faire.append((url, f"Périscolaire {nom} ({code}) : matin, midi, soir et mercredi", f"Le périscolaire {a_}",
                            f"Périscolaire {a_} ({code}) : comment ça marche, l'inscription, le prix, les taux d'encadrement et les structures vérifiées du département.",
                            f"L'accueil du matin, du midi et du soir pour vos enfants {a_} : qui l'organise, comment s'inscrire, qui encadre.",
                            {"public": "parent", "sur": f"Parents · {nom} ({code})", "chiffres": [(len(sj_peri), "accueils périscolaires en ligne"), (len(st_acc or st_dep), "structures vérifiées")],
                             "actions": [("Décrire mon besoin", "/enfants/demande/", True)], "blocs": blocs},
                            faq, [ENF, ("Périscolaire", "/enfants/periscolaire/"), (nom, url)], True, ("parent", "peri"), nom))

        # ---------------- les régions : job d'été (animateurs), saisonniers (structures)
        an_ete = auj.year if auj.month <= 8 else auj.year + 1
        for r in self.regions.values():
            ds = par_reg.get(r["id"]) or []
            codes = {x["code"] for x in ds}
            o_r = [o for o in self.offres if o["departement"] in codes]
            st_r = [st for st in structures if st["departement"] in codes]
            f_r = fg([s for s in bafa if s["departement"] in codes])
            url = f"/trouver-un-poste/job-ete-animateur/{r['slug']}/"
            blocs = [{"titre": f"Les offres pour l'été {r['a']}", "offres": o_r[:10], "large": True,
                      "vide": None if o_r else f"Les offres de l'été {an_ete} arrivent surtout de janvier à mai. Créez votre profil dès maintenant : les structures {r['a']} peuvent vous écrire.",
                      "lien": ("Créer mon profil", "/compte/?inscription=1&role=candidat")},
                     {"titre": "Département par département", "points": [(x["nom"], f"({x['code']}) : " + un(len([o for o in o_r if o["departement"] == x["code"]]), "offre") + ", " + un(len([st for st in st_r if st["departement"] == x["code"]]), "structure")) for x in sorted(ds, key=lambda x: x["code"])]},
                     {"titre": "Le contrat d'un job d'été en colo", "paras": [cee]},
                     {"titre": f"Passer le BAFA avant l'été {r['a']}", "sessions": [s for s in f_r if s["debut"] < dt.date(an_ete, 7, 1)][:5],
                      "paras": [f"{un(len(f_r), 'session')} de formation générale à venir {r['a']}."], "lien": (f"Les sessions BAFA {r['a']}", f"/se-former/sessions/{r['slug']}/")}]
            a_faire.append((url, f"Job d'été animateur {r['nom']} {an_ete} : colos et centres de loisirs", f"Job d'été d'animateur {r['a']}",
                            f"Job d'été {an_ete} comme animateur {r['a']} : les offres en colo et en centre de loisirs, les structures par département, le contrat CEE et le BAFA avant l'été.",
                            f"Colo, centre de loisirs, séjour itinérant : trouver un job d'été d'animateur {r['a']} pour l'été {an_ete}.",
                            {"public": "anim", "sur": f"Été {an_ete} · {r['nom']}", "chiffres": [(len(o_r), "offres en ligne"), (len(st_r), "structures vérifiées"), (len(ds), "départements")],
                             "actions": [("Créer mon profil", "/compte/?inscription=1&role=candidat", True), ("Voir les offres", "/trouver-un-poste/offres/", False)], "blocs": blocs},
                            [], [TP, ("Job d'été animateur", "/trouver-un-poste/job-ete-animateur/"), (r["nom"], url)], True, ("anim", "ete"), r["nom"]))
            url = f"/recruter/saisonniers-ete/{r['slug']}/"
            blocs = [{"titre": f"Le vivier {r['a']}", "paras": [f"{un(len(f_r), 'session')} de formation générale BAFA à venir {r['a']} : autant de stagiaires à la recherche d'un stage pratique.", "Les animateurs créent leur profil gratuit avec leurs disponibilités de l'été : vous les consultez et leur écrivez directement."], "sessions": f_r[:3]},
                     {"titre": "Le bon calendrier", "points": [("Janvier-février :", "publiez vos offres de l'été, les meilleurs profils partent tôt."), ("Mars-avril :", "entretiens, réunion de préparation avec l'équipe."), ("Mai-juin :", "derniers postes, stagiaires BAFA, remplacements.")]},
                     {"titre": "Les taux d'encadrement", "points": taux},
                     {"titre": "Département par département", "points": [(x["nom"], f"({x['code']}) : " + un(len(fg([s for s in bafa if s["departement"] == x["code"]])), "session BAFA") + ", " + un(len([st for st in st_r if st["departement"] == x["code"]]), "structure présente")) for x in sorted(ds, key=lambda x: x["code"])]}]
            a_faire.append((url, f"Recruter des animateurs pour l'été {an_ete} {r['a']}", f"Recruter votre équipe d'été {r['a']}",
                            f"Recruter des animateurs et des directeurs pour l'été {an_ete} {r['a']} : le vivier BAFA, le calendrier, les taux d'encadrement et une offre gratuite.",
                            f"Colos et accueils de loisirs {r['a']} : constituer votre équipe d'été {an_ete} à temps.",
                            {"public": "struct", "sur": f"Structures · été {an_ete}", "chiffres": [(len(f_r), "sessions BAFA à venir"), (len(st_r), "structures présentes")],
                             "actions": [("Publier une offre gratuite", "/compte/?inscription=1&role=structure", True)], "blocs": blocs},
                            [], [REC, ("Saisonniers d'été", "/recruter/saisonniers-ete/"), (r["nom"], url)], True, ("struct", "ete"), r["nom"]))

        # ---------------- les villes : animateur à …, centre de loisirs à … (communes où le BAFA se forme, et grandes villes)
        par_ville = collections.defaultdict(list)
        for s in bafa:
            par_ville[(s["departement"], sans_cedex(s["ville"]))].append(s)
        cibles = {k for k, l in par_ville.items() if len(l) >= 3}
        cibles |= {(v["dep"], v["nom"]) for v in self.donnees["territoire"].get("grandes_villes", []) if v["dep"] in self.departements}
        vus = set()
        for code, ville in sorted(cibles):
            sl = slug(ville)
            d = self.departements[code]
            if (code, sl) in vus or sl == d["slug"]:
                continue
            vus.add((code, sl))
            pt = self.geo.get(f"{code}|{ville}") or self.centres_dep.get(code)
            proches = sorted([s for s in fg(bafa) if dist(pt, self.geo.get(f"{s['departement']}|{s['ville']}") or self.centres_dep.get(s["departement"])) <= 25], key=lambda s: s["debut"])
            o_v = sorted([o for o in self.offres if o["departement"] == code], key=lambda o: o["ville"] != ville)
            st_v = sorted([st for st in structures if st["departement"] == code], key=lambda st: st["ville"] != ville)
            sj_v = [x for x in sej if x["type"].startswith("accueil") and x.get("departement") == code]
            ici = [s for s in proches if sans_cedex(s["ville"]) == ville]
            vac = vacances(d)
            url = f"/trouver-un-poste/emploi-animateur/{d['slug']}/{sl}/"
            blocs = [{"titre": f"Les offres d'animation à {ville} et {d['a']}", "offres": o_v[:8], "large": True,
                      "vide": None if o_v else f"Pas d'offre en ligne autour de {ville} aujourd'hui. Décrivez le poste que vous cherchez : votre demande part chez les structures les plus proches.",
                      "lien": ("Décrire ce que je cherche", "/trouver-un-poste/demande/")},
                     {"titre": f"Les structures autour de {ville}", "structures": [carte_st(x) for x in st_v[:10]],
                      "vide": None if st_v else f"Pensez au service enfance-jeunesse de la mairie de {ville} : c'est souvent le premier employeur d'animateurs de la commune (accueil de loisirs, périscolaire)."},
                     {"titre": f"Passer le BAFA à {ville} ou à moins de 25 km", "sessions": proches[:6],
                      "paras": [f"{un(len(ici), 'session')} de formation générale à {ville} même, {un(len(proches), 'session')} à moins de 25 km." if proches else f"Pas de session relevée près de {ville} pour l'instant."],
                      "lien": (f"Les sessions BAFA {d['a']}", f"/se-former/sessions/{d['slug']}/")},
                     {"titre": "Le contrat et la paie", "paras": [cee]}]
            if vac:
                blocs.append({"titre": f"Les vacances à {ville} (zone {d['zone']})", "vacances": vac})
            a_faire.append((url, f"Animateur à {ville} ({code}) : emploi, stage BAFA, offres", f"Animateur à {ville}",
                            f"Devenir ou travailler comme animateur à {ville} ({d['nom']}) : offres, structures du secteur, sessions BAFA à moins de 25 km, contrat et vacances de la zone {d['zone']}.",
                            f"Centre de loisirs, périscolaire, colo : trouver un poste ou un stage d'animateur à {ville} et autour.",
                            {"public": "anim", "sur": f"Animateurs · {ville}", "chiffres": [(len(o_v), f"offres {d['a']}"), (len(proches), "sessions BAFA à moins de 25 km")],
                             "actions": [("Créer mon profil", "/compte/?inscription=1&role=candidat", True), ("Décrire ce que je cherche", "/trouver-un-poste/demande/", False)], "blocs": blocs},
                            [], [TP, ("Emploi animateur", "/trouver-un-poste/emploi-animateur/"), (d["nom"], f"/trouver-un-poste/emploi-animateur/{d['slug']}/"), (ville, url)], True, ("anim", "ville:" + code), ville))
            url = f"/enfants/centre-de-loisirs/{d['slug']}/{sl}/"
            blocs = [{"titre": f"Les accueils de loisirs autour de {ville}", "sejours": [carte_sj(x) for x in sorted(sj_v, key=lambda x: x.get("ville") != ville)[:10]], "large": True,
                      "vide": None if sj_v else f"Pas encore d'accueil de loisirs publié autour de {ville}. Le service enfance de la mairie de {ville} vous renseigne ; ou décrivez votre besoin ici, les structures proches vous répondent.",
                      "lien": ("Décrire mon besoin", "/enfants/demande/")},
                     {"titre": f"Les structures {d['de']}", "structures": [carte_st(x) for x in st_v[:8]],
                      "vide": None if st_v else f"Les structures {d['de']} arrivent sur le site. En attendant, votre demande « Décrire mon besoin » part chez les plus proches de {ville}."},
                     {"titre": "Les aides", "paras": [f"La CAF {d['de']} et la mairie de {ville} aident souvent les familles : tarif selon le quotient familial, aides aux vacances, parfois une participation pour les colos.",
                                                      "Pour une colo, le Pass Colo aide les enfants de 11 ans : jusqu'à 350 € selon le quotient familial."],
                      "lien": ("Le guide des aides et le calculateur", "/enfants/aides/")},
                     {"titre": "Comment ça marche", "points": [("Pour qui :", "les enfants de 3 à 17 ans, les mercredis et pendant les vacances."),
                                                              ("L'inscription :", f"auprès de la mairie de {ville} ou de l'association qui gère l'accueil, souvent par période."),
                                                              ("Le prix :", "selon le quotient familial dans la plupart des communes ; la CAF peut aider.")]},
                     {"titre": "Qui encadre vos enfants", "points": taux[:1] + taux[2:]}]
            if vac:
                blocs.append({"titre": f"Les vacances à {ville}", "vacances": vac})
            a_faire.append((url, f"Centre de loisirs à {ville} : mercredis et vacances", f"Centre de loisirs à {ville}",
                            f"Centre de loisirs à {ville} ({d['nom']}) : les accueils pour les mercredis et les vacances, l'inscription, le prix, l'encadrement et les vacances de la zone {d['zone']}.",
                            f"Les mercredis et les vacances de vos enfants à {ville} : les accueils de loisirs, comment s'inscrire et qui encadre.",
                            {"public": "parent", "sur": f"Parents · {ville}", "chiffres": [(len(sj_v), "accueils en ligne"), (len(st_v), "structures vérifiées")],
                             "actions": [("Décrire mon besoin", "/enfants/demande/", True), ("Voir toutes les offres", "/enfants/", False)], "blocs": blocs},
                            [], [ENF, ("Centres de loisirs", "/enfants/centre-de-loisirs/"), (d["nom"], f"/enfants/centre-de-loisirs/{d['slug']}/"), (ville, url)], True, ("parent", "ville:" + code), ville))

        # ---------------- les liens entre pages : même sujet ailleurs, autres sujets ici, et les pages d'index
        par_cle = collections.defaultdict(list)
        for x in a_faire:
            par_cle[x[9]].append((x[10], x[0]))
        SUJETS = {("anim", "emploi"): "Emploi animateur", ("anim", "stage"): "Stage pratique BAFA", ("anim", "direction"): "Emploi directeur",
                  ("struct", "animateurs"): "Recruter des animateurs", ("struct", "directeur"): "Recruter un directeur", ("struct", "stagiaire"): "Accueillir un stagiaire",
                  ("parent", "loisirs"): "Centre de loisirs", ("parent", "colo"): "Colonie de vacances", ("parent", "peri"): "Périscolaire"}
        BASES = {("anim", "emploi"): "/trouver-un-poste/emploi-animateur/", ("anim", "stage"): "/trouver-un-poste/stage-pratique-bafa/", ("anim", "direction"): "/trouver-un-poste/emploi-directeur/",
                 ("struct", "animateurs"): "/recruter/animateurs-bafa/", ("struct", "directeur"): "/recruter/directeur-bafd/", ("struct", "stagiaire"): "/recruter/stagiaire-bafa/",
                 ("parent", "loisirs"): "/enfants/centre-de-loisirs/", ("parent", "colo"): "/enfants/colonie-de-vacances/", ("parent", "peri"): "/enfants/periscolaire/",
                 ("anim", "ete"): "/trouver-un-poste/job-ete-animateur/", ("struct", "ete"): "/recruter/saisonniers-ete/"}
        for (url, titre, h1, desc, intro, local, faq, fil, idx, cle, nom) in a_faire:
            pub = cle[0]
            dslug = url.rstrip("/").split("/")[3] if len(url.rstrip("/").split("/")) > 3 else None
            d = next((x for x in deps if x["slug"] == dslug), None)
            vz = []
            if d and not cle[1].startswith("ville"):
                base = BASES[cle]
                vz.append(("Dans les départements voisins", [(f"{x['nom']} ({x['code']})", f"{base}{x['slug']}/") for x in voisins[d["code"]]]))
                vz.append((f"Aussi {d['a']}", [(SUJETS[k], f"{BASES[k]}{d['slug']}/") for k in SUJETS if k[0] == pub and k != cle]
                           + ([("Les sessions BAFA", f"/se-former/sessions/{d['slug']}/")] if pub != "parent" else [("Les aides pour partir", "/enfants/aides/")])))
                vz.append(("Les villes", [(n, u) for n, u in par_cle.get((pub, "ville:" + d["code"]), [])][:16]))
            elif d:
                vz.append((f"{d['nom']}", [(SUJETS[k], f"{BASES[k]}{d['slug']}/") for k in SUJETS if k[0] == pub]))
                vz.append(("Les autres villes du département", [(n, u) for n, u in par_cle.get(cle, []) if u != url][:16]))
            else:
                vz.append(("Les autres régions", [(n, u) for n, u in par_cle.get(cle, []) if u != url]))
            local["voisins"] = vz
            for q in faq:
                q["r_rendu"] = q["r"]
            lieu = {"n": nom, "g": "ville", "d": d["code"]} if cle[1].startswith("ville") and d else ({"n": d["nom"], "g": "departement", "d": d["code"]} if d else {"n": nom, "g": "region", "d": ""})
            # une page locale n'est proposée à Google que si elle a du contenu propre au lieu (offre, structure, séjour) :
            # sans cela, elle ressemble à 90 % à celle du département voisin et Google la laisse de côté (« Détectée, non indexée »).
            # Elle reste en ligne et revient d'elle-même dans le plan du site dès qu'une offre, une structure ou un séjour y arrive.
            # Les pages que Google a déjà indexées restent dans le plan du site (donnees/pages-indexees.txt).
            if idx and d and url not in self.deja_indexees():
                idx = any(x for b in local.get("blocs") or [] for k in ("offres", "structures", "sejours")
                          for x in (b.get(k) or []) if not (isinstance(x, dict) and x.get("exemple")))
            self.ajouter(url, "local.html", titre=titre, h1=h1, description=desc[:300], intro=intro, local=local, indexer=idx,
                         faq_page=faq or None, schema_faq=self.schema_faq(faq) if faq else None, fil=fil, lieu=lieu)
        # les pages d'index : un sujet, tous les départements (ou toutes les régions), rangés par région
        for cle, base in BASES.items():
            pub = cle[0]
            liens = par_cle.get(cle, [])
            if not liens:
                continue
            titre = SUJETS.get(cle) or ("Job d'été animateur" if cle == ("anim", "ete") else "Saisonniers d'été")
            groupes = []
            if cle[1] == "ete":
                groupes = [("Par région", liens)]
            else:
                for r in sorted(self.regions.values(), key=lambda r: r["nom"]):
                    ls = [(f"{x['nom']} ({x['code']})", f"{base}{x['slug']}/") for x in sorted(par_reg.get(r["id"]) or [], key=lambda x: x["code"])]
                    if ls:
                        groupes.append((r["nom"], ls))
            local = {"public": pub, "sur": {"anim": "Animateurs & directeurs", "struct": "Structures", "parent": "Inscrire mon enfant"}[pub], "chiffres": [],
                     "actions": [], "blocs": [], "voisins": groupes}
            fil0 = {"anim": TP, "struct": REC, "parent": ENF}[pub]
            self.ajouter(base, "local.html", titre=f"{titre} : toute la France, département par département", h1=f"{titre}, partout en France",
                         description=f"{titre} : choisissez votre département ou votre région pour voir les offres, les structures et les informations utiles près de chez vous.",
                         intro="Choisissez votre département : chaque page rassemble ce qui existe près de chez vous.", local=local, fil=[fil0, (titre, base)])
        self.pages_locales_liens = {k: BASES[k] for k in BASES}

    def frise_ete(self, sejours):
        """La frise de l'été sur la page structure : juillet et août, chaque date placée en pourcentage de la largeur."""
        dates = [(sj, d) for sj in sejours if sj["type"] not in ("accueil_mercredis", "accueil_periscolaire") for d in sj["a_venir"] if d["debut"].month in (7, 8) or d["fin"].month in (7, 8)]
        if not dates:
            return None
        an = dates[0][1]["debut"].year
        debut, fin = dt.date(an, 7, 1), dt.date(an, 8, 31)
        total = (fin - debut).days + 1
        lignes = []
        for sj, d in dates:
            if d["debut"].year != an:
                continue
            a, b = max(d["debut"], debut), min(d["fin"], fin)
            lignes.append({"titre": sj["titre"], "url": sj["url"], "age": f"{sj['age_min']}-{sj['age_max']} ans",
                           "g": round((a - debut).days / total * 100, 2), "l": max(2.5, round(((b - a).days + 1) / total * 100, 2)),
                           "complet": bool(d.get("complet") or d.get("places_restantes") == 0), "dates": f"{d['debut'].day}/{d['debut'].month:02d} → {d['fin'].day}/{d['fin'].month:02d}"})
        semaines = [{"g": round(((dt.date(an, 7, 1) + dt.timedelta(days=7 * i)) - debut).days / total * 100, 2),
                     "t": f"{(dt.date(an, 7, 1) + dt.timedelta(days=7 * i)).day}/{(dt.date(an, 7, 1) + dt.timedelta(days=7 * i)).month:02d}"} for i in range(9)]
        return {"an": an, "lignes": lignes[:16], "semaines": semaines, "aout": round(31 / total * 100, 2)} if lignes else None

    def carte_sejour(self, sj):
        """Ce que la recherche de /enfants/ garde d'un séjour (statique/js/sejours.js) : de quoi filtrer et dessiner la carte."""
        pc = (((self.donnees.get("aides") or {}).get("regles") or {}).get("pass_colo") or {})
        d0 = sj["a_venir"][0] if sj.get("a_venir") else None
        pass_ok = "pass_colo" in (sj.get("aides") or []) and not sj["type"].startswith("accueil") and d0 and (d0["fin"] - d0["debut"]).days + 1 >= pc.get("duree_min", 5)
        return {"u": sj["url"], "t": sj["titre"], "ty": sj["type"], "a": [sj["age_min"], sj["age_max"]], "e": sj.get("envies") or [],
                "d": [[x["debut"].isoformat(), x["fin"].isoformat(), x.get("places_restantes"), bool(x.get("complet"))] for x in sj["a_venir"][:12]],
                "v": sj.get("ville") or "", "dep": sj.get("departement") or "", "p": sj.get("pays") or "FR", "r": sj.get("region_dest") or "",
                "tr": [t.get("ville") for t in sj.get("transport") or [] if t.get("ville")], "px": sj.get("prix_min"), "pu": sj.get("prix_unite") or "sejour",
                "ai": sj.get("aides") or [], "pc": (max([b["montant"] for b in pc.get("baremes", [])] or [0]) if pass_ok else None),
                "ph": (sj.get("photos") or [None])[0], "s": sj["structure"]["nom"], "une": bool(sj["structure"].get("abonnee")), "ex": bool(sj.get("exemple"))}

    def page_catalogue_sejours(self):
        """/enfants/ : la recherche en gros boutons, sur tous les séjours à venir. Indexée à partir de 3 offres."""
        cartes = [self.carte_sejour(sj) for sj in self.sejours if sj["a_venir"]]
        ex = next((p["sejour"] for p in self.pages if p["url"] == "/enfants/exemple/"), None)
        self.ajouter("/enfants/", "sejours.html", titre="Inscrire mon enfant : colos, accueils de loisirs et périscolaire",
                     h1="Inscrire mon enfant", indexer=len(cartes) >= 3, cartes=cartes, deps_noms={c: d["nom"] for c, d in self.departements.items()}, exemple=self.carte_sejour(ex) if ex else None,
                     description="Colos, mini-séjours et accueils de loisirs pour les 3-17 ans : cherchez par âge, période et envies, voyez les aides (Pass Colo, VACAF) et demandez une place en ligne, sans frais.",
                     fil=[("Inscrire mon enfant", "/enfants/")])
        self.ajouter("/enfants/demande/", "enfants-demande.html", titre="Décrivez ce que vous cherchez pour votre enfant",
                     description="Accueil de loisirs, périscolaire, colo : décrivez ce que vous cherchez pour votre enfant, votre demande part chez les structures vérifiées de votre secteur, qui vous répondent. Gratuit, sans compte.",
                     fil=[("Inscrire mon enfant", "/enfants/"), ("Décrire mon besoin", "/enfants/demande/")])
        self.ajouter("/enfants/aides/", "sejours-aides.html", titre="Pass Colo, CAF, VACAF : les aides pour partir en colo",
                     description="Pass Colo (jusqu'à 350 € pour les 11 ans), aide aux vacances de la CAF, Chèques-Vacances, CSE, mairie : qui y a droit, combien, et un calculateur du reste à payer.",
                     fil=[("Inscrire mon enfant", "/enfants/"), ("Les aides", "/enfants/aides/")])
        self.ajouter("/recruter/sejours/", "recruter-sejours.html", titre="Publiez vos séjours et accueils de loisirs gratuitement",
                     description="Colos, mini-séjours, accueils de loisirs : publiez-les gratuitement sur Fil Roug'Anim. Les familles cherchent par âge et par période et vous demandent une place en ligne. Sans commission.",
                     fil=[("Structures", "/recruter/"), ("Vos séjours", "/recruter/sejours/")])
        self.ajouter("/enfants/carnet/", "enfants-carnet.html", titre="Carnet de séjour : la nouvelle du jour", indexer=False,
                     description="Pour l'équipe d'un séjour : écrire la nouvelle du jour aux familles.", fil=[("Inscrire mon enfant", "/enfants/"), ("Carnet de séjour", "/enfants/carnet/")])
        self.ajouter("/enfants/alerte/", "sejours-alerte.html", titre="Votre alerte séjours", indexer=False,
                     description="Confirmer ou arrêter une alerte de nouveaux séjours.", fil=[("Inscrire mon enfant", "/enfants/"), ("Alerte", "/enfants/alerte/")])

    def titre_sejour(self, sj):
        lieu = sj.get("ville") or sj.get("region_dest") or ""
        return f"{sj['titre']} : {SEJ_TYPES[sj['type']][0].lower()} {sj['age_min']}-{sj['age_max']} ans" + (f" à {lieu}" if lieu else "")

    def desc_sejour(self, sj):
        d = sj["a_venir"][0] if sj.get("a_venir") else None
        morceaux = [f"{SEJ_TYPES[sj['type']][0]} pour les {sj['age_min']}-{sj['age_max']} ans"]
        if d:
            morceaux.append(f"du {d['debut'].day}/{d['debut'].month:02d} au {d['fin'].day}/{d['fin'].month:02d}/{d['fin'].year}")
        if sj.get("prix_min") is not None:
            morceaux.append(f"dès {sj['prix_min']:g} €")
        tete = (sj.get("accroche").rstrip(".") + ". ") if sj.get("accroche") else ""
        return (tete + ", ".join(morceaux) + f", par {sj['structure']['nom']}. Demandez une place en ligne.")[:300]

    def schema_sejour(self, sj):
        """Données structurées Event, une par date à venir (Google)."""
        url = self.config["url"].rstrip("/") + sj["url"]
        lieu = {"@type": "Place", "name": sj.get("ville") or sj.get("region_dest") or sj["structure"]["ville"],
                "address": {"@type": "PostalAddress", "addressLocality": sj.get("ville") or sj.get("region_dest") or "", "addressCountry": sj.get("pays") or "FR"}}
        evts = []
        for d in sj["a_venir"][:6]:
            e = {"@context": "https://schema.org", "@type": "Event", "name": sj["titre"], "description": (sj.get("accroche") or sj.get("description") or "")[:300],
                 "startDate": d["debut"].isoformat(), "endDate": d["fin"].isoformat(), "eventStatus": "https://schema.org/EventScheduled",
                 "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode", "location": lieu, "url": url,
                 "typicalAgeRange": f"{sj['age_min']}-{sj['age_max']}",
                 "organizer": {"@type": "Organization", "name": sj["structure"]["nom"], "url": self.config["url"].rstrip("/") + f"/trouver-un-poste/structures/{sj['structure']['slug']}/"}}
            if sj.get("photos"):
                e["image"] = [self.config["supabase"]["url"] + "/storage/v1/object/public/sejours/" + x for x in sj["photos"][:3]]
            if sj.get("prix_min") is not None:
                e["offers"] = {"@type": "Offer", "price": f"{sj['prix_min']:g}", "priceCurrency": "EUR", "url": url,
                               "availability": "https://schema.org/SoldOut" if d.get("complet") or d.get("places_restantes") == 0 else "https://schema.org/InStock"}
            evts.append(e)
        return json_ld(evts) if evts else ""

    def schema_offre(self, o):
        """Données structurées JobPosting (Google pour l'emploi)."""
        types = {"cee": "TEMPORARY", "cdd": "TEMPORARY", "cdi": "FULL_TIME", "stage-pratique": "INTERN",
                 "apprentissage": "OTHER", "benevole": "VOLUNTEER"}
        objet = {"@context": "https://schema.org", "@type": "JobPosting", "title": o["intitule"],
                 "description": paragraphes(o["texte"]) if o.get("brut") else convertir_markdown(o["texte"]), "datePosted": o["publiee_le"].isoformat(),
                 "validThrough": o["expire_le"].isoformat() + "T23:59", "employmentType": types.get(o["contrat"], "OTHER"),
                 "hiringOrganization": {"@type": "Organization", "name": o["structure"]["nom"],
                                        **({"sameAs": o["structure"]["site"]} if o["structure"].get("site") else {})},
                 "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "addressLocality": o["ville"],
                                 "addressRegion": o["dep"]["reg"]["nom"] if o.get("dep") else "France", "addressCountry": "FR"}},
                 "directApply": False}
        r = o.get("remuneration")
        if r and r.get("montant"):
            objet["baseSalary"] = {"@type": "MonetaryAmount", "currency": "EUR", "value": {
                "@type": "QuantitativeValue", "value": r["montant"],
                "unitText": {"jour": "DAY", "mois": "MONTH", "heure": "HOUR"}.get(r.get("unite"), "DAY")}}
        return json_ld(objet)

    def calculer_stats(self):
        """Chiffres affichés sur le site (prix min/max…), recalculés à chaque fabrication."""
        def fourchette(diplome, type_, formule):
            prix = [s["prix"] for s in self.sessions if s["diplome"] == diplome and s["type"] == type_
                    and s["formule"] == formule and s["prix"] is not None]
            return {"min": min(prix), "max": max(prix)} if prix else {"min": "?", "max": "?"}
        verif = [s["verifie_le"] for s in self.sessions if s["verifie_le"]]
        return {"fg_ext": fourchette("BAFA", "formation-generale", "externat"),
                "ap_ext": fourchette("BAFA", "approfondissement", "externat"),
                "nb": len(self.sessions),
                "nb_organismes": len({s["org"]["nom"] for s in self.sessions}),
                "nb_deps": len({s["departement"] for s in self.sessions}),
                "verifie_le": max(verif) if verif else None}

    def audience(self):
        """Les chiffres de visibilité (donnees/audience.yml), prêts pour l'affichage ; vide tant qu'aucune source n'est branchée."""
        a = self.donnees.get("audience") or {}
        c = dict(a.get("chiffres") or {})
        if not c:
            return {}
        if c.get("impressions_par_mois"):
            maxi = max(x["n"] for x in c["impressions_par_mois"]) or 1
            c["impressions_par_mois"] = [dict(x, nom=MOIS_COURTS[int(x["mois"][5:7]) - 1], h=round(100 * x["n"] / maxi))
                                         for x in c["impressions_par_mois"]]
        for x in c.get("dernieres_inscriptions") or []:
            dep = self.departements.get(x.get("departement") or "")
            x["lieu"] = dep["nom"] if dep else "France"
            x["quand"] = f"{MOIS_COURTS[int(x['mois'][5:7]) - 1]} {x['mois'][:4]}" if x.get("mois") else ""
        if c.get("impressions_par_mois") and c["impressions_par_mois"][-1]["mois"] == self.aujourdhui.strftime("%Y-%m"):
            c["impressions_par_mois"][-1]["en_cours"] = True  # le mois en cours n'est pas terminé
        if c.get("impressions_28j"):
            c["taux_clic"] = round(100 * (c.get("clics_28j") or 0) / c["impressions_28j"], 1)
        c["comptes"] = (c.get("animateurs") or 0) + (c.get("structures") or 0)
        c["mis_a_jour"] = en_date(a.get("mis_a_jour"))
        c["nb_tuiles"] = sum(1 for k in ("visiteurs_30j", "impressions_28j", "clics_28j") if c.get(k) is not None) + (1 if "animateurs" in c else 0)
        return c

    def ecoles_pro(self):
        """Diplômes pros : une fiche par école, par diplôme et par département (calculée une fois)."""
        if getattr(self, "_ecoles_pro", None) is not None:
            return self._ecoles_pro
        # Diplômes pros : la liste des écoles qui forment, toutes sources réunies (une école par diplôme et par
        # département) : les sessions datées, le calendrier national (FOROMES), le catalogue Mon Compte Formation.
        PRO = {"CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS"}
        def cle_nom(t):
            t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
            return re.sub(r"[^a-z0-9]+", "", re.sub(r"\b(association|formation|formations|organisme|l|la|le|les|de|des|du|d)\b", " ", t))
        fiches = {}
        def fiche(diplome, sp, dep, nom, ville=None):
            k = (cle_nom(nom), diplome, dep)
            f = fiches.get(k)
            if not f:
                d = self.departements[dep]
                spec = self.specialites.get(diplome, {}).get(sp)
                f = fiches[k] = {"di": diplome, "dn": self.diplomes[diplome]["nom"], "sp": sp, "spn": spec["nom"] if spec else None,
                                 "o": nom, "v": ville or d["nom"], "d": dep, "r": d["region"], "g": None,
                                 "pr": None, "pr_t": None, "dr": None, "px": None, "pxm": None, "h": None, "dist": False, "u": None, "cpf": False}
            if ville and f["v"] == self.departements[dep]["nom"]:
                f["v"] = ville
            if not f["sp"] and sp:
                f["sp"] = sp
            return f
        for x in self.sessions:  # les rentrées datées
            if x["diplome"] not in PRO or x["departement"] not in self.departements:
                continue
            f = fiche(x["diplome"], x.get("specialite"), x["departement"], x["org"]["nom"], ville_propre(x["ville"]))
            if not f["pr"] or x["debut"] < f["pr"]:
                f["pr"], f["pr_t"] = x["debut"], f"{MOIS[x['debut'].month - 1]} {x['debut'].year}"
                if x.get("url") and "foromes" not in x["url"]:
                    f["u"] = x["url"]
            if x.get("prix"):
                f["px"] = min(f["px"] or x["prix"], x["prix"])
            f["g"] = f["g"] or self.geo.get(f"{x['departement']}|{x['ville']}")
        for e in (self.donnees.get("ecoles-pro", {}) or {}).get("ecoles") or []:  # le calendrier national, l'année passée
            if e["diplome"] not in PRO or e["departement"] not in self.departements:
                continue
            f = fiche(e["diplome"], e.get("specialite"), e["departement"], e["organisme_nom"], ville_propre(e["ville"]))
            r = en_date(e["derniere_rentree"])
            f["dr"] = f"{MOIS[r.month - 1]} {r.year}"
            f["g"] = f["g"] or self.geo.get(f"{e['departement']}|{ville_propre(e['ville'])}")
        for c in (self.donnees.get("formations-cpf", {}) or {}).get("formations") or []:  # Mon Compte Formation
            if c["diplome"] not in PRO or c["departement"] not in self.departements:
                continue
            f = fiche(c["diplome"], c.get("specialite"), c["departement"], c["organisme_nom"])
            f["cpf"] = True
            if c.get("prix_min"):
                f["px"] = min(f["px"] or c["prix_min"], c["prix_min"])
                f["pxm"] = max(f["pxm"] or 0, c.get("prix_max") or c["prix_min"])
            f["h"] = f["h"] or c.get("heures")
            f["dist"] = f["dist"] or bool(c.get("distance"))
            if not f["u"] and c.get("siret"):
                f["u"] = f"https://annuaire-entreprises.data.gouv.fr/etablissement/{c['siret']}"
        ecoles = []
        for f in fiches.values():
            if not f["u"]:  # sans page connue : la recherche du nom de l'école
                f["u"] = "https://duckduckgo.com/?q=" + urllib.parse.quote(f"{f['o']} {f['dn']} {f['v']}")
                f["recherche"] = True
            f.pop("pr", None)
            ecoles.append(f)
        ecoles.sort(key=lambda f: (f["di"], f["d"], f["o"].lower()))
        self._ecoles_pro = ecoles
        return ecoles

    def villes_populaires(self, n=8):
        """Les grandes villes qui ont le plus de sessions (proposées quand on clique dans une case « Où ? »)."""
        compte = collections.Counter()
        for s in self.sessions:
            ville = re.sub(r"\s+\d+(er|e)$", "", s["ville"])
            compte[(ville, s["departement"])] += 1
        villes = [{"nom": v["nom"], "dep": v["dep"], "n": compte[(v["nom"], v["dep"])], "texte": f"{v['nom']} ({v['dep']})"}
                  for v in self.donnees["territoire"].get("grandes_villes", [])]
        return sorted([v for v in villes if v["n"]], key=lambda v: -v["n"])[:n]

    def calculer_filtres(self):
        """Les choix de la barre de recherche, d'après les sessions en ligne (spécialités présentes, budgets utiles)."""
        S = self.sessions
        etapes = []
        for d in self.diplomes.values():
            if d["etapes"]:
                noms = {t["id"]: t["nom"] for t in self.types}
                etapes.append({"diplome": d["id"], "titre": d["nom"],
                               "options": [(f"{d['id']}-{e}", noms.get(e, e.replace("-", " ").capitalize())) for e in d["etapes"]]})
            presentes = collections.Counter(s["specialite"] for s in S if s["diplome"] == d["id"] and s.get("specialite"))
            groupes = {}
            for sp in self.specialites.get(d["id"], {}).values():
                if presentes[sp["id"]]:
                    groupes.setdefault(sp["groupe"], []).append((f"{d['id']}-{sp['id']}", f"{sp['nom']} ({presentes[sp['id']]})"))
            for groupe, options in groupes.items():
                etapes.append({"diplome": d["id"], "titre": f"{d['nom']} · {groupe}", "options": sorted(options, key=lambda o: o[1])})
        budgets = []
        for di, paliers in BUDGETS.items():
            prix = sorted(s["prix"] for s in S if (s["diplome"] == di or not di) and s["prix"])
            if di and any(s["prix"] == 0 for s in S if s["diplome"] == di):
                budgets.append((di, 0, "Gratuit (apprentissage)"))
            if not prix:
                continue
            gardes = [b for b in paliers if prix[0] <= b < prix[-1]]
            plus_haut = next((b for b in paliers if b >= prix[-1]), None)
            for b in gardes + ([plus_haut] if plus_haut else []):
                budgets.append((di, b, "{:,}".format(b).replace(",", " ") + " € max."))
        vacances = []
        for p in self.periodes:
            base = p["id"].rsplit("-", 1)[0]
            if p["fin"] >= self.aujourdhui and base not in [v[0] for v in vacances]:
                vacances.append((base, p["court"].rsplit(" ", 1)[0]))
        lieux = []
        for v in self.donnees["territoire"].get("grandes_villes", []):
            lieux.append((f"{v['nom']} ({v['dep']})", f"v:{v['nom']}"))
            maxi = {"Paris": 20, "Lyon": 9, "Marseille": 16}.get(v["nom"])
            for n in range(1, (maxi or 0) + 1):
                lieux.append((f"{v['nom']} {n}{'er' if n == 1 else 'e'}", f"v:{v['nom']} {n}{'er' if n == 1 else 'e'}"))
        quand_mois, a, m = [], self.aujourdhui.year, self.aujourdhui.month
        for _ in range(12):
            quand_mois.append((f"{MOIS[m - 1].capitalize()} {a}", f"m:{m:02d}", str(a)))
            a, m = (a + 1, 1) if m == 12 else (a, m + 1)
        quand_vacances = [(p["court"], "v:" + p["id"].rsplit("-", 1)[0], p["id"].rsplit("-", 1)[1])
                          for p in self.periodes if p["fin"] >= self.aujourdhui]
        presentes = collections.Counter(s["formule"] for s in S if s.get("formule"))
        formules = [(k, v) for k, v in FORMULES.items() if presentes[k]]
        return {"etapes": etapes, "budgets": budgets, "vacances": vacances, "villes": lieux, "formules": formules,
                "quand": {"mois": quand_mois, "vacances": quand_vacances},
                "annees": [self.aujourdhui.year, self.aujourdhui.year + 1]}

    def schema_faq(self, questions):
        return json_ld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["r_rendu"]}}
            for q in questions]})

    def schema_sessions(self, sessions):
        """Données structurées schema.org (Course + CourseInstance) pour une liste de sessions."""
        objets = []
        for s in sessions:
            nom = f"{s['dipl']['nom']} – " + (s["sp"]["nom"] if s["sp"] else s["type_nom"]) + (f" : {s['theme']}" if s["theme"] else "")
            instance = {"@type": "CourseInstance", "courseMode": "Onsite",
                        "startDate": s["debut"].isoformat(),
                        "location": {"@type": "Place", "name": s["ville"],
                                     "address": {"@type": "PostalAddress", "addressLocality": s["ville"],
                                                 "addressRegion": s["dep"]["reg"]["nom"], "addressCountry": "FR"}}}
            if s["fin"]:
                instance["endDate"] = s["fin"].isoformat()
            objet = {"@context": "https://schema.org", "@type": "Course", "name": nom,
                     "description": f"Session de {s['dipl']['nom']} ({s['type_nom'].lower()}) organisée par {s['org']['nom']} à {s['ville']}, {dates_fr(s['debut'], s['fin'])}.",
                     "provider": {"@type": "Organization", "name": s["org"]["nom"], "sameAs": s["org"]["site"]},
                     "hasCourseInstance": instance}
            if s["prix"] is not None:
                objet["offers"] = {"@type": "Offer", "price": s["prix"], "priceCurrency": "EUR",
                                   "category": "Free" if s["prix"] == 0 else "Paid", "url": s["url"]}
            objets.append(objet)
        return json_ld(objets) if objets else ""

    # -- déclaration des pages
    def declarer(self):
        """Le site est rangé en 3 grandes parties ; chaque page traite un seul sujet, sous l'adresse de sa partie :
        /se-former/… (sessions, formations, guides du BAFA)  /trouver-un-poste/… (inscription, offres, stage, contrat)
        /recruter/ (publier une offre)  + accueil, à propos, contact, pages légales"""
        S = self.sessions
        bafa = [s for s in S if s["diplome"] == "BAFA"]
        SF = ("Se former", "/se-former/")
        RUB = ("Sessions", "/se-former/sessions/")

        for q in self.faq:
            q["r_rendu"] = " ".join(self.env.from_string(q["r"]).render(stats=self.stats).split())
        self.ajouter("/", "accueil.html",
                     titre="BAFA, stages et jobs de l'animation",
                     description="Se former, trouver un stage, recruter : les sessions BAFA et BAFD avec leurs dates et leurs prix, les offres de stages et de jobs, et des guides vérifiés. Gratuit pour les jeunes, sans compte.",
                     schema=None)

        self.ajouter("/chiffres/", "chiffres.html", titre="Les chiffres de Fil Roug'Anim",
                     description="Visiteurs, apparitions dans Google, comptes créés : les vrais chiffres de Fil Roug'Anim, mis à jour chaque jour.",
                     h1="Tous les chiffres, en clair",
                     intro="Visites, recherches Google, inscriptions : les vrais chiffres du site, mis à jour chaque jour et consultables par tout le monde.",
                     indexer=bool(self.audience().get("impressions_28j") is not None), fil=[("Les chiffres", "/chiffres/")])

        # ---- rubrique Sessions (France métropolitaine et Corse)
        self.ajouter("/se-former/sessions/", "sessions.html",
                     titre="Sessions BAFA, BAFD, PSC1, BPJEPS en France : dates et prix",
                     description="Comparez les sessions BAFA, BAFD, PSC1, BPJEPS et DEJEPS partout en France : dates, ville, formule et prix, organisme par organisme. Filtres par région, département, vacances, étape et budget.",
                     sessions=S[:30], sessions_total=len(S), fil=[SF, RUB])
        for p in self.periodes:
            liste = [s for s in bafa if s["periode"] is p]
            if liste:
                self.ajouter(f"/se-former/sessions/{p['slug']}/", "liste.html",
                             titre=f"BAFA {p['nom']} : dates et prix des sessions",
                             h1=f"BAFA pendant les {p['nom']}",
                             description=f"Les sessions BAFA des {p['nom']} partout en France : formation générale et approfondissement, ville, formule et prix.",
                             intro=f"Les dates des {p['nom']} dépendent de la zone : {self.dates_vacances(p)}. Chaque session est rattachée aux vacances de la zone où elle a lieu.",
                             sujet=("le BAFA", "BAFA", f"pendant les {p['nom']}"),
                             sessions=liste, periode=p, lien_tout=f"/se-former/sessions/?diplome=BAFA&mois=v:{p['id'].rsplit('-', 1)[0]}&annee={p['id'].rsplit('-', 1)[1]}",
                             fil=[SF, RUB, (p["court"], f"/se-former/sessions/{p['slug']}/")])
        for r in self.regions.values():
            de_la_region = [s for s in bafa if s["dep"]["reg"] is r]
            r["nb"] = len(de_la_region)
            self.ajouter(f"/se-former/sessions/{r['slug']}/", "liste.html",
                         titre=f"BAFA {r['nom']} : sessions, dates et prix",
                         h1=f"Passer le BAFA {r['a']}",
                         description=f"Les sessions BAFA {r['a']} : formation générale, approfondissement, dates, ville, formule et prix, département par département.",
                         intro=f"Les sessions dont le lieu est {r['a']}. Choisissez votre département plus bas, ou cherchez avec les filtres.",
                         region=r, sessions=de_la_region, indexer=bool(de_la_region), sujet=("le BAFA", "BAFA", r["a"]),
                         lien_tout=f"/se-former/sessions/?diplome=BAFA&dep=r:{r['id']}",
                         fil=[SF, RUB, (r["nom"], f"/se-former/sessions/{r['slug']}/")])
        for dep in self.departements.values():
            du_dep = [s for s in bafa if s["dep"] is dep]
            dep["nb"] = len(du_dep)
            RG = (dep["reg"]["nom"], f"/se-former/sessions/{dep['reg']['slug']}/")
            villes = self.villes(du_dep, minimum=1)  # une page par commune dès qu'une session y a lieu
            per_dep = [p for p in self.periodes if any(s["periode"] is p for s in du_dep)]
            self.ajouter(f"/se-former/sessions/{dep['slug']}/", "liste.html",
                         titre=f"BAFA {dep['nom']} ({dep['code']}) : sessions, dates et prix",
                         h1=f"Passer le BAFA {dep['a']}",
                         description=f"Les sessions BAFA {dep['a']} ({dep['code']}) : formation générale, approfondissement, dates, formule et prix par organisme.",
                         intro=f"Les sessions dont le lieu est {dep['a']}. Une session peut se suivre dans n'importe quel département : regardez aussi les départements voisins.",
                         departement=dep, sessions=du_dep, indexer=bool(du_dep), periodes_dep=per_dep, villes=villes,
                         sujet=("le BAFA", "BAFA", dep["a"]),
                         lien_tout=f"/se-former/sessions/?diplome=BAFA&dep={dep['code']}",
                         fil=[SF, RUB, RG, (dep["nom"], f"/se-former/sessions/{dep['slug']}/")])
            for p in per_dep:
                liste = [s for s in du_dep if s["periode"] is p]
                self.ajouter(f"/se-former/sessions/{dep['slug']}/{p['slug']}/", "liste.html",
                             titre=f"BAFA {dep['nom']} {p['nom']} : dates et prix",
                             h1=f"BAFA {dep['a']} pendant les {p['nom']}",
                             description=f"Sessions BAFA {dep['a']} ({dep['code']}) pendant les {p['nom']} : dates, ville, formule, prix et lien vers l'organisme.",
                             intro=f"Les {p['nom']} vont {self.dates_vacances(p, dep)} {dep['a']}.",
                             departement=dep, periode=p, sessions=liste, periodes_dep=per_dep, villes=villes,
                             sujet=("le BAFA", "BAFA", f"{dep['a']} pendant les {p['nom']}"),
                             fil=[SF, RUB, RG, (dep["nom"], f"/se-former/sessions/{dep['slug']}/"), (p["court"], f"/se-former/sessions/{dep['slug']}/{p['slug']}/")])
            for v in villes:
                self.ajouter(f"/se-former/sessions/{dep['slug']}/{v['slug']}/", "liste.html",
                             titre=f"BAFA {v['nom']} ({dep['code']}) : sessions, dates et prix",
                             h1=f"Passer le BAFA à {v['nom']}",
                             description=f"Les sessions BAFA à {v['nom']} ({dep['code']}) : formation générale, approfondissement, dates, formule et prix, avec le lien vers l'organisme.",
                             intro=f"Les sessions qui ont lieu à {v['nom']}. D'autres sessions ont lieu tout près, {dep['a']}.",
                             departement=dep, ville=v, sessions=v["sessions"], periodes_dep=per_dep, villes=villes,
                             sujet=("le BAFA", "BAFA", f"à {v['nom']}"),
                             fil=[SF, RUB, RG, (dep["nom"], f"/se-former/sessions/{dep['slug']}/"), (v["nom"], f"/se-former/sessions/{dep['slug']}/{v['slug']}/")])
        for t in self.types:
            if t["id"] == "qualification":  # devenue le BSB, une formation à part
                self.ajouter(f"/se-former/sessions/{t['slug']}/", "redirection.html", titre="Cette page a changé d'adresse",
                             indexer=False, vers="/se-former/sessions/bsb/")
                continue
            liste = [s for s in bafa if s["type"] == t["id"]]
            self.ajouter(f"/se-former/sessions/{t['slug']}/", "liste.html",
                         titre=f"BAFA {t['nom'].lower()} : sessions et prix partout en France",
                         h1=f"BAFA : {t['nom'].lower()}",
                         description=f"Les sessions de {t['nom'].lower()} du BAFA partout en France : dates, villes, formules et prix, avec le lien vers chaque organisme.",
                         type_session=t, sessions=liste, indexer=bool(liste), lien_tout=f"/se-former/sessions/?type=BAFA-{t['id']}",
                         sujet=(f"la {t['nom'].lower()} du BAFA", f"{t['nom'].lower()} du BAFA", "en France"),
                         fil=[SF, RUB, (t["nom"], f"/se-former/sessions/{t['slug']}/")])
        for d in self.diplomes.values():
            if d["id"] == "BAFD":
                continue
            liste = [s for s in S if s["diplome"] == d["id"]]
            self.ajouter(f"/se-former/sessions/{d['slug']}/", "liste.html",
                         titre=f"{d['nom']} : sessions, dates et prix partout en France",
                         h1=f"Les sessions {d['long']}",
                         description=f"Les prochaines sessions {d['long']} partout en France : dates, lieu, durée et prix, organisme par organisme, avec le lien vers chaque organisme.",
                         intro=None, diplome_page=d, sessions=liste, indexer=bool(liste), lien_tout=f"/se-former/sessions/?diplome={d['id']}",
                         sujet=(f"le {d['nom']}", d["nom"], "en France"), mois_cle=d["id"],
                         fil=[SF, RUB, (d["nom"], f"/se-former/sessions/{d['slug']}/")])
        bafd = [s for s in S if s["diplome"] == "BAFD"]
        self.ajouter("/se-former/sessions/bafd/", "liste.html", titre="BAFD : sessions, dates et prix partout en France",
                     h1="Les sessions BAFD",
                     description="Les sessions de formation BAFD (directeur d'accueil collectif de mineurs) partout en France : formation générale et perfectionnement, dates, lieu, formule et prix.",
                     intro="Formation générale et perfectionnement du BAFD, dès 18 ans avec le BAFA.",
                     sessions=bafd, diplome="BAFD", indexer=bool(bafd), lien_tout="/se-former/sessions/?diplome=BAFD",
                     sujet=("le BAFD", "BAFD", "en France"), mois_cle="BAFD",
                     fil=[SF, RUB, ("BAFD", "/se-former/sessions/bafd/")])
        self.declarer_declinaisons(SF, RUB)
        self.declarer_ecoles(SF)
        en_ligne = [o for o in self.organismes.values() if o.get("en_ligne")]
        # la page des organismes : une carte par organisme (logo, sessions, diplômes, prix), les plus fournis d'abord
        ORDRE_DIPL = ["BAFA", "BAFD", "BSB", "PSC1", "CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS"]
        cartes = []
        for o in self.organismes.values():
            liste = [s for s in S if s["organisme"] == o["id"]]
            logo = next(iter(sorted((RACINE / "statique" / "logos").glob(o["id"] + ".*"))), None)
            prix = [s["prix"] for s in liste if s["prix"]]
            dipl = {s["diplome"] for s in liste}
            mots = [m for m in re.split(r"[\s'-]+", o["nom"]) if m and m[0].isupper()]
            cartes.append({**o, "n": len(liste), "prix_min": min(prix) if prix else None,
                           "diplomes": [self.diplomes[d]["nom"] for d in ORDRE_DIPL if d in dipl],
                           "villes_n": len({(s["departement"], s["ville"]) for s in liste}),
                           "logo": f"logos/{logo.name}" if logo else None,
                           "initiales": ("".join(m[0] for m in mots[:3]) if len(mots) > 1 else o["nom"][:3]).upper()})
        # les organismes inscrits sur le site (fiche créée dans leur espace) : reliés à leur carte, ou une carte à eux
        par_id = {c["id"]: c for c in cartes}
        for x in self.lire_supabase("rpc/organismes_inscrits", "organismes inscrits") or []:
            c = par_id.get(x.get("organisme_id"))
            if c:
                c["inscrit"] = True
                if x.get("presentation"):
                    c["presentation"] = x["presentation"]
                continue
            mots = [m for m in re.split(r"[\s'-]+", x["nom"]) if m and m[0].isupper()]
            cartes.append({"id": None, "nom": x["nom"], "n": 0, "prix_min": None, "diplomes": [], "villes_n": 0, "logo": None, "en_ligne": False,
                           "site": x.get("site"), "page_sessions": x.get("inscription"), "habilitation": x.get("habilitation"),
                           "presentation": x.get("presentation") or "Organisme de formation inscrit sur Fil Roug'Anim.", "inscrit": True,
                           "partenaire": bool(x.get("zones")), "zones": x.get("zones") or [],
                           "initiales": ("".join(m[0] for m in mots[:3]) if len(mots) > 1 else x["nom"][:3]).upper()})
        # d'abord les partenaires (ils paient : mis en avant), puis les autres par nombre de sessions
        cartes.sort(key=lambda c: (not c.get("partenaire"), -c["n"], c["nom"]))
        autres = collections.Counter(s["org"]["nom"] for s in S if not s["organisme"] and s["diplome"] in ("BAFA", "BAFD", "BSB"))
        # pour l'administration (prospection des organismes) : ce que le site montre déjà de chacun
        self.organismes_admin = {"suivis": [{"id": c["id"], "nom": c["nom"], "habilitation": c.get("habilitation"), "site": c.get("site"), "n": c["n"],
                                             "villes": c["villes_n"], "diplomes": c["diplomes"], "prix_min": c["prix_min"],
                                             "page": f"/se-former/sessions/organismes/{c['id']}/" if c.get("en_ligne") else None} for c in cartes if c["id"]],
                                 "autres": [{"nom": n, "n": k} for n, k in autres.most_common()]}
        self.ajouter("/se-former/sessions/organismes/", "organismes.html", titre="Organismes de formation BAFA, BAFD, BSB et PSC : la liste",
                     h1="Les organismes de formation",
                     description="Les organismes de formation au BAFA, au BAFD, au BSB et au PSC présents sur le site : leurs prochaines sessions, leurs diplômes, leurs prix et le lien vers leur site.",
                     organismes=cartes, autres=autres.most_common(), fil=[SF, RUB, ("Organismes", "/se-former/sessions/organismes/")])
        tarifs = self.lire_supabase("zones_tarifs?select=departement,nom,palier,prix,places,rang&order=rang", "tarifs des départements") or []
        paliers = []
        for n in (1, 2, 3, 4):
            ds = [t for t in tarifs if t["palier"] == n]
            if ds:
                paliers.append({"n": n, "prix": ds[0]["prix"], "places": ds[0]["places"], "nb": len(ds), "exemples": [t["nom"] for t in ds[:5]],
                                "codes": [t["departement"] for t in ds]})
        # la fiche d'exemple : un organisme fictif, avec de vraies sessions d'Île-de-France prêtées pour l'occasion
        ex_org = {"id": "", "nom": "Les Ateliers du Fil", "partenaire": True, "zones": ["75", "92", "93"], "habilitation": "régionale",
                  "inscription": "#", "en_ligne": False,
                  "presentation": "Organisme de formation fictif, pour montrer une fiche partenaire.",
                  "presentation_partenaire": "Nous formons chaque année plus de 600 animateurs en Île-de-France, en externat comme en internat. Nos formateurs sont tous en poste dans des accueils de loisirs : vous apprenez avec des situations réelles.\n\nAprès la formation générale, nous vous aidons à trouver votre stage pratique grâce à notre réseau de structures partenaires, et nous montons avec vous votre dossier d'aide CAF."}
        ex_sessions = []
        for x in S:
            if x["departement"] in ("75", "92", "93") and x["diplome"] == "BAFA" and not x.get("complet") and len(ex_sessions) < 6:
                y = dict(x, org=ex_org, org_cle="", url="#", organisme="exemple")
                ex_sessions.append(y)
        self.ajouter("/organismes-partenaires/exemple/", "exemple-organisme.html", titre="Exemple de fiche d'organisme partenaire",
                     description="À quoi ressemble la fiche d'un organisme de formation partenaire de Fil Roug'Anim : présentation, départements, sessions mises en avant, bouton d'inscription, statistiques.",
                     indexer=False, organisme_ex=ex_org, sessions=ex_sessions, schema="",
                     fil=[SF, RUB, ("Organismes", "/se-former/sessions/organismes/"), ("Partenaires", "/organismes-partenaires/"), ("Exemple", "/organismes-partenaires/exemple/")])
        self.ajouter("/organismes-partenaires/", "partenaires.html", titre="Organismes de formation BAFA : la formule partenaire de Fil Roug'Anim",
                     h1="Vos sessions, là où les jeunes choisissent",
                     description="Organismes de formation BAFA, BAFD, BSB et PSC : vos sessions sont déjà comparées gratuitement sur Fil Roug'Anim. Recevez vos statistiques (vues, clics vers votre site) et découvrez la formule partenaire.",
                     audience=self.audience(), nb_sessions=len(S), nb_organismes=len(cartes) + len(autres), paliers=paliers,
                     fil=[SF, RUB, ("Organismes", "/se-former/sessions/organismes/"), ("Partenaires", "/organismes-partenaires/")])
        for o in en_ligne:
            liste = [s for s in S if s["organisme"] == o["id"]]
            self.ajouter(f"/se-former/sessions/organismes/{o['id']}/", "liste.html",
                         titre=f"{o['nom']} : sessions, dates et prix",
                         h1=f"{o['nom']} : les sessions",
                         description=f"Les prochaines sessions de {o['nom']} : dates, villes, formules et prix, avec le lien vers sa page.",
                         organisme=o, sessions=liste, indexer=bool(liste), lien_tout=f"/se-former/sessions/?q={quote(o['nom'])}",
                         fil=[SF, RUB, ("Organismes", "/se-former/sessions/organismes/"), (o["nom"], f"/se-former/sessions/organismes/{o['id']}/")])

        # ---- rubrique Formations
        formations = []
        for f in sorted((RACINE / "contenu" / "formations").glob("*.md")):
            entete, corps = lire_markdown(f)
            url = f"/se-former/{f.stem}/"
            formations.append({**entete, "url": url})
            self.ajouter(url, "formation.html", titre=entete["titre"], description=entete["description"],
                         corps_md=corps, entete=entete, fil=[SF, (entete["court"], url)])
        formations.sort(key=lambda g: g.get("ordre", 99))
        self.config["formations"] = formations
        self.ajouter("/se-former/", "se-former.html",
                     titre="Se former à l'animation : BAFA, BAFD, PSC1, BPJEPS, DEJEPS",
                     description="Trouver une session de BAFA, de BAFD ou de PSC1 partout en France, comprendre chaque formation de l'animation, du PSC1 au DEJEPS, et financer son BAFA.",
                     fil=[SF])

        # ---- guides : chacun dans sa partie (« partie: se-former » ou « partie: trouver-un-poste »)
        PARTIES = {"se-former": SF, "trouver-un-poste": ("Animateurs & directeurs", "/trouver-un-poste/offres/")}
        PREFIXES = {"se-former": "/se-former/", "trouver-un-poste": "/trouver-un-poste/"}
        guides = []
        for f in sorted((RACINE / "contenu" / "guides").glob("*.md")):
            entete, corps = lire_markdown(f)
            partie = PARTIES[entete["partie"]]
            url = f"{PREFIXES[entete['partie']]}{f.stem}/"
            guides.append({**entete, "url": url})
            self.ajouter(url, "guide.html", titre=entete["titre"], description=entete["description"],
                         corps_md=corps, entete=entete, fil=[partie, (entete["court"], url)])
        guides.sort(key=lambda g: g.get("ordre", 99))
        self.config["guides"] = guides
        self.ajouter("/se-former/questions-frequentes/", "faq.html",
                     titre="BAFA, BAFD, stage pratique : les questions fréquentes",
                     description="Âge, prix, durée, stage pratique payé ou non, BAFD, surveillant de baignade : les réponses courtes aux questions les plus posées sur le BAFA, avec leurs sources.",
                     faq=self.faq, schema=self.schema_faq(self.faq),
                     fil=[SF, ("Questions fréquentes", "/se-former/questions-frequentes/")])

        # ---- pages fixes en Markdown (rubrique Stages et jobs, à propos, contact, pages légales)
        for f in sorted((RACINE / "contenu" / "pages").glob("*.md")):
            entete, corps = lire_markdown(f)
            fil = [tuple(x) for x in entete.get("fil", [])] + [(entete.get("court", entete["titre"]), entete["url"])]
            self.ajouter(entete["url"], entete.get("gabarit", "page.html"), titre=entete["titre"],
                         description=entete.get("description", ""), indexer=entete.get("indexer", True),
                         corps_md=corps, entete=entete, fil=fil)
        # Trouver un poste : les questions fréquentes de la page (et leurs données structurées)
        faq_tp = [
            {"q": "Mon profil est-il public ?", "r": "Non. Il n'est visible que par les structures vérifiées, jamais sur Google ni par les visiteurs du site. Vous pouvez le cacher ou le supprimer quand vous voulez."},
            {"q": "Combien ça coûte ?", "r": "Rien. Créer son profil, lire les offres et écrire aux structures est gratuit pour les candidats, et ça le restera."},
            {"q": "Je n'ai que la formation générale du BAFA, puis-je m'inscrire ?", "r": "Oui : c'est justement le bon moment pour trouver votre stage pratique. Indiquez « stagiaire BAFA » dans vos diplômes."},
            {"q": "Comment une structure me contacte-t-elle ?", "r": "Une structure vérifiée qui trouve votre profil vous écrit ; vous choisissez de répondre ou non. Le contrat se signe ensuite directement avec elle."},
            {"q": "Il n'y a pas encore d'offre près de chez moi, que faire ?", "r": "Créez votre profil : les structures de votre secteur peuvent vous trouver avant même de publier une offre. Pensez aussi au centre de loisirs de votre ville."},
        ]
        for q in faq_tp:
            q["r_rendu"] = q["r"]
        # /trouver-un-poste/ faisait doublon avec la page des offres (et l'annuaire des animateurs) : elle y renvoie
        for pg in self.pages:
            if pg["url"] == "/trouver-un-poste/":
                pg.update(gabarit="redirection.html", indexer=False, vers="/trouver-un-poste/offres/", titre="Cette page a changé d'adresse")
        for o in self.offres:
            self.ajouter(f"/trouver-un-poste/offres/{o['id']}/", "offre.html", titre=f"{o['intitule']} à {o['ville']}",
                         description=f"{o['intitule']} : {o['structure']['nom']}, {o['ville']} ({o['departement']}), à partir du {date_fr(o['debut'])}. Candidature directe auprès de la structure, gratuite.",
                         offre=o, schema=self.schema_offre(o),
                         fil=[("Animateurs & directeurs", "/trouver-un-poste/offres/"), (o["intitule"], f"/trouver-un-poste/offres/{o['id']}/")])
        self.ajouter("/trouver-un-poste/offres/", "offres.html", titre="Offres de stages pratiques BAFA et de jobs d'animation",
                     description="Les offres de stages pratiques BAFA, de jobs d'été et de postes d'animation publiées par les structures vérifiées, avec des filtres par département, contrat, poste et date.",
                     h1="Les offres d'animation", indexer=bool(self.offres),
                     mois=sorted({o["debut"].strftime("%Y-%m") for o in self.offres}),
                     fil=[("Animateurs & directeurs", "/trouver-un-poste/offres/"), ("Les offres", "/trouver-un-poste/offres/")])
        # l'annuaire inversé : le candidat décrit le poste qu'il cherche, les structures les plus proches reçoivent sa demande
        self.ajouter("/trouver-un-poste/demande/", "demande.html", titre="Trouver une structure : décrivez le poste que vous cherchez",
                     description="Stage pratique BAFA, colo, centre de loisirs, direction : décrivez le poste que vous cherchez, et votre demande part chez les 3 structures d'animation les plus proches de chez vous. Gratuit, sans intermédiaire.",
                     fil=[("Animateurs & directeurs", "/trouver-un-poste/offres/"), ("Décrire ce que je cherche", "/trouver-un-poste/demande/")])
        # pages publiques des structures vérifiées, et les exemples fictifs
        TP = ("Animateurs & directeurs", "/trouver-un-poste/offres/")
        STR = ("Les structures", "/trouver-un-poste/structures/")
        structures = self.structures_en_ligne()
        # les places fondatrices qui restent : comptées dans la base (structures qui ont payé au tarif fondateur)
        places = self.lire_supabase("rpc/places_fondatrices", "places fondatrices")
        if isinstance(places, int):
            self.config["fondateurs"]["reservees"] = self.config["fondateurs"]["places"] - places
        # les centres en ligne (version 5) : une page chacun, rattachée à celle de la structure
        champs_c = "id,structure_id,nom,type,ville,departement,slug,accroche,presentation,publics,activites,photos"
        centres = self.lire_supabase(f"centres?select={champs_c}&order=cree_le", "centres des structures") if structures else []
        for st in structures:
            st["offres"] = [o for o in self.offres if o["structure"].get("slug") == st["slug"]]
            st["centres"] = [c for c in centres if c.get("structure_id") == st.get("id") and c.get("departement") in self.departements]
            url = f"/trouver-un-poste/structures/{st['slug']}/"
            for c in st["centres"]:
                c["url"] = f"{url}{c['slug']}/"
                c["offres"] = [o for o in st["offres"] if o.get("centre_id") == c["id"]]
            self.ajouter(url, "structure.html", titre=f"{st['nom']} : {TYPES_STRUCTURE.get(st['type'], 'structure')} à {st['ville']}",
                         description=(st.get("accroche") or f"{st['nom']}, {TYPES_STRUCTURE.get(st['type'], 'structure d animation').lower()} à {st['ville']}") + " Ses offres de stages et de jobs d'animation.",
                         structure=st, point=self.point_structure(st), fil=[TP, STR, (st["nom"], url)])
            for c in st["centres"]:
                # la page d'un centre : ses informations, et pour le reste (projet, couleur, logo, ce qu'on offre à l'équipe) celles de la structure
                cst = dict(st, **{k: v for k, v in c.items() if v not in (None, [], "")}, offres=c["offres"], centres=[],
                           parent={"nom": st["nom"], "url": url, "nb_centres": len(st["centres"])}, photos=c.get("photos") or st.get("photos") or [])
                cst["type"] = c.get("type") or st["type"]
                self.ajouter(c["url"], "structure.html", titre=f"{c['nom']} ({st['nom']}) : {TYPES_STRUCTURE.get(cst['type'], 'structure')} à {c['ville']}",
                             description=(c.get("accroche") or f"{c['nom']}, un centre de {st['nom']} à {c['ville']}.") + " Ses offres de stages et de jobs d'animation.",
                             structure=cst, point=self.point_structure(cst), fil=[TP, STR, (st["nom"], url), (c["nom"], c["url"])])
        ex = self.donnees.get("exemples", {})
        self.ajouter("/trouver-un-poste/structures/", "structures.html", titre="Les structures d'animation qui recrutent",
                     description="Les centres de loisirs, organisateurs de séjours et associations d'animation inscrits et vérifiés : leur projet, leurs publics et leurs offres.",
                     h1="Les structures qui recrutent", structures=structures, indexer=bool(structures), fil=[TP, STR],
                     exemple=dict(ex["structure"], exemple=True) if ex.get("structure") else None)
        if ex.get("structure"):
            st = dict(ex["structure"], exemple=True)
            st["offres"] = [dict(o, debut=en_date(o["debut"])) for o in st.pop("offres", [])]
            self.ajouter("/recruter/exemple-de-page-structure/", "structure.html", titre="Exemple de page structure",
                         description="À quoi ressemble la page d'une structure sur Fil Roug'Anim : un exemple fictif.",
                         indexer=False, structure=st, point=self.point_structure(st), fil=[("Structures", "/recruter/"), ("Exemple de page structure", "/recruter/exemple-de-page-structure/")])
        self.pages_sejours(structures)
        self.page_catalogue_sejours()
        self.pages_sejours_google()
        self.pages_locales(structures)
        # « Trouver un séjour » est devenu « Inscrire mon enfant » : les anciennes adresses /sejours/… renvoient vers /enfants/…
        for pg in [x for x in self.pages if x["url"].startswith("/enfants/")]:
            self.ajouter("/sejours/" + pg["url"][len("/enfants/"):], "redirection.html", titre="Cette page a changé d'adresse", indexer=False, vers=pg["url"])
        for ancienne in ["/recruter/boite-a-outils/", "/outils/annonce-animateur/", "/outils/budget-equipe/"] + [f"/recruter/{g}/" for g in ['recruter-un-service-civique', 'recruter-un-apprenti', 'aides-pour-recruter', 'accueillir-un-stagiaire-bafa', 'declarer-son-accueil', 'reussir-son-recrutement']]:
            self.ajouter(ancienne, "redirection.html", titre="Cette page a changé d'adresse", indexer=False, vers="/recruter/")
        self.ajouter("/recruter/animateurs/", "redirection.html", titre="Cette page a changé d'adresse", indexer=False, vers="/trouver-un-poste/offres/#animateurs")
        if ex.get("profil"):
            pr = dict(ex["profil"], dispo_debut=en_date(ex["profil"].get("dispo_debut")), dispo_fin=en_date(ex["profil"].get("dispo_fin")),
                      maj_le=en_date(ex["profil"].get("maj_le")))
            self.ajouter("/trouver-un-poste/exemple-de-profil/", "exemple-profil.html", titre="Exemple de profil de candidat",
                         description="À quoi ressemble un profil de candidat sur Fil Roug'Anim, et qui peut le voir : un exemple fictif.",
                         h1="Un exemple de profil", indexer=False, profil=pr, points=self.points_profil(pr), mois_dispo=self.mois_dispo(pr),
                         intro="Voici ce que voit une structure vérifiée quand elle consulte un profil. Ce profil est fictif.",
                         fil=[TP, ("Exemple de profil", "/trouver-un-poste/exemple-de-profil/")])
        # outils gratuits (calculs dans le navigateur)
        OT = ("Outils", "/outils/")
        # « Comment ça marche » : les quatre parcours du site, la même logique que le menu
        self.ajouter("/comment-ca-marche/", "comment-ca-marche.html", titre="Comment ça marche : se former, trouver un poste, recruter, inscrire son enfant",
                     description="Fil Roug'Anim en quatre parcours : comparer les formations BAFA, trouver un stage ou un job d'animateur, recruter son équipe, inscrire son enfant en colo ou en centre de loisirs. Qui paie quoi.",
                     h1="Comment ça marche", intro="Quatre parcours, trois étapes chacun. Choisissez le vôtre.",
                     parcours=[
            {"id": "former", "qui": "Pour les futurs animateurs et directeurs", "titre": "Se former,", "em": "sans se perdre",
             "prix": "Gratuit : on compare, vous vous inscrivez chez l'organisme.",
             "etapes": [("Choisir sa formation", "BAFA pour animer, BAFD pour diriger, PSC et BSB en plus, diplômes pros pour en faire son métier."),
                        ("Comparer les sessions", f"{len(self.sessions)} sessions près de chez vous : dates, formule, prix et aides, sur une carte."),
                        ("S'inscrire chez l'organisme", "Vous cliquez sur « Voir » : l'inscription et le paiement se font directement chez lui, sans intermédiaire.")],
             "aller": ("Trouver une session", "/se-former/sessions/"), "liens": [("Quelle formation choisir ?", "/se-former/quelle-formation-choisir/"), ("Les étapes du BAFA", "/se-former/etapes-du-bafa/")]},
            {"id": "poste", "qui": "Pour les animateurs et directeurs", "titre": "Trouver un poste,", "em": "les structures viennent à vous",
             "prix": "Gratuit, toujours.",
             "etapes": [("Décrire ce que vous cherchez", "Stage pratique, job d'été, poste à l'année : en une minute, sans compte."),
                        ("Votre demande part", "Elle arrive chez les 3 structures vérifiées les plus proches, qui vous répondent."),
                        ("Ou créer votre fiche", "Vos diplômes et vos dates : les structures de votre secteur vous trouvent et vous écrivent.")],
             "aller": ("Décrire ce que je cherche", "/trouver-un-poste/demande/"), "liens": [("Voir les offres", "/trouver-un-poste/offres/"), ("Trouver son stage pratique", "/trouver-un-poste/trouver-son-stage-pratique/")]},
            {"id": "structure", "qui": "Pour les structures", "titre": "Recruter et se faire connaître,", "em": "au même endroit",
             "prix": "Votre page et une offre : gratuit. L'abonnement en plus, si vous voulez.",
             "etapes": [("Créer la page de votre structure", "Votre projet, vos publics, vos photos : vérifiée par nous, puis en ligne."),
                        ("Publier vos offres et vos séjours", "Là où les animateurs cherchent leur BAFA, et là où les familles cherchent une place."),
                        ("Recevoir les demandes", "Les animateurs et les familles de votre secteur décrivent leur besoin : il arrive chez vous.")],
             "aller": ("Créer la page de ma structure", "/recruter/"), "liens": [("Un exemple de page", "/recruter/exemple-de-page-structure/"), ("Les chiffres du site", "/chiffres/")]},
            {"id": "enfant", "qui": "Pour les familles", "titre": "Inscrire son enfant,", "em": "près de chez vous",
             "prix": "La demande de place est sans frais. Le séjour ou l'accueil se paie à la structure.",
             "etapes": [("Chercher une place", "Colo, accueil de loisirs ou périscolaire pour les 3 à 17 ans, près de chez vous."),
                        ("Demander en ligne", "La structure vérifiée reçoit votre demande et vous répond directement."),
                        ("Suivre le séjour", "Avec votre espace parent, le carnet de séjour vous envoie les nouvelles de l'équipe.")],
             "aller": ("Voir les offres", "/enfants/"), "liens": [("Décrire mon besoin", "/enfants/demande/"), ("Les aides pour partir", "/enfants/aides/")]}],
                     fil=[("Comment ça marche", "/comment-ca-marche/")])
        self.ajouter("/outils/", "outils.html", titre="Outils gratuits pour l'animation : encadrement, CEE, BAFA",
                     description="Calculer le taux d'encadrement d'un accueil de mineurs, vérifier un contrat d'engagement éducatif, suivre les délais de son BAFA : des outils gratuits, sans compte, avec les textes officiels.",
                     h1="Les outils gratuits", intro="Pour préparer une équipe, vérifier un contrat ou ne pas rater une date. Gratuits, sans compte, rien n'est envoyé.", fil=[OT])
        for url, gab, titre, h1, intro, description, outil in [
            ("/outils/taux-d-encadrement/", "outil.html", "Calculer le taux d'encadrement d'un accueil de mineurs (ACM)",
             "Calculer le taux d'encadrement", "Combien d'animateurs pour votre accueil de loisirs, votre périscolaire ou votre séjour ? Et combien de diplômés, de stagiaires, de non-diplômés ?",
             "Calculateur gratuit du taux d'encadrement en accueil collectif de mineurs : séjour, accueil de loisirs, périscolaire, PEDT. Avec la répartition diplômés, stagiaires et non-diplômés, d'après le code de l'action sociale et des familles.", "encadrement"),
            ("/outils/salaire-cee/", "outil.html", "Contrat d'engagement éducatif : vérifier sa rémunération et ses jours",
             "Vérifier un contrat d'engagement éducatif", "La rémunération proposée respecte-t-elle le minimum légal ? Combien de jours de CEE vous reste-t-il sur 12 mois ?",
             "Calculateur gratuit du contrat d'engagement éducatif (CEE) : rémunération minimale de 52,93 € brut par jour, plafond de 80 jours sur 12 mois, repos. D'après le code de l'action sociale et des familles.", "cee"),
            ("/outils/mon-parcours-bafa/", "outil.html", "Mon parcours BAFA : les dates limites de chaque étape",
             "Mon parcours BAFA : mes dates limites", "Entrez la date de votre formation générale : vous voyez jusqu'à quand faire votre stage pratique et votre approfondissement.",
             "Calculez les dates limites de votre BAFA : stage pratique dans les 18 mois, parcours complet en 30 mois, et les sessions d'approfondissement à temps.", "parcours"),
        ]:
            self.ajouter(url, gab, titre=titre, h1=h1, intro=intro, description=description, outil=outil, fil=[OT, (h1, url)])
        if (self.config.get("supabase") or {}).get("url"):
            self.ajouter("/alertes/desabonnement/", "desabonnement.html", titre="Arrêter les alertes", indexer=False,
                         h1="Arrêter les alertes du lundi")
            self.ajouter("/compte/", "compte.html", titre="Mon compte", indexer=False,
                         description="Votre compte Fil Roug'Anim : profil de candidat, ou fiche de structure et offres.",
                         fil=[("Mon compte", "/compte/")])
        self.ajouter("/404.html", "404.html", titre="Page introuvable", indexer=False)

        # ---- anciennes adresses : une page de redirection pour chacune
        self.ajouter_redirections()

    def ajouter_redirections(self):
        """Les adresses des versions précédentes du site renvoient vers les nouvelles."""
        self.declarer_lexique_blog()
        self.declarer_index_villes()
        fixes = {"/se-former/": ["/formations/", "/guides/", "/bafa/", "/se-former/cqp-animateur-periscolaire/",
                                 "/se-former/sessions/cqp-animateur-periscolaire/"],
                 "/se-former/sessions/bafd/": ["/bafd/", "/sessions/bafd/"],
                 "/se-former/sessions/organismes/": ["/organismes/", "/sessions/organismes/"],
                 "/se-former/questions-frequentes/": ["/questions-frequentes/", "/guides/questions-frequentes/"],
                 "/trouver-un-poste/": ["/stages-et-jobs/", "/animateurs/"],
                 "/recruter/": ["/structures/", "/stages-et-jobs/recruteurs/", "/recruteurs/"]}
        anciennes = {}
        for pg in list(self.pages):
            u = pg["url"]
            for v in fixes.get(u, []):
                anciennes[v] = u
            if u.startswith("/se-former/sessions/") and u not in fixes:
                reste = u[len("/se-former/sessions/"):]
                anciennes["/sessions/" + reste] = u
                if reste.startswith("organismes/"):
                    anciennes["/" + reste] = u
                elif reste and not pg.get("ville") and not pg.get("diplome_page"):
                    anciennes["/bafa/" + reste] = u
            elif pg["gabarit"] == "formation.html":
                anciennes["/formations/" + u.split("/")[2] + "/"] = u
            elif pg["gabarit"] == "guide.html":
                anciennes["/guides/" + u.split("/")[2] + "/"] = u
                if u.startswith("/trouver-un-poste/"):
                    anciennes[u.replace("/trouver-un-poste/", "/animateurs/", 1)] = u
            elif u.startswith("/trouver-un-poste/offres/"):
                anciennes[u.replace("/trouver-un-poste/", "/stages-et-jobs/", 1)] = u
                anciennes[u.replace("/trouver-un-poste/", "/animateurs/", 1)] = u
        existantes = {pg["url"] for pg in self.pages}
        for ancienne, nouvelle in sorted(anciennes.items()):
            if ancienne not in existantes:
                self.ajouter(ancienne, "redirection.html", titre="Cette page a changé d'adresse", indexer=False, vers=nouvelle)

    def chiffres_sessions(self, sessions=None):
        """Les chiffres repris dans le blog et les bilans du mois : prix médians, nombre de sessions, départements."""
        S = self.sessions if sessions is None else sessions
        def med(liste):
            prix = sorted(s["prix"] for s in liste if s["prix"])
            return {"n": len(liste), "med": prix[len(prix) // 2] if prix else None,
                    "min": prix[0] if prix else None, "max": prix[-1] if prix else None}
        bafa = [s for s in S if s["diplome"] == "BAFA"]
        c = {"total": len(S),
             "fg": med([s for s in bafa if s["type"] == "formation-generale"]),
             "appro": med([s for s in bafa if s["type"] == "approfondissement"]),
             "qualif": med([s for s in S if s["diplome"] == "BSB"]),
             "bafd": med([s for s in S if s["diplome"] == "BAFD"]),
             "psc": med([s for s in S if s["diplome"] == "PSC1"]),
             "organismes": len({s["org"]["nom"] for s in S})}
        formules = {}
        for f in ("internat", "demi-pension", "externat"):
            formules[f] = med([s for s in bafa if s["type"] == "formation-generale" and s.get("formule") == f])
        c["formules"] = formules
        par_dep = collections.defaultdict(list)
        for s in bafa:
            if s["type"] == "formation-generale":
                par_dep[s["dep"]["code"]].append(s)
        deps = [(self.departements[k], med(v)) for k, v in par_dep.items() if len([x for x in v if x["prix"]]) >= 5]
        c["deps_moins_chers"] = sorted(deps, key=lambda x: x[1]["med"])[:5]
        c["deps_plus_fournis"] = sorted(((self.departements[k], len(v)) for k, v in par_dep.items()), key=lambda x: -x[1])[:5]
        par_periode = collections.Counter(s["periode"]["nom"] for s in bafa if s.get("periode"))
        c["periodes"] = par_periode.most_common()
        themes = collections.Counter(k for s in bafa if s["type"] == "approfondissement" for k in themes_de(s["theme"]))
        noms = {k: n for k, n, _ in THEMES_APPRO}
        c["themes"] = [(noms[k], k, n) for k, n in themes.most_common()]
        return c

    def chiffres_blog(self):
        if getattr(self, "_chiffres", None) is None:
            self._chiffres = self.chiffres_sessions()
        return self._chiffres

    def declarer_index_villes(self):
        """/se-former/villes/ : toutes les pages de ville, formation par formation et de A à Z (Google les trouve toutes)."""
        B = "/se-former/sessions/"
        deps = {d["slug"] for d in self.departements.values()}
        groupes = collections.OrderedDict((k, []) for k in ("BAFA", "BAFD", "BSB", "PSC", "CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS"))
        noms = {"bafd": "BAFD", "bsb": "BSB", "psc1": "PSC"}
        for p in self.pages:
            u = p["url"]
            if not p.get("indexer"):
                continue
            parts = u[len(B):].strip("/").split("/") if u.startswith(B) else []
            if len(parts) == 2 and parts[0] in deps and p.get("ville"):
                groupes["BAFA"].append((p["ville"]["nom"], p["departement"]["code"], u))
            elif len(parts) == 3 and parts[0] in deps and parts[1] in noms:
                groupes[noms[parts[1]]].append((p["fil"][-1][0], p["departement"]["code"], u))
            elif u.startswith("/se-former/ecoles/") and u.count("/") == 6:
                groupes[p["fil"][2][0]].append((p["fil"][-1][0], u.split("/")[4], u))
        code = {d["slug"]: d["code"] for d in self.departements.values()}
        listes = []
        for k, l in groupes.items():
            l = sorted({(n, code.get(c, c), u) for n, c, u in l}, key=lambda x: (sans_accents(x[0]), x[1]))
            if l:
                listes.append((k, l))
        total = sum(len(l) for _, l in listes)
        self.total_villes = total
        self.ajouter("/se-former/villes/", "villes.html", titre="BAFA, BAFD, BSB, PSC, BPJEPS : toutes les villes",
                     h1="Se former près de chez soi : toutes les villes",
                     description=f"Les {total} pages de ville de Fil Roug'Anim : les sessions BAFA, BAFD, BSB et PSC et les écoles des diplômes pros, commune par commune, de A à Z.",
                     intro="Chaque ville où une formation est prévue a sa page, avec les dates, les prix et les organismes. Choisissez votre formation, puis votre ville.",
                     listes=listes, total=total, fil=[("Se former", "/se-former/"), ("Toutes les villes", "/se-former/villes/")])

    def declarer_lexique_blog(self):
        """Le lexique (une page par mot) et le blog (articles écrits + bilans du mois calculés sur les sessions)."""
        urls = {p["url"] for p in self.pages}
        LX = ("Lexique", "/lexique/")
        termes = (self.donnees.get("lexique") or {}).get("termes") or []
        par_id = {t["id"]: t for t in termes}
        for t in termes:
            t["url"] = f"/lexique/{t['id']}/"
            t["liens"] = [l for l in t.get("liens") or [] if l[1] in urls]
        for t in termes:
            voir = [par_id[v] for v in t.get("voir") or [] if v in par_id]
            schema = json_ld({"@context": "https://schema.org", "@type": "DefinedTerm", "name": t["terme"],
                              "description": " ".join(t["definition"].split()),
                              "inDefinedTermSet": self.config["url"].rstrip("/") + "/lexique/"})
            self.ajouter(t["url"], "lexique.html", titre=f"{t['terme']} : définition simple",
                         description=resume(f"{t['terme']} : " + " ".join(t["definition"].split())),
                         h1=t["terme"], terme=t, voir=voir, termes=termes, schema=schema, fil=[LX, (t["court"], t["url"])])
        if termes:
            self.ajouter("/lexique/", "lexique.html", titre="Lexique de l'animation : BAFA, ACM, CEE, BPJEPS…",
                         description="Les mots de l'animation expliqués simplement : ACM, formation générale, stage pratique, approfondissement, CEE, taux d'encadrement, BPJEPS, PSC…",
                         h1="Le lexique de l'animation",
                         intro="ACM, CEE, appro, UCC : les mots qu'on entend en formation et en colo, expliqués en quelques lignes.",
                         termes=sorted(termes, key=lambda t: sans_accents(t["terme"])), fil=[LX])

        # -- le blog
        BL = ("Blog", "/blog/")
        articles = []
        for f in sorted((RACINE / "contenu" / "blog").glob("*.md")):
            entete, corps = lire_markdown(f)
            date = en_date(entete["date"])
            if date > self.aujourdhui:  # un article programmé attend son jour
                continue
            articles.append({**entete, "date": date, "url": f"/blog/{f.stem}/", "corps": corps})
        for f in sorted((RACINE / "donnees" / "bilans").glob("*.yml")):
            b = yaml.safe_load(f.read_text(encoding="utf-8"))
            nom = f"{MOIS[int(f.stem[5:7]) - 1]} {f.stem[:4]}"
            articles.append({"titre": f"Les formations BAFA en {nom} : prix, villes et tendances",
                             "description": f"Le bilan de {nom} : {b['total']} sessions BAFA, BAFD et PSC relevées, les prix médians, les départements les plus fournis et les thèmes d'approfondissement.",
                             "resume": f"{b['total']} sessions relevées, les prix médians et ce qui change ce mois-ci.",
                             "categorie": "Bilan du mois", "date": en_date(b["date"]), "url": f"/blog/bilan-{f.stem}/",
                             "bilan": b, "nom_mois": nom, "corps": None})
        articles.sort(key=lambda a: a["date"], reverse=True)
        self.articles = articles
        for a in articles:
            schema = json_ld({"@context": "https://schema.org", "@type": "BlogPosting", "headline": a["titre"],
                              "description": a["description"], "datePublished": a["date"].isoformat(),
                              "dateModified": en_date(a.get("mis_a_jour") or a["date"]).isoformat(),
                              "author": {"@type": "Organization", "name": self.config["nom"]},
                              "publisher": {"@type": "Organization", "name": self.config["nom"]},
                              "mainEntityOfPage": self.config["url"].rstrip("/") + a["url"]})
            extra = {"corps_md": a["corps"]} if a["corps"] else {}
            self.ajouter(a["url"], "article.html", titre=a["titre"], description=a["description"], h1=a["titre"],
                         article=a, schema=schema, fil=[BL, (a.get("court") or a["titre"], a["url"])], **extra)
        if articles:
            self.ajouter("/blog/", "blog.html", titre="Le blog de l'animation : BAFA, colo, métiers",
                         description="Conseils, chiffres et bilans du mois sur le BAFA, le BAFD, les colos et les métiers de l'animation, tirés des sessions comparées sur Fil Roug'Anim.",
                         h1="Le blog", intro="Des conseils concrets et des chiffres tirés des sessions relevées chaque nuit, pour bien choisir sa formation et réussir ses premières colos.",
                         articles=articles, fil=[BL])

    def ecrire_bilan(self):
        """Le bilan du mois (donnees/bilans/AAAA-MM.yml) : une photo des sessions, écrite une fois par mois par le relevé
        de nuit. Chaque bilan devient un article du blog, qui ne change plus ensuite."""
        cible = RACINE / "donnees" / "bilans" / f"{self.aujourdhui:%Y-%m}.yml"
        if cible.exists():
            print(f"Bilan déjà écrit : {cible.name}")
            return
        c = self.chiffres_sessions()
        b = {"date": self.aujourdhui.isoformat(), "total": c["total"], "organismes": c["organismes"],
             **{k: c[k] for k in ("fg", "appro", "qualif", "bafd", "psc")},
             "deps_plus_fournis": [{"nom": d["nom"], "slug": d["slug"], "n": n} for d, n in c["deps_plus_fournis"]],
             "themes": [{"nom": nom, "id": k, "n": n} for nom, k, n in c["themes"]]}
        cible.parent.mkdir(exist_ok=True)
        cible.write_text("# Bilan du mois, écrit par build.py --bilan (relevé de nuit) : ne pas modifier à la main.\n"
                         + yaml.safe_dump(b, allow_unicode=True, sort_keys=False), encoding="utf-8")
        print(f"Bilan écrit : {cible.name}")

    def ecrire_lieux_google(self):
        """/chiffres/lieux.json : pour chaque ville, département et région, ses pages et ce que Google en montre
        (affichages, clics, place moyenne sur 28 jours). Sert à « Les chiffres de ta ville »."""
        sortie = self.lieux_google()
        (SORTIE / "chiffres").mkdir(parents=True, exist_ok=True)
        (SORTIE / "chiffres" / "lieux.json").write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        # pour l'administration (Visibilité) : Google page par page et jour par jour (les mêmes chiffres que la page publique)
        a = self.audience()
        titres = {p["url"]: p.get("h1") or p["titre"] for p in self.pages}
        pages = []
        for u, imp, clics, place in a.get("pages_google") or []:
            v = u.split("?")[0].split("#")[0]
            v = v if v.endswith("/") else v + "/"
            pages.append([v, titres.get(v, v), imp, clics, place, self.famille_page(v)])
        google = {k: a.get(k) for k in ("impressions_28j", "impressions_evolution", "clics_28j", "clics_evolution", "visiteurs_30j", "visiteurs_evolution",
                                       "recherches_total", "recherches_premiere_page", "pages_vues_google", "pages_premiere_page_n", "gsc_du", "gsc_au")}
        google.update({"par_jour": a.get("impressions_par_jour") or [], "recherches": a.get("recherches") or [], "pages": pages,
                       "mis_a_jour": str(self.donnees.get("audience", {}).get("mis_a_jour") or "")})
        (SORTIE / "chiffres" / "google.json").write_text(json.dumps(google, ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")
        (SORTIE / "compte").mkdir(parents=True, exist_ok=True)
        # pour l'administration (Contenus du site, Réseaux sociaux) : les articles et guides avec leurs chiffres Google,
        # et des idées de posts tirées des sessions du moment
        perf = {x[0]: x[2:5] for x in pages}
        (SORTIE / "compte" / "contenus.json").write_text(json.dumps(self.contenus_admin(perf), ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")
        (SORTIE / "compte" / "posts.json").write_text(json.dumps(self.idees_posts(), ensure_ascii=False, separators=(",", ":"), default=str), encoding="utf-8")
        (SORTIE / "compte" / "organismes.json").write_text(json.dumps(getattr(self, "organismes_admin", {}), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    def contenus_admin(self, perf):
        """Les articles, guides et fiches formations, avec leur fichier, leur date et ce que Google en montre (28 jours)."""
        sortie = []
        def un(type_, f, entete, url, date=None):
            imp, clics, place = perf.get(url, (0, 0, None))
            sortie.append({"type": type_, "titre": entete.get("titre"), "court": entete.get("court"), "url": url,
                           "fichier": f"contenu/{f.parent.name}/{f.name}", "date": str(date or entete.get("maj") or entete.get("date") or ""),
                           "categorie": entete.get("categorie"), "mots": len(re.findall(r"\w+", f.read_text(encoding="utf-8"))),
                           "impressions": imp, "clics": clics, "place": place})
        for f in sorted((RACINE / "contenu" / "blog").glob("*.md")):
            e, _ = lire_markdown(f)
            un("Article", f, e, f"/blog/{f.stem}/", en_date(e["date"]))
        for g in self.config.get("guides") or []:
            f = RACINE / "contenu" / "guides" / (g["url"].rstrip("/").rsplit("/", 1)[1] + ".md")
            if f.exists():
                un("Guide", f, g, g["url"])
        for g in self.config.get("formations") or []:
            f = RACINE / "contenu" / "formations" / (g["url"].rstrip("/").rsplit("/", 1)[1] + ".md")
            if f.exists():
                un("Fiche formation", f, g, g["url"])
        return sortie

    def idees_posts(self):
        """Des idées de posts pour les réseaux sociaux, tirées des sessions et des articles du moment (rien n'est publié tout seul)."""
        auj, idees = self.aujourdhui, []
        semaine = auj.isocalendar()
        cle = f"{semaine[0]}-s{semaine[1]:02d}"
        villes_url = {(p.get("h1") or p["titre"]): p["url"] for p in self.pages}
        bientot = [s for s in self.sessions if s["diplome"] == "BAFA" and s["type"] == "formation-generale"
                   and auj <= s["debut"] <= auj + dt.timedelta(days=30) and not s.get("complet")]
        if bientot:
            villes = collections.Counter(s["ville"] for s in bientot if s.get("ville")).most_common(3)
            prix = sorted(s["prix"] for s in bientot if s.get("prix"))
            texte = (f"🎒 {len(bientot)} sessions de formation générale BAFA commencent dans les 30 prochains jours"
                     + ((f", dont {', '.join(f'{n} à {v}' for v, n in villes)}" if villes[0][1] > 1 else f", notamment à {', '.join(v for v, _ in villes)}") if villes else "") + "."
                     + (f" Prix médian : {prix[len(prix) // 2]:.0f} €." if prix else "")
                     + "\n\nToutes les dates, les prix et les places près de chez vous, comparés gratuitement 👉")
            idees.append({"cle": f"bafa-30j-{cle}", "titre": "Les sessions BAFA du mois", "pour": "jeunes", "texte": texte, "lien": "/se-former/sessions/"})
            for v, n in villes[:2]:
                u = villes_url.get(f"Passer le BAFA à {v}")
                if u and n > 1:
                    idees.append({"cle": f"bafa-{u.strip('/').rsplit('/', 1)[1]}-{cle}", "titre": f"Le BAFA à {v}", "pour": "jeunes",
                                  "texte": f"📍 Vous voulez passer votre BAFA à {v} ? {n} sessions de formation générale commencent dans le mois qui vient. Comparez les dates et les prix 👉", "lien": u})
        appro = [s for s in self.sessions if s["diplome"] == "BAFA" and s["type"] == "approfondissement" and auj <= s["debut"] <= auj + dt.timedelta(days=45)]
        if appro:
            themes = collections.Counter(s["theme"] for s in appro if s.get("theme")).most_common(3)
            idees.append({"cle": f"appro-{cle}", "titre": "Les approfondissements du moment", "pour": "jeunes",
                          "texte": f"🌊 Il vous reste l'approfondissement ? {len(appro)} sessions dans les 6 semaines qui viennent"
                                   + (f" (les thèmes les plus proposés : {', '.join(t for t, _ in themes)})" if themes else "") + ". Trouvez la vôtre 👉",
                          "lien": "/se-former/sessions/"})
        for a in (self.articles or [])[:3]:
            idees.append({"cle": "article-" + a["url"].strip("/").rsplit("/", 1)[1], "titre": "Article : " + a["titre"], "pour": "jeunes",
                          "texte": f"📖 {a['titre']}\n\n{a.get('resume') or a.get('description') or ''}\n\nÀ lire sur le blog 👉", "lien": a["url"]})
        idees.append({"cle": f"recruter-{cle}", "titre": "Pour les structures qui recrutent", "pour": "structures",
                      "texte": "🧭 Vous cherchez des animateurs pour les vacances ? Sur Fil Roug'Anim, ce sont les animateurs qui décrivent le poste qu'ils cherchent : leur demande arrive directement chez les structures les plus proches. Créez la page de votre structure 👉",
                      "lien": "/trouver-un-poste/structures/"})
        idees.append({"cle": f"demande-{cle}", "titre": "Pour les animateurs qui cherchent un poste", "pour": "animateurs",
                      "texte": "✋ Animateur, stagiaire BAFA ou directeur ? Décrivez en 2 minutes le poste que vous cherchez (quand, où, quel public) : votre demande part chez les structures les plus proches de chez vous. Gratuit 👉",
                      "lien": "/trouver-un-poste/demande/"})
        # les séjours : pour les familles (dès 3 séjours à venir), et toujours pour les organisateurs
        sj = [x for x in getattr(self, "sejours", []) if x.get("a_venir")]
        if len(sj) >= 3:
            pc = [x for x in sj if "pass_colo" in (x.get("aides") or [])]
            envie = collections.Counter(e for x in sj for e in (x.get("envies") or [])).most_common(1)
            texte = (f"☀️ {len(sj)} séjours et accueils de loisirs pour les 3-17 ans sur Fil Roug'Anim"
                     + (f", dont {len(pc)} avec le Pass Colo (jusqu'à 350 € d'aide pour les 11 ans)" if pc else "")
                     + (f". Le plus demandé en ce moment : {SEJ_ENVIES.get(envie[0][0], envie[0][0]).lower()}" if envie else "")
                     + ".\n\nCherchez par âge et par période, et demandez une place en ligne, sans frais 👉")
            idees.append({"cle": f"sejours-{cle}", "titre": "Les séjours du moment", "pour": "familles", "texte": texte, "lien": "/enfants/"})
            idees.append({"cle": f"aides-{cle}", "titre": "Les aides pour partir en colo", "pour": "familles",
                          "texte": "💶 Pass Colo, aide de la CAF, Chèques-Vacances, CSE : une colo coûte souvent bien moins cher qu'on ne le pense. Calculez ce qu'il vous restera à payer 👉",
                          "lien": "/enfants/aides/"})
        idees.append({"cle": f"organisateurs-{cle}", "titre": "Pour les organisateurs de séjours", "pour": "structures",
                      "texte": "🏕️ Vous organisez des colos ou un accueil de loisirs ? Publiez vos séjours gratuitement sur Fil Roug'Anim : les familles les trouvent par âge et par période, et vous demandent une place en ligne. Sans commission 👉",
                      "lien": "/recruter/sejours/"})
        return {"semaine": cle, "idees": idees}

    def lieux_google(self):
        """Les villes, départements et régions avec leurs pages et ce que Google en montre (calculé une fois)."""
        if getattr(self, "_lieux", None) is not None:
            return self._lieux
        g = {}
        for u, imp, clics, place in self.audience().get("pages_google") or []:
            u = u.split("?")[0].split("#")[0]
            g[u if u.endswith("/") else u + "/"] = (imp, clics, place)
        lieux = {}
        for p in self.pages:
            if not p.get("indexer") or p["gabarit"] not in ("liste.html", "ecoles.html", "local.html"):
                continue
            u = p["url"]
            dep = p.get("departement")
            if p["gabarit"] == "local.html":
                if not p.get("lieu"):
                    continue
                nom, genre = p["lieu"]["n"], p["lieu"]["g"]
                dep = self.departements.get(p["lieu"]["d"]) if p["lieu"]["d"] else None
            elif p.get("ville"):
                nom, genre = p["ville"]["nom"], "ville"
            elif dep and len(p.get("fil") or []) >= 2 and p["fil"][-1][0] not in (dep["nom"],) and p.get("villes_famille") is not None \
                    and any(v["slug"] == u.rstrip("/").rsplit("/", 1)[-1] for v in p.get("villes_famille") or []):
                nom, genre = p["fil"][-1][0], "ville"
            elif u.startswith("/se-former/ecoles/") and u.count("/") == 6:
                nom, genre = p["fil"][-1][0], "ville"
                dep = next((d for d in self.departements.values() if d["slug"] == u.split("/")[4]), None)
            elif dep:
                nom, genre = dep["nom"], "departement"
            elif p.get("region") or p.get("region_famille"):
                r = p.get("region") or p.get("region_famille")
                nom, genre, dep = r["nom"], "region", None
            else:
                continue
            cle = f"{genre}|{nom}|{dep['code'] if dep and genre == 'ville' else ''}"
            e = lieux.setdefault(cle, {"n": nom, "g": genre, "d": dep["code"] if dep and genre != "region" else "", "p": []})
            imp, clics, place = g.get(u, (0, 0, None))
            e["p"].append([p.get("h1") or p["titre"], u, imp, clics, place])
        sortie = sorted(lieux.values(), key=lambda e: (-sum(x[2] for x in e["p"]), e["n"]))
        for e in sortie:
            e["p"].sort(key=lambda x: -x[2])
        self._lieux = sortie
        return sortie

    def ecrire_rss(self):
        base = self.config["url"].rstrip("/")
        items = []
        for a in getattr(self, "articles", [])[:30]:
            jour = dt.datetime.combine(a["date"], dt.time(8, 0)).strftime("%a, %d %b %Y %H:%M:%S +0000")
            items.append(f"<item><title>{html.escape(a['titre'])}</title><link>{base}{a['url']}</link>"
                         f"<guid>{base}{a['url']}</guid><pubDate>{jour}</pubDate>"
                         f"<description>{html.escape(a['description'])}</description></item>")
        (SORTIE / "blog").mkdir(parents=True, exist_ok=True)
        (SORTIE / "blog" / "rss.xml").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
            f"<title>{html.escape(self.config['nom'])} : le blog</title><link>{base}/blog/</link>"
            f"<description>Conseils et chiffres sur le BAFA et l'animation</description><language>fr</language>"
            + "".join(items) + "</channel></rss>\n", encoding="utf-8")

    FAMILLES_GOOGLE = [("bafa", "BAFA"), ("bafd", "BAFD"), ("bsb", "BSB"), ("psc", "PSC"), ("ecoles", "Écoles pros"),
                       ("parent", "Parents"), ("anim", "Emploi animateur"), ("struct", "Recrutement"), ("conseils", "Guides et blog")]
    # les pages locales (pages_locales), rangées par public
    BASES_LOCALES = {"parent": ("/enfants/centre-de-loisirs/", "/enfants/colonie-de-vacances/", "/enfants/periscolaire/"),
                     "anim": ("/trouver-un-poste/emploi-animateur/", "/trouver-un-poste/stage-pratique-bafa/", "/trouver-un-poste/emploi-directeur/", "/trouver-un-poste/job-ete-animateur/"),
                     "struct": ("/recruter/animateurs-bafa/", "/recruter/directeur-bafd/", "/recruter/stagiaire-bafa/", "/recruter/saisonniers-ete/")}

    def famille_page(self, url):
        """La famille d'une page, pour ranger les pages vues dans Google par formation."""
        if url.startswith("/se-former/ecoles/"):
            return "ecoles"
        if url.startswith("/se-former/sessions/"):
            for cle, mot in (("psc", "/psc1/"), ("bsb", "/bsb/"), ("bafd", "/bafd/")):
                if mot in url or url.endswith(mot.rstrip("/") + "/"):
                    return cle
            return "bafa"
        for cle, bases in self.BASES_LOCALES.items():
            if url.startswith(bases) and url not in bases:
                return cle
        if url.startswith(("/blog/", "/lexique/", "/se-former/", "/trouver-un-poste/")):
            return "conseils"
        return None

    def chiffres_detail(self):
        """Les chiffres de Google, page par page et recherche par recherche, avec le titre des pages du site."""
        if getattr(self, "_detail", None) is not None:
            return self._detail
        a = self.audience()
        titres = {p["url"]: p.get("h1") or p["titre"] for p in self.pages}
        pages = []
        for x in a.get("pages_premiere_page") or []:
            u = x["url"].split("?")[0].split("#")[0]
            u = u if u.endswith("/") else u + "/"
            if u in titres:
                pages.append(dict(x, url=u, titre=titres[u], famille=self.famille_page(u)))
        familles = [(cle, nom, [p for p in pages if p["famille"] == cle]) for cle, nom in self.FAMILLES_GOOGLE]
        # les inscriptions, département par département (avec le nom du département)
        par_dep = [dict(x, nom=self.departements[x["departement"]]["nom"]) for x in a.get("inscriptions_par_departement") or []
                   if x.get("departement") in self.departements]
        maxi = max((x["animateurs"] + x["structures"] for x in a.get("inscriptions_par_mois") or []), default=0) or 1
        par_mois = [dict(x, nom=MOIS_COURTS[int(x["mois"][5:7]) - 1], h=round(100 * (x["animateurs"] + x["structures"]) / maxi))
                    for x in a.get("inscriptions_par_mois") or []]
        self._detail = {"pages": pages, "familles": [f for f in familles if f[2]], "inscriptions_dep": par_dep,
                        "inscriptions_mois": par_mois,
                        "premiere_inscription": a.get("premiere_inscription"),
                        "recherches": a.get("recherches") or [],
                        "site": {"sessions": len(self.sessions), "organismes": len({s["org"]["nom"] for s in self.sessions}),
                                 "villes": getattr(self, "total_villes", 0),
                                 "pages": sum(1 for p in self.pages if p.get("indexer")),
                                 "ecoles": len(self.ecoles_pro()), "articles": len(getattr(self, "articles", []))}}
        return self._detail

    POSTES_DEMANDE = {"animateur-stagiaire": "Stage pratique BAFA", "animateur": "Animateur", "directeur-adjoint": "Direction adjointe",
                      "directeur": "Direction", "surveillant-baignade": "Surveillant de baignade", "coordinateur": "Coordination", "autre": "Autre poste"}

    def chiffres_page(self):
        """La page /chiffres/ et le bloc de l'accueil, sur le modèle de jasonmarinho.com/chiffres : la courbe des affichages
        Google (par mois, ou par semaine tant que le site a moins de trois mois mesurés), le multiplicateur depuis le premier
        mois mesuré, les demandes reçues (sans rien sur la personne) et les villes en première page de Google, formation par formation."""
        if getattr(self, "_cp", None) is not None:
            return self._cp
        a = self.audience()
        # la courbe : par mois s'il y a au moins trois mois avec des affichages, sinon par semaine
        mois = [x for x in a.get("impressions_par_mois") or [] if x.get("n")]
        jours = a.get("impressions_par_jour") or []
        serie, unite = [], "mois"
        if len(mois) >= 3 or not jours:
            for x in mois[-6:]:
                serie.append({"l": MOIS_COURTS[int(x["mois"][5:7]) - 1].rstrip("."), "n": x["n"], "en_cours": bool(x.get("en_cours"))})
        else:
            unite = "semaine"
            debut = next((dt.date.fromisoformat(j[0]) for j in jours if j[1]), None)
            if debut:
                fin = dt.date.fromisoformat(jours[-1][0])
                parj = {j[0]: j[1] for j in jours}
                d = debut
                while d <= fin:
                    n = sum(parj.get((d + dt.timedelta(days=k)).isoformat(), 0) for k in range(7))
                    serie.append({"l": f"{d.day} {MOIS_COURTS[d.month - 1].rstrip('.')}", "n": n, "en_cours": d + dt.timedelta(days=6) > fin})
                    d += dt.timedelta(days=7)
                serie = serie[-8:]
        complets = [x for x in serie if not x["en_cours"]]
        multi = None
        if len(complets) >= 2 and complets[0]["n"] and complets[-1]["n"] / complets[0]["n"] >= 1.2:
            multi = {"x": f"{complets[-1]['n'] / complets[0]['n']:.1f}".replace(".", ","),
                     "fin": complets[-1]["l"], "debut": complets[0]["l"], "unite": unite}
        # les points du graphe (coordonnées en pour cent, pour un SVG qui s'étire)
        maxi = max((x["n"] for x in serie), default=0) or 1
        for i, x in enumerate(serie):
            x["x"] = round(3 + 94 * (i / (len(serie) - 1) if len(serie) > 1 else 0.5), 2)
            x["y"] = round(88 - 76 * x["n"] / maxi, 2)
        # les demandes et candidatures reçues (la base ne donne ni nom ni message)
        brut = self.lire_supabase("rpc/chiffres_publics", "chiffres publics des demandes")
        dem = (brut or {}).get("demandes") if isinstance(brut, dict) else []
        # les villes en première page de Google, formation par formation
        g = {}
        for u, imp, clics, place in a.get("pages_google") or []:
            u = u.split("?")[0].split("#")[0]
            g[u if u.endswith("/") else u + "/"] = (imp, clics, place)
        par_famille = {cle: [] for cle, _ in self.FAMILLES_GOOGLE}
        # les pages de ville (les mêmes que « Les chiffres de ta ville »), formation par formation
        for e in self.lieux_google():
            for titre, u, imp, clics, place in e["p"]:
                if not place or place > 10:
                    continue
                fam = self.famille_page(u)
                # les formations : les pages de ville ; les pages locales (parents, emploi, recrutement) : ville, département ou région
                if e["g"] != "ville" and fam not in self.BASES_LOCALES:
                    continue
                if fam in par_famille:
                    par_famille[fam].append({"v": e["n"], "t": titre, "u": u, "i": imp, "c": clics, "p": place})
        for l in par_famille.values():
            l.sort(key=lambda x: (x["p"], -x["i"]))
        onglets = [(cle, nom, par_famille[cle]) for cle, nom in self.FAMILLES_GOOGLE if cle != "conseils"]
        cm = self.aujourdhui
        en_cours = next((x for x in a.get("impressions_par_mois") or [] if x.get("en_cours")), None)
        self._cp = {"serie": serie, "unite": unite, "multi": multi, "demandes": dem or [], "postes": self.POSTES_DEMANDE,
                    "deps": {d["code"]: d["nom"] for d in self.departements.values()},
                    "structures_dep": (brut or {}).get("structures_par_dep") if isinstance(brut, dict) else {},
                    "familles": (brut or {}).get("familles") or [] if isinstance(brut, dict) else [],
                    "fiches_animateurs": (brut or {}).get("fiches_animateurs") or 0 if isinstance(brut, dict) else 0,
                    "structures_verifiees": (brut or {}).get("structures_verifiees") or 0 if isinstance(brut, dict) else 0,
                    "offres_enfants": (brut or {}).get("offres_enfants") or 0 if isinstance(brut, dict) else 0,
                    "onglets": onglets, "villes_premiere": sum(len(x[2]) for x in onglets),
                    "mois_en_cours": {"nom": MOIS[cm.month - 1], "n": en_cours["n"]} if en_cours else None}
        return self._cp

    def panneau_chiffres(self):
        """La petite fenêtre « Le site en chiffres » du bouton statistiques (comme sur jasonmarinho.com) : les chiffres de
        Google et des visites dès qu'ils existent, sinon les chiffres du site lui-même (sessions, organismes, villes)."""
        if getattr(self, "_panneau", None) is not None:
            return self._panneau
        a = self.audience()
        fr = lambda n: f"{n:,}".replace(",", " ")
        evo = lambda x: (f"{'+' if x >= 0 else ''}{x} %" if x is not None else None)
        cartes, barres = [], []
        if a.get("visiteurs_30j") is not None:
            cartes.append(("Visiteurs", fr(a["visiteurs_30j"]), evo(a.get("visiteurs_evolution")) or "sur 30 jours"))
        if a.get("impressions_28j") is not None:
            cartes.append(("Vus dans Google", fr(a["impressions_28j"]), evo(a.get("impressions_evolution")) or "sur 28 jours"))
        if a.get("clics_28j") is not None:
            cartes.append(("Clics depuis Google", fr(a["clics_28j"]), evo(a.get("clics_evolution")) or "sur 28 jours"))
        if a.get("recherches_premiere_page") is not None:
            cartes.append(("Recherches en 1re page", fr(a["recherches_premiere_page"]), "dans Google, sur 28 jours"))
        if a.get("comptes"):
            cartes.append(("Comptes créés", fr(a["comptes"]), "animateurs et structures"))
        titre_barres = "Affichages Google par mois"
        if a.get("impressions_par_mois"):
            barres = [(x["nom"], x["h"], fr(x["n"])) for x in a["impressions_par_mois"]]
        S = self.sessions
        complement = [("Sessions à venir", fr(len(S)), "relevées chaque nuit"),
                      ("Organismes", fr(len({s["org"]["nom"] for s in S})), "comparés, aucun ne paie"),
                      ("Villes", fr(getattr(self, "total_villes", 0) or len({(s["departement"], s["ville"]) for s in S})), "avec leur page"),
                      ("Pages du site", fr(sum(1 for p in self.pages if p.get("indexer"))), "dans le plan du site")]
        for c in complement:
            if len(cartes) >= 4:
                break
            cartes.append(c)
        if not barres:
            titre_barres = "Sessions par mois de départ"
            par_mois = collections.Counter(s["mois"] for s in S)
            mois = sorted(par_mois)[:6]
            maxi = max((par_mois[m] for m in mois), default=1) or 1
            barres = [(MOIS_COURTS[int(m[5:7]) - 1], round(100 * par_mois[m] / maxi), fr(par_mois[m])) for m in mois]
        self._panneau = {"cartes": cartes[:4], "barres": barres, "titre_barres": titre_barres,
                         "badge": "28 derniers jours" if a.get("impressions_28j") is not None else "Données réelles",
                         "source": "Google Search Console et mesures du site" if a else "Relevé chaque nuit sur les pages des organismes"}
        return self._panneau

    def recherches_frequentes(self):
        """Le bloc « Recherches fréquentes » au-dessus du pied de page : les pages les plus fournies de chaque famille."""
        if getattr(self, "_recherches", None) is not None:
            return self._recherches
        pages = {p["url"]: p for p in self.pages if p.get("indexer") and p["gabarit"] in ("liste.html", "ecoles.html")}
        def n(p):
            return p.get("sessions_total") or len(p.get("sessions") or p.get("ecoles") or [])
        def top(filtre, nom, k=10):
            vus, r = set(), []
            for p in sorted((p for u, p in pages.items() if filtre(u)), key=n, reverse=True):
                t = nom(p)
                if t not in vus and (k is None or len(r) < k):
                    vus.add(t)
                    r.append((t, p["url"]))
            return r
        B = "/se-former/sessions/"
        deps = {d["slug"] for d in self.departements.values()}
        regs = {r["slug"] for r in self.regions.values()}
        def parts(u):
            return u[len(B):].strip("/").split("/") if u.startswith(B) else []
        def dep_nom(p):
            return p["departement"]["nom"]

        def reg_nom(p):
            return (p.get("region") or p.get("region_famille"))["nom"]

        def famille(cle):
            """villes, départements et régions d'une famille de pages (bafd, psc1, bsb)"""
            return [("Par ville", top(lambda u: len(parts(u)) == 3 and parts(u)[1] == cle and parts(u)[0] in deps,
                                      lambda p: p["fil"][-1][0], None)),
                    ("Par département", top(lambda u: len(parts(u)) == 2 and parts(u)[1] == cle and parts(u)[0] in deps, dep_nom, None)),
                    ("Par région", top(lambda u: len(parts(u)) == 2 and parts(u)[1] == cle and parts(u)[0] in regs, reg_nom, None))]

        sections = [
            {"cle": "bafa", "titre": "BAFA", "aide": "Formation générale et approfondissement : les sessions BAFA près de chez vous.",
             "groupes": [("Par ville", top(lambda u: len(parts(u)) == 2 and parts(u)[0] in deps and pages[u].get("ville"),
                                           lambda p: p["ville"]["nom"], None)),
                         ("Par département", top(lambda u: len(parts(u)) == 1 and parts(u)[0] in deps, dep_nom, None)),
                         ("Par région", top(lambda u: len(parts(u)) == 1 and parts(u)[0] in regs, lambda p: p["region"]["nom"], None))],
             "tout": ("Toutes les sessions BAFA", "/se-former/sessions/bafa/")},
            {"cle": "bafd", "titre": "BAFD", "aide": "Devenir directeur d'accueil collectif de mineurs : formation générale et perfectionnement.",
             "groupes": famille("bafd"), "tout": ("Toutes les sessions BAFD", "/se-former/sessions/bafd/")},
            {"cle": "bsb", "titre": "BSB", "aide": "La qualification surveillant de baignade, 8 jours, très demandée pour les colos d'été.",
             "groupes": famille("bsb"), "tout": ("Toutes les sessions BSB", "/se-former/sessions/bsb/")},
            {"cle": "psc", "titre": "PSC", "aide": "Une journée pour apprendre les gestes de premiers secours, souvent demandée aux animateurs.",
             "groupes": famille("psc1"), "tout": ("Toutes les formations PSC", "/se-former/sessions/psc1/")},
        ]
        E = "/se-former/ecoles/"
        for di in ("CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS"):
            sl = self.diplomes[di]["slug"]
            sections.append({
                "cle": sl, "titre": di, "aide": f"Les écoles qui préparent au {di}, avec la prochaine rentrée, le prix et le CPF.",
                "groupes": [("Par ville", top(lambda u, sl=sl: u.startswith(f"{E}{sl}/") and u.count("/") == 6,
                                              lambda p: p["fil"][-1][0], None)),
                            ("Par département", top(lambda u, sl=sl: u.startswith(f"{E}{sl}/") and u.count("/") == 5 and u.split("/")[4] in deps,
                                                    lambda p: p["fil"][-1][0], None)),
                            ("Par région", top(lambda u, sl=sl: u.startswith(f"{E}{sl}/") and u.count("/") == 5 and u.split("/")[4] in regs,
                                               lambda p: p["fil"][-1][0], None))],
                "tout": (f"Toutes les écoles du {di}", f"{E}{sl}/")})
        # les pages locales (pages_locales) : parents, emploi d'animateur, recrutement, par ville, département et région
        loc = [p for p in self.pages if p["gabarit"] == "local.html" and p.get("indexer") and p.get("lieu")]
        def groupes_locaux(bases):
            out = []
            for base, sujet in bases:
                for g, nom in (("ville", "par ville"), ("departement", "par département"), ("region", "par région")):
                    l = sorted({(p["lieu"]["n"], p["url"]) for p in loc if p["url"].startswith(base) and p["url"] != base and p["lieu"]["g"] == g})
                    if l:
                        out.append((f"{sujet} {nom}", l))
            return out
        sections += [
            {"cle": "parents", "titre": "Parents", "aide": "Centres de loisirs, colonies de vacances et périscolaire : les pages de votre ville et de votre département.",
             "groupes": groupes_locaux([("/enfants/centre-de-loisirs/", "Centres de loisirs"), ("/enfants/colonie-de-vacances/", "Colonies de vacances"), ("/enfants/periscolaire/", "Périscolaire")]),
             "tout": ("Inscrire mon enfant", "/enfants/"), "az": False},
            {"cle": "emploi", "titre": "Emploi animateur", "aide": "Offres, structures qui recrutent, stage pratique et postes de direction près de chez vous.",
             "groupes": groupes_locaux([("/trouver-un-poste/emploi-animateur/", "Emploi animateur"), ("/trouver-un-poste/stage-pratique-bafa/", "Stage pratique BAFA"),
                                        ("/trouver-un-poste/emploi-directeur/", "Emploi directeur"), ("/trouver-un-poste/job-ete-animateur/", "Job d'été")]),
             "tout": ("Toutes les offres", "/trouver-un-poste/offres/"), "az": False},
            {"cle": "recrutement", "titre": "Recruter", "aide": "Pour les structures : recruter des animateurs, un directeur, un stagiaire ou des saisonniers dans votre secteur.",
             "groupes": groupes_locaux([("/recruter/animateurs-bafa/", "Recruter des animateurs"), ("/recruter/directeur-bafd/", "Recruter un directeur"),
                                        ("/recruter/stagiaire-bafa/", "Accueillir un stagiaire"), ("/recruter/saisonniers-ete/", "Saisonniers d'été")]),
             "tout": ("Recruter avec Fil Roug'Anim", "/recruter/"), "az": False},
        ]
        self._recherches = []
        for x in sections:
            x["groupes"] = [g for g in x["groupes"] if g[1]]
            if x["groupes"]:
                self._recherches.append(x)
        return self._recherches
        pages = {p["url"]: p for p in self.pages if p.get("indexer") and p["gabarit"] in ("liste.html", "ecoles.html")}
        def n(p):
            return p.get("sessions_total") or len(p.get("sessions") or p.get("ecoles") or [])
        def top(filtre, nom, k=10):
            vus, r = set(), []
            for p in sorted((p for u, p in pages.items() if filtre(u)), key=n, reverse=True):
                t = nom(p)
                if t not in vus and len(r) < k:
                    vus.add(t)
                    r.append((t, p["url"]))
            return r
        B = "/se-former/sessions/"
        deps = {d["slug"] for d in self.departements.values()}
        regs = {r["slug"] for r in self.regions.values()}
        def parts(u):
            return u[len(B):].strip("/").split("/") if u.startswith(B) else []
        villes_bafa = top(lambda u: len(parts(u)) == 2 and parts(u)[0] in deps and pages[u].get("ville"), lambda p: p["ville"]["nom"], 24)
        deps_bafa = top(lambda u: len(parts(u)) == 1 and parts(u)[0] in deps, lambda p: p["departement"]["nom"], 24)
        psc = top(lambda u: len(parts(u)) == 3 and parts(u)[1] == "psc1" and parts(u)[0] in deps,
                  lambda p: p["h1"].split(" à ", 1)[1], 24)
        bafd = top(lambda u: len(parts(u)) == 2 and parts(u)[1] == "bafd" and parts(u)[0] in deps, lambda p: p["fil"][-2][0], 24)
        ecoles = top(lambda u: u.startswith("/se-former/ecoles/bpjeps/") and u.count("/") == 5 and u.split("/")[4] not in regs,
                     lambda p: p["fil"][-1][0], 24)
        themes = [(t, u) for t, u, _ in getattr(self, "themes_appro", [])]
        self._recherches = [x for x in [
            {"cle": "bafa-villes", "titre": "BAFA par ville", "aide": "Les villes où les sessions BAFA sont les plus nombreuses : dates, prix et organismes.",
             "liens": villes_bafa, "tout": ("Toutes les sessions BAFA", "/se-former/sessions/bafa/")},
            {"cle": "bafa-deps", "titre": "BAFA par département", "aide": "Formation générale et approfondissement, département par département.",
             "liens": deps_bafa, "tout": ("Toutes les régions", "/se-former/sessions/")},
            {"cle": "psc", "titre": "PSC premiers secours", "aide": "Une journée pour apprendre les gestes qui sauvent, souvent demandée aux animateurs.",
             "liens": psc, "tout": ("Toutes les formations PSC", "/se-former/sessions/psc1/")},
            {"cle": "bafd", "titre": "BAFD", "aide": "Devenir directeur d'accueil collectif de mineurs : les sessions près de chez vous.",
             "liens": bafd, "tout": ("Toutes les sessions BAFD", "/se-former/sessions/bafd/")},
            {"cle": "appro", "titre": "Approfondissements", "aide": "La dernière étape du BAFA, thème par thème.",
             "liens": themes, "tout": ("Tous les approfondissements", "/se-former/sessions/approfondissement/")},
            {"cle": "ecoles", "titre": "Écoles BPJEPS", "aide": "Faire de l'animation son métier : les écoles du BPJEPS, département par département.",
             "liens": ecoles, "tout": ("Toutes les écoles", "/se-former/ecoles/")},
        ] if x["liens"]]
        return self._recherches
        pages = {p["url"]: p for p in self.pages if p.get("indexer") and p["gabarit"] in ("liste.html", "ecoles.html")}
        def n(p):
            return p.get("sessions_total") or len(p.get("sessions") or p.get("ecoles") or [])
        def top(filtre, nom, k=10):
            vus, r = set(), []
            for p in sorted((p for u, p in pages.items() if filtre(u)), key=n, reverse=True):
                t = nom(p)
                if t not in vus and len(r) < k:
                    vus.add(t)
                    r.append((t, p["url"]))
            return r
        B = "/se-former/sessions/"
        deps = {d["slug"] for d in self.departements.values()}
        regs = {r["slug"] for r in self.regions.values()}
        def parts(u):
            return u[len(B):].strip("/").split("/") if u.startswith(B) else []
        villes_bafa = top(lambda u: len(parts(u)) == 2 and parts(u)[0] in deps and pages[u].get("ville"), lambda p: f"BAFA {p['ville']['nom']}")
        deps_bafa = top(lambda u: len(parts(u)) == 1 and parts(u)[0] in deps, lambda p: f"BAFA {p['departement']['nom']}")
        psc = top(lambda u: len(parts(u)) == 3 and parts(u)[1] == "psc1" and parts(u)[0] in deps,
                  lambda p: "PSC " + p["h1"].split(" à ", 1)[1])
        bafd = top(lambda u: len(parts(u)) == 2 and parts(u)[1] == "bafd", lambda p: "BAFD " + p["fil"][-2][0])
        ecoles = top(lambda u: u.startswith("/se-former/ecoles/") and u.count("/") == 5 and u.split("/")[4] not in regs,
                     lambda p: f"{p['fil'][2][0]} {p['fil'][-1][0]}")
        themes = [(t, u) for t, u, _ in getattr(self, "themes_appro", [])[:10]]
        self._recherches = [x for x in [("BAFA par ville", villes_bafa), ("BAFA par département", deps_bafa), ("PSC premiers secours", psc),
                                        ("BAFD", bafd), ("Approfondissement BAFA", themes), ("Écoles pros", ecoles)] if x[1]]
        return self._recherches

    def declarer_ecoles(self, SF):
        """Les écoles des diplômes pros (CPJEPS, BPJEPS, DEJEPS, DESJEPS) : une page par diplôme, par région et par
        département, avec les cartes des écoles dans la page (lisibles par Google, sans JavaScript)."""
        ecoles = self.ecoles_pro()
        BASE = "/se-former/ecoles"
        EC = ("Écoles", f"{BASE}/")
        INTRO = {
            "CPJEPS": "Le premier diplôme professionnel de l'animation (niveau 3, CAP) : animateur d'activités et de vie quotidienne, souvent en alternance.",
            "BPJEPS": "Le diplôme d'animateur professionnel (niveau 4, bac) : concevoir et animer des projets, souvent en alternance ou en apprentissage.",
            "DEJEPS": "Le diplôme de coordinateur (niveau 5, bac+2) : piloter des projets d'animation et une équipe.",
            "DESJEPS": "Le diplôme de directeur (niveau 6, bac+3) : diriger une structure ou un service d'animation.",
        }

        def faq_ecoles(liste, d, lieu):
            px = sorted(e["px"] for e in liste if e.get("px"))
            cpf = sum(1 for e in liste if e.get("cpf"))
            rentrees = [e for e in liste if e.get("pr_t")]
            faq = [{"q": f"Où passer le {d} {lieu} ?",
                    "r": f"{len(liste)} école{'s' if len(liste) > 1 else ''} {'forment' if len(liste) > 1 else 'forme'} au {d} {lieu}"
                         + (", notamment " + ", ".join(sorted({e['o'] for e in liste})[:4]) if len(liste) > 1 else f" : {liste[0]['o']}") + "."}]
            if len(px) >= 2:
                faq.append({"q": f"Combien coûte le {d} {lieu} ?",
                            "r": f"Pour les {len(px)} écoles qui affichent un prix, il va de {euros(px[0])} à {euros(px[-1])}. "
                                 "En apprentissage, la formation est payée par l'employeur et son opérateur de compétences : elle ne coûte rien à l'apprenti."})
            faq.append({"q": f"Peut-on financer le {d} avec le CPF {lieu} ?",
                        "r": (f"Oui : {cpf} des {len(liste)} écoles sont inscrites au catalogue Mon Compte Formation." if cpf
                              else "Aucune de ces écoles n'est inscrite au catalogue Mon Compte Formation pour l'instant : pensez à l'apprentissage, à la Région ou à France Travail.")})
            if rentrees:
                faq.append({"q": f"Quand sont les prochaines rentrées du {d} {lieu} ?",
                            "r": "Rentrées annoncées : " + ", ".join(f"{e['o']} ({e['pr_t']})" for e in rentrees[:4]) + "."})
            for q in faq:
                q["r_rendu"] = q["r"]
            return faq, {"px_min": px[0] if px else None}

        index = []
        for di in ("CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS"):
            d = self.diplomes[di]
            du_d = [e for e in ecoles if e["di"] == di]
            if not du_d:
                continue
            url_d = f"{BASE}/{d['slug']}/"
            index.append((f"{d['nom']} ({d['long'].split('(')[-1].rstrip(')')})", url_d, len(du_d)))
            DI = (d["nom"], url_d)
            par_reg = collections.defaultdict(list)
            par_dep = collections.defaultdict(list)
            for e in du_d:
                par_reg[e["r"]].append(e)
                par_dep[e["d"]].append(e)
            liens_reg = [(r["nom"], f"{url_d}{r['slug']}/", len(par_reg[r["id"]])) for r in self.regions.values() if par_reg[r["id"]]]
            liens_dep = [(f"{dep['nom']} ({dep['code']})", f"{url_d}{dep['slug']}/", len(par_dep[dep["code"]]))
                         for dep in self.departements.values() if par_dep[dep["code"]]]
            autres = [(f"Le {x} en France", f"{BASE}/{self.diplomes[x]['slug']}/", None) for x in ("CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS") if x != di]
            faq, bref = faq_ecoles(du_d, d["nom"], "en France")
            self.ajouter(url_d, "ecoles.html", titre=f"{d['nom']} : les {len(du_d)} écoles qui forment en France",
                         h1=f"Les écoles du {d['nom']}",
                         description=f"Où passer le {d['long']} : les {len(du_d)} écoles et centres de formation en France, région par région, avec la prochaine rentrée, le prix et l'éligibilité au CPF.",
                         intro=INTRO[di], ecoles_total=len(du_d), ecoles=du_d, par_groupe=6, bref=bref,
                         groupes=[(r["nom"], f"{url_d}{r['slug']}/", par_reg[r["id"]]) for r in self.regions.values() if par_reg[r["id"]]],
                         faq_page=faq, schema_faq=self.schema_faq(faq), preset=f"diplome={di}",
                         explorer=[(f"Le {d['nom']}, par région", liens_reg), (f"Le {d['nom']}, par département", liens_dep), ("Les autres diplômes", autres + [(f"Tout savoir sur le {d['nom']}", d["fiche"], None)])],
                         fil=[SF, EC, DI])
            for r in self.regions.values():
                liste = par_reg[r["id"]]
                if not liste:
                    continue
                url = f"{url_d}{r['slug']}/"
                deps_r = [dep for dep in r["deps"] if par_dep[dep["code"]]]
                faq, bref = faq_ecoles(liste, d["nom"], r["a"])
                self.ajouter(url, "ecoles.html", titre=f"{d['nom']} {r['nom']} : {len(liste)} école{'s' if len(liste) > 1 else ''}, rentrées et prix",
                             h1=f"Passer le {d['nom']} {r['a']}",
                             description=f"Les écoles qui préparent au {d['long']} {r['a']} : ville, prochaine rentrée, prix, CPF, département par département.",
                             intro=INTRO[di], ecoles=liste, bref=bref, preset=f"diplome={di}&dep=r:{r['id']}",
                             groupes=[(dep["nom"], f"{url_d}{dep['slug']}/", par_dep[dep["code"]]) for dep in sorted(deps_r, key=lambda x: x["code"])],
                             faq_page=faq, schema_faq=self.schema_faq(faq), indexer=len(liste) >= 2,
                             explorer=[(f"Le {d['nom']}, les autres régions", liens_reg), ("Les autres diplômes " + r["a"],
                                        [(f"Le {x} {r['a']}", f"{BASE}/{self.diplomes[x]['slug']}/{r['slug']}/", None) for x in ("CPJEPS", "BPJEPS", "DEJEPS", "DESJEPS")
                                         if x != di and any(e["di"] == x and e["r"] == r["id"] for e in ecoles)])],
                             fil=[SF, EC, DI, (r["nom"], url)])
            for dep in self.departements.values():
                liste = par_dep[dep["code"]]
                if not liste:
                    continue
                url = f"{url_d}{dep['slug']}/"
                r = dep["reg"]
                par_ville = collections.defaultdict(list)
                for e in liste:
                    par_ville[slug(sans_cedex(e["v"]))].append(e)
                liens_villes = sorted(((x[0]["v"], f"{url}{sv}/", len(x)) for sv, x in par_ville.items() if sv),
                                      key=lambda t: sans_accents(t[0]))
                for nom_v, uv, _ in liens_villes:
                    lv = par_ville[uv.rstrip("/").rsplit("/", 1)[-1]]
                    faq_v, bref_v = faq_ecoles(lv, d["nom"], f"à {nom_v}")
                    self.ajouter(uv, "ecoles.html", titre=f"{d['nom']} {nom_v} ({dep['code']}) : écoles, rentrées et prix",
                                 h1=f"Passer le {d['nom']} à {nom_v}",
                                 description=f"{'Les ' + str(len(lv)) + ' écoles' if len(lv) > 1 else 'L’école'} qui {'préparent' if len(lv) > 1 else 'prépare'} au {d['long']} à {nom_v} ({dep['code']}) : prochaine rentrée, prix et CPF.",
                                 intro=INTRO[di], ecoles=lv, bref=bref_v, preset=f"diplome={di}&dep={dep['code']}",
                                 faq_page=faq_v, schema_faq=self.schema_faq(faq_v),
                                 explorer=[(f"Le {d['nom']} {dep['a']}", [("Tout le département", url, len(liste))] + liens_villes)],
                                 fil=[SF, EC, DI, (r["nom"], f"{url_d}{r['slug']}/"), (dep["nom"], url), (nom_v, uv)])
                faq, bref = faq_ecoles(liste, d["nom"], dep["a"])
                self.ajouter(url, "ecoles.html", titre=f"{d['nom']} {dep['nom']} ({dep['code']}) : écoles, rentrées et prix",
                             h1=f"Passer le {d['nom']} {dep['a']}",
                             description=f"Les {len(liste)} écoles qui préparent au {d['long']} {dep['a']} ({dep['code']}) : ville, prochaine rentrée, prix et CPF.",
                             intro=INTRO[di], ecoles=liste, bref=bref, preset=f"diplome={di}&dep={dep['code']}",
                             faq_page=faq, schema_faq=self.schema_faq(faq),
                             explorer=[(f"Le {d['nom']}, par ville", liens_villes), (f"Le {d['nom']} {r['a']}", [(f"Toute la région", f"{url_d}{r['slug']}/", len(par_reg[r["id"]]))]
                                        + [x for x in liens_dep if x[1].split("/")[-2] in {dd["slug"] for dd in r["deps"]}]),
                                       ("Se former " + dep["a"], [(f"Le BAFA {dep['a']}", f"/se-former/sessions/{dep['slug']}/", None)] + list(dep.get("sous") or []))],
                             fil=[SF, EC, DI, (r["nom"], f"{url_d}{r['slug']}/"), (dep["nom"], url)])
        self.ajouter(f"{BASE}/", "ecoles.html", titre="Écoles CPJEPS, BPJEPS, DEJEPS et DESJEPS en France",
                     h1="Les écoles des métiers de l'animation",
                     description="Toutes les écoles qui préparent aux diplômes professionnels de l'animation (CPJEPS, BPJEPS, DEJEPS, DESJEPS), par diplôme, région et département.",
                     intro="Faire de l'animation son métier : les écoles qui préparent aux diplômes professionnels, avec les rentrées, les prix et le CPF.",
                     ecoles=[], preset="", explorer=[("Par diplôme", index)], fil=[SF, EC])

    def declarer_declinaisons(self, SF, RUB):
        """Les pages qui répondent aux recherches précises : chaque formation (BAFD, PSC) et chaque étape du BAFA
        par région et par département, le PSC par ville, les vacances par région, les thèmes d'approfondissement
        et les mois. Une page n'est créée que si elle a des sessions : jamais de page vide."""
        S = self.sessions
        BASE = "/se-former/sessions"
        fg, appro = (next(t for t in self.types if t["id"] == i) for i in ("formation-generale", "approfondissement"))

        def familles(liste):
            """(slug, sujet, court, nom affiché, sessions, critères de la recherche) pour un lieu donné"""
            bafa = [s for s in liste if s["diplome"] == "BAFA"]
            return [
                ("formation-generale", "la formation générale du BAFA", "formation générale du BAFA", "Formation générale du BAFA",
                 [s for s in bafa if s["type"] == "formation-generale"], "diplome=BAFA&type=BAFA-formation-generale"),
                ("approfondissement", "l'approfondissement du BAFA", "approfondissement du BAFA", "Approfondissement du BAFA",
                 [s for s in bafa if s["type"] == "approfondissement"], "diplome=BAFA&type=BAFA-approfondissement"),
                ("bafd", "le BAFD", "BAFD", "BAFD", [s for s in liste if s["diplome"] == "BAFD"], "diplome=BAFD"),
                ("psc1", "le PSC", "PSC", "PSC (premiers secours)", [s for s in liste if s["diplome"] == "PSC1"], "diplome=PSC1"),
                ("bsb", "le BSB", "BSB", "BSB (surveillant de baignade)", [s for s in liste if s["diplome"] == "BSB"], "diplome=BSB"),
            ]

        def titres(cle, nom, code, a):
            """titre, h1 et description pour une famille dans un lieu (a : « dans le Rhône », « en Bretagne »)"""
            c = f" ({code})" if code else ""
            return {
                "formation-generale": (f"Formation générale BAFA {nom}{c} : dates et prix",
                                       f"La formation générale du BAFA {a}",
                                       f"Les sessions de formation générale du BAFA {a}{c}, la première étape : dates, ville, internat ou externat, prix et organisme."),
                "approfondissement": (f"Approfondissement BAFA {nom}{c} : thèmes, dates et prix",
                                      f"L'approfondissement du BAFA {a}",
                                      f"Les sessions d'approfondissement du BAFA {a}{c}, la dernière étape : thèmes, dates, ville, formule et prix."),
                "bafd": (f"BAFD {nom}{c} : sessions, dates et prix", f"Passer le BAFD {a}",
                         f"Les sessions BAFD {a}{c} : formation générale et perfectionnement, dates, lieu, formule et prix, organisme par organisme."),
                "bsb": (f"BSB surveillant de baignade {nom}{c} : dates et prix", f"Le BSB, surveillant de baignade, {a}",
                        f"Les sessions de qualification surveillant de baignade (BSB) du BAFA {a}{c} : 8 jours, dates, lieu, formule et prix."),
                "psc1": (f"PSC (ex-PSC1) {nom}{c} : formation premiers secours, dates et prix", f"Se former au PSC {a}",
                         f"Les formations PSC aux premiers secours (ex-PSC1) {a}{c} : une journée, dates, ville, prix et organisme. Utile pour le BAFA."),
            }[cle]

        INTROS = {
            "formation-generale": "La première étape du BAFA : 8 jours pour apprendre les bases, dès 16 ans. Ensuite viennent le stage pratique puis l'approfondissement.",
            "approfondissement": "La dernière étape du BAFA : 6 jours sur un thème, après le stage pratique. C'est après cette session qu'on demande l'aide de la CAF.",
            "bafd": "Le brevet pour diriger un accueil collectif de mineurs, dès 18 ans avec le BAFA : formation générale, stage pratique, perfectionnement, puis second stage.",
            "psc1": "Une journée pour apprendre les gestes de premiers secours, reconnue partout et souvent demandée aux animateurs.",
            "bsb": "La qualification surveillant de baignade du BAFA : 8 jours pour surveiller la baignade d'un groupe en accueil collectif de mineurs.",
        }

        def ajouter_famille(url, cle, sujet, court, nom_aff, liste, critere, lieu, nom, code, a, fil, **extra):
            titre, h1, desc = titres(cle, nom, code, a)
            self.ajouter(url, "liste.html", titre=titre, h1=h1, description=desc, intro=INTROS[cle],
                         sessions=liste, sujet=(sujet, court, a), famille=cle,
                         lien_tout=f"{BASE}/?{critere}" + (f"&dep={lieu}" if lieu else ""), fil=fil, **extra)

        par_dep, par_region = collections.defaultdict(list), collections.defaultdict(list)
        for s in S:
            par_dep[s["dep"]["code"]].append(s)
            par_region[s["dep"]["reg"]["id"]].append(s)

        # -- par département
        for dep in self.departements.values():
            RG = (dep["reg"]["nom"], f"{BASE}/{dep['reg']['slug']}/")
            DP = (dep["nom"], f"{BASE}/{dep['slug']}/")
            dep["sous"] = []
            for cle, sujet, court, nom_aff, liste, critere in familles(par_dep[dep["code"]]):
                if len(liste) < 2:
                    continue
                url = f"{BASE}/{dep['slug']}/{cle}/"
                dep["sous"].append((nom_aff, url, len(liste)))
                villes = self.villes(liste, minimum=1) if cle in ("psc1", "bafd", "bsb") else []
                ajouter_famille(url, cle, sujet, court, nom_aff, liste, critere, dep["code"], dep["nom"], dep["code"], dep["a"],
                                [SF, RUB, RG, DP, (nom_aff, url)], departement=dep, villes_famille=villes)
                for v in villes:
                    uv = f"{url}{v['slug']}/"
                    titre_v, h1_v, desc_v = titres(cle, v["nom"], dep["code"], f"à {v['nom']}")
                    self.ajouter(uv, "liste.html", titre=titre_v, h1=h1_v, description=desc_v,
                                 intro=INTROS[cle], sessions=v["sessions"], sujet=(sujet, court, f"à {v['nom']}"), famille=cle,
                                 departement=dep, villes_famille=villes, lien_tout=f"{BASE}/?{critere}&dep={dep['code']}",
                                 fil=[SF, RUB, RG, DP, (nom_aff, url), (v["nom"], uv)])

        # -- par région
        bafa_th = collections.defaultdict(list)
        for r in self.regions.values():
            RG = (r["nom"], f"{BASE}/{r['slug']}/")
            r["sous"] = []
            de_r = par_region[r["id"]]
            for cle, sujet, court, nom_aff, liste, critere in familles(de_r):
                if len(liste) < 2:
                    continue
                url = f"{BASE}/{r['slug']}/{cle}/"
                r["sous"].append((nom_aff, url, len(liste)))
                ajouter_famille(url, cle, sujet, court, nom_aff, liste, critere, f"r:{r['id']}", r["nom"], None, r["a"],
                                [SF, RUB, RG, (nom_aff, url)], region_famille=r)
                if cle == "approfondissement":  # les thèmes, dans la région
                    for k, nom_th, _ in THEMES_APPRO:
                        du_theme = [s for s in liste if k in themes_de(s["theme"])]
                        if len(du_theme) >= 3:
                            ut = f"{url}{k}/"
                            r["sous"].append((f"Approfondissement : {nom_th.lower()}", ut, len(du_theme)))
                            self.ajouter(ut, "liste.html",
                                         titre=f"Approfondissement BAFA {nom_th.lower()} {r['a']} : dates et prix",
                                         h1=f"Approfondissement « {nom_th.lower()} » {r['a']}",
                                         description=f"Les sessions d'approfondissement du BAFA sur le thème {nom_th.lower()} {r['a']} : dates, ville, formule et prix, organisme par organisme.",
                                         intro=INTROS["approfondissement"], sessions=du_theme, famille=cle, region_famille=r,
                                         sujet=(f"l'approfondissement « {nom_th.lower()} »", f"approfondissement « {nom_th.lower()} »", r["a"]),
                                         lien_tout=f"{BASE}/?{critere}&dep=r:{r['id']}",
                                         fil=[SF, RUB, RG, (nom_aff, url), (nom_th, ut)])
            bafa_r = [s for s in de_r if s["diplome"] == "BAFA"]
            for p in self.periodes:
                liste = [s for s in bafa_r if s["periode"] is p]
                if len(liste) < 2:
                    continue
                url = f"{BASE}/{r['slug']}/{p['slug']}/"
                r["sous"].append((f"BAFA pendant les {p['nom']}", url, len(liste)))
                self.ajouter(url, "liste.html", titre=f"BAFA {r['nom']} {p['nom']} : dates et prix",
                             h1=f"BAFA {r['a']} pendant les {p['nom']}",
                             description=f"Les sessions BAFA {r['a']} pendant les {p['nom']} : formation générale et approfondissement, dates, ville, formule et prix.",
                             intro=f"Les dates des {p['nom']} dépendent de la zone : {self.dates_vacances(p)}.",
                             sessions=liste, periode=p, region_famille=r, sujet=("le BAFA", "BAFA", f"{r['a']} pendant les {p['nom']}"),
                             lien_tout=f"{BASE}/?diplome=BAFA&mois=v:{p['id'].rsplit('-', 1)[0]}&annee={p['id'].rsplit('-', 1)[1]}&dep=r:{r['id']}",
                             fil=[SF, RUB, RG, (p["court"], url)])

        # -- les thèmes d'approfondissement, partout en France
        self.themes_appro = []
        appro_fr = [s for s in S if s["diplome"] == "BAFA" and s["type"] == "approfondissement"]
        for k, nom_th, _ in THEMES_APPRO:
            liste = [s for s in appro_fr if k in themes_de(s["theme"])]
            if len(liste) < 3:
                continue
            url = f"{BASE}/{appro['slug']}/{k}/"
            self.themes_appro.append((nom_th, url, len(liste)))
            self.ajouter(url, "liste.html", titre=f"Approfondissement BAFA {nom_th.lower()} : sessions, dates et prix",
                         h1=f"Approfondissement du BAFA : {nom_th.lower()}",
                         description=f"Toutes les sessions d'approfondissement du BAFA sur le thème {nom_th.lower()} en France : dates, villes, formules et prix.",
                         intro=INTROS["approfondissement"], sessions=liste, famille="approfondissement",
                         sujet=(f"l'approfondissement « {nom_th.lower()} »", f"approfondissement « {nom_th.lower()} »", "en France"),
                         lien_tout=f"{BASE}/?diplome=BAFA&type=BAFA-approfondissement",
                         fil=[SF, RUB, (appro["nom"], f"{BASE}/{appro['slug']}/"), (nom_th, url)])

        # -- mois par mois, pour le BAFA, le BAFD et le PSC
        self.mois_pages = collections.defaultdict(list)
        for d in (self.diplomes["BAFA"], self.diplomes["BAFD"], self.diplomes["PSC1"]):
            par_mois = collections.defaultdict(list)
            for s in S:
                if s["diplome"] == d["id"]:
                    par_mois[s["mois"]].append(s)
            for m, liste in sorted(par_mois.items()):
                if len(liste) < 3:
                    continue
                nom_m = f"{MOIS[int(m[5:7]) - 1]} {m[:4]}"
                url = f"{BASE}/{d['slug']}/{slug(nom_m)}/"
                self.mois_pages[d["id"]].append((nom_m, url, len(liste)))
                self.ajouter(url, "liste.html", titre=f"{d['nom']} {nom_m} : sessions, dates et prix",
                             h1=f"Les sessions {d['nom']} en {nom_m}",
                             description=f"Les sessions {d['long']} qui commencent en {nom_m}, partout en France : dates, ville, formule et prix, organisme par organisme.",
                             sessions=liste, sujet=(f"le {d['nom']}", d["nom"], f"en {nom_m}"), mois_cle=d["id"],
                             lien_tout=f"{BASE}/?diplome={d['id']}&mois=m:{m[5:7]}&annee={m[:4]}",
                             fil=[SF, RUB, (d["nom"], f"{BASE}/{d['slug']}/"), (nom_m, url)])

    def synthese(self, liste, sujet, court, lieu):
        """Le résumé chiffré d'une page de liste et ses questions fréquentes, calculés sur toutes ses sessions :
        chaque page dit quelque chose de propre (prix, dates, organismes, villes), et pas un texte copié."""
        if len(liste) < 3:
            return None, []
        prix = sorted(s["prix"] for s in liste if s["prix"])
        orgs = collections.Counter(s["org"]["nom"] for s in liste)
        villes = collections.Counter(s["ville"] for s in liste)
        formules = collections.Counter(s["formule"] for s in liste if s.get("formule"))
        prochaine = min(liste, key=lambda s: s["debut"])
        r = {"nb": len(liste), "nb_org": len(orgs), "nb_villes": len(villes), "prochaine": prochaine,
             "organismes": orgs.most_common(3), "villes": villes.most_common(3), "prix_n": len(prix),
             "prix_min": prix[0] if prix else None, "prix_max": prix[-1] if prix else None,
             "prix_med": prix[len(prix) // 2] if prix else None}
        faq = []
        if len(prix) >= 2 and prix[0] == prix[-1]:
            faq.append({"q": f"Combien coûte {sujet} {lieu} ?",
                        "r": f"Les {len(prix)} sessions dont le prix est connu coûtent toutes {euros(prix[0])}."})
        elif len(prix) >= 2:
            faq.append({"q": f"Combien coûte {sujet} {lieu} ?",
                        "r": f"Sur les {len(prix)} sessions dont le prix est connu, il va de {euros(prix[0])} à {euros(prix[-1])} ; "
                             f"la moitié des sessions coûtent moins de {euros(r['prix_med'])}. Le prix change surtout avec la formule "
                             "(internat, demi-pension ou externat) et l'organisme."})
        faq.append({"q": f"Quand commence la prochaine session de {court} {lieu} ?",
                    "r": f"La prochaine session relevée commence le {date_fr(prochaine['debut'])} à {prochaine['ville']}, "
                         f"avec {prochaine['org']['nom']}. Il y en a {len(liste)} à venir en tout."})
        noms = ", ".join(f"{n} ({k} session{'s' if k > 1 else ''})" for n, k in orgs.most_common(3))
        faq.append({"q": f"Quels organismes proposent {sujet} {lieu} ?",
                    "r": (f"{len(orgs)} organismes ont des sessions à venir. Ceux qui en proposent le plus : {noms}."
                          if len(orgs) > 1 else f"Pour l'instant, seulement {noms}.")})
        if len(villes) > 1:
            faq.append({"q": f"Dans quelles villes se passe {sujet} {lieu} ?",
                        "r": f"Les sessions ont lieu dans {len(villes)} communes, surtout "
                             + ", ".join(f"{v} ({k})" for v, k in villes.most_common(3)) + "."})
        if formules:
            faq.append({"q": "Internat, demi-pension ou externat ?",
                        "r": "Parmi les sessions dont la formule est indiquée : "
                             + ", ".join(f"{k} en {FORMULES[f].lower()}" for f, k in formules.most_common()) + "."})
        for q in faq:
            q["r_rendu"] = q["r"]
        return r, faq

    def villes(self, sessions, minimum=2):
        """Les communes qui ont assez de sessions pour mériter leur page."""
        par_ville = {}
        for s in sessions:  # « Évreux » et « Evreux » : une seule page
            par_ville.setdefault(slug(sans_cedex(s["ville"])), []).append(s)
        villes = []
        for sl, l in par_ville.items():
            if sl and len(l) >= minimum:  # une session sans commune ne fait pas de page « …// »
                nom = collections.Counter(sans_cedex(s["ville"]) for s in l).most_common(1)[0][0]
                villes.append({"nom": nom, "slug": sl, "sessions": l})
        return sorted(villes, key=lambda v: sans_accents(v["nom"]))

    def ajouter(self, url, gabarit, titre, description=None, indexer=True, **extra):
        if extra.get("sujet") and extra.get("sessions"):
            extra["bref"], extra["faq_page"] = self.synthese(extra["sessions"], *extra.pop("sujet"))
            if extra["faq_page"]:
                extra["schema_faq"] = self.schema_faq(extra["faq_page"])
        dep_page = extra.get("departement")
        if gabarit == "liste.html" and extra.get("sessions") and isinstance(dep_page, dict) and not extra.get("organisme"):
            # formule partenaire : dans un département qu'il a pris, l'organisme partenaire est le seul mis en avant ;
            # les sessions des autres organismes restent consultables, repliées en dessous (et c'est dit sur la page)
            blocs = []
            for part in self.zone_partenaire.get(dep_page.get("code")) or []:
                a_lui = [x for x in extra["sessions"] if x["organisme"] == part["id"]]
                if a_lui:
                    blocs.append({"org": part, "sessions": a_lui})
            if blocs:
                ids = {b_["org"]["id"] for b_ in blocs}
                extra["zone_partenaires"] = blocs
                extra["sessions"] = [x for x in extra["sessions"] if x["organisme"] not in ids]
        if gabarit == "liste.html" and len(extra.get("sessions") or []) > LIMITE_LISTE:
            # une liste très longue : les plus proches ici, toutes les autres dans la recherche avec filtres
            extra["sessions_total"] = len(extra["sessions"])
            extra["sessions"] = extra["sessions"][:LIMITE_LISTE]
        if extra.get("sessions") and "schema" not in extra:
            extra["schema"] = self.schema_sessions(extra["sessions"])
        self.pages.append({"url": url, "gabarit": gabarit, "titre": titre,
                           "description": description or self.config["description"],
                           "indexer": indexer, **extra})

    # -- rendu
    def version_statique(self, chemin):
        """« ?v=… » d'après le contenu des fichiers .js et .css : le navigateur reprend le nouveau fichier dès qu'il change,
        au lieu de garder l'ancien en mémoire pendant dix minutes."""
        if not chemin.endswith((".js", ".css")):
            return ""
        cache = self.__dict__.setdefault("_versions", {})
        if chemin not in cache:
            f = RACINE / "statique" / chemin.lstrip("/")
            cache[chemin] = "?v=" + hashlib.sha1(f.read_bytes()).hexdigest()[:10] if f.is_file() else ""
        return cache[chemin]

    def rendre_page(self, page):
        url_page = page["url"]

        def lien(vers):
            return faire_lien(url_page, vers, self.apercu, self.config.get("chemin_de_base", ""))

        contexte = {
            "site": self.config, "page": page, "lien": lien, "apercu": self.apercu,
            "statique": lambda chemin: lien("/" + chemin.lstrip("/")) + self.version_statique(chemin),
            "toutes_sessions": self.sessions, "departements": list(self.departements.values()),
            "stats": self.stats, "audience": self.audience(), "filtres": self.filtres, "specialites": self.specialites, "offres": self.offres, "diplomes": list(self.diplomes.values()),
            "mois_sessions": sorted({s["mois"] for s in self.sessions}),
            "periodes": self.periodes, "types": self.types, "regions": list(self.regions.values()),
            "themes_appro": getattr(self, "themes_appro", []), "recherches": self.recherches_frequentes(), "pc": self.panneau_chiffres(), "cd": self.chiffres_detail(), "cp": self.chiffres_page(), "MOIS_COURTS_FR": MOIS_COURTS,
            "c": self.chiffres_blog(), "articles": getattr(self, "articles", []), "mois_pages": getattr(self, "mois_pages", {}),
            "annee": self.aujourdhui.year, "aujourdhui": self.aujourdhui,
            "url_complete": self.config["url"].rstrip("/") + url_page.replace("index.html", ""),
            "fil_jsonld": json_ld({"@context": "https://schema.org", "@type": "BreadcrumbList",
                                   "itemListElement": [
                                       {"@type": "ListItem", "position": i, "name": nom,
                                        "item": self.config["url"].rstrip("/") + u}
                                       for i, (nom, u) in enumerate([("Accueil", "/")] + list(page.get("fil", [])), 1)]})
            if page.get("fil") else "",
        }
        if "corps_md" in page:
            rendu = convertir_markdown(self.env.from_string(page["corps_md"]).render(**contexte))
            contexte["contenu"] = re.sub(r'href="(/[^"]*)"', lambda m: f'href="{lien(m.group(1))}"', rendu)
        return self.env.get_template(page["gabarit"]).render(**contexte)

    def construire(self):
        if SORTIE.exists():
            shutil.rmtree(SORTIE)
        SORTIE.mkdir()
        shutil.copytree(RACINE / "statique", SORTIE, dirs_exist_ok=True)
        self.declarer()
        self.dedoublonner()
        for page in self.pages:
            cible = SORTIE / fichier_de_sortie(page["url"])
            cible.parent.mkdir(parents=True, exist_ok=True)
            cible.write_text(self.rendre_page(page), encoding="utf-8")
        self.ecrire_donnees_recherche()
        self.ecrire_pied_liens()
        self.ecrire_lieux_google()
        if not self.apercu:
            self.ecrire_fichiers_seo()
            self.ecrire_rss()
            if self.config.get("nom_de_domaine"):
                (SORTIE / "CNAME").write_text(self.config["nom_de_domaine"] + "\n", encoding="utf-8")
        (SORTIE / ".nojekyll").write_text("", encoding="utf-8")
        print(f"{len(self.pages)} pages fabriquées dans {SORTIE}, {len(self.sessions)} sessions à venir"
              + (" (aperçu)" if self.apercu else ""))

    def ecrire_pied_liens(self):
        """Les listes « Voir N autres villes / départements » du pied de page, chargées au clic :
        écrites dans chaque page, elles pesaient 150 Ko de plus par page (plus de 500 Mo pour tout le site)."""
        plus = {}
        for x in self.recherches_frequentes() or []:
            for i, (nom, liens) in enumerate(x["groupes"]):
                if len(liens) > 24:
                    plus[f"{x['cle']}-{i}"] = [[t, u] for t, u in liens[24:]]
        (SORTIE / "pied-liens.json").write_text(json.dumps(plus, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    def ecrire_donnees_recherche(self):
        """Toutes les sessions, en données compactes, pour la recherche avec filtres (lue par statique/js/filtres.js)."""
        donnees = []
        for s in self.sessions:
            if s["source_nom"]:
                verif = f"{s['source_nom']}, relevé le {date_fr(s['verifie_le'] or s['releve_le'])}, à confirmer auprès de l'organisme"
            else:
                verif = (f"Vérifié le {date_fr(s['verifie_le'])}" if s["verifie_le"] else f"Relevé le {date_fr(s['releve_le'])}") + \
                    ", à confirmer chez l'organisme"
            notes = ([s["prix_note"][0].upper() + s["prix_note"][1:]] if s.get("prix_note") else []) + \
                    ([", ".join(s["aides"])[0].upper() + ", ".join(s["aides"])[1:]] if s.get("aides") else [])
            donnees.append({
                "di": s["diplome"], "dn": s["dipl"]["nom"], "dl": s["dipl"]["long"], "t": s["type"], "tn": s["type_nom"],
                "th": s["theme"], "j": s["debut"].day, "m": s["debut"].strftime("%Y-%m"),
                "dates": dates_fr(s["debut"], s["fin"])[0].upper() + dates_fr(s["debut"], s["fin"])[1:],
                "v": s["ville"], "d": s["departement"], "dn2": s["dep"]["nom"], "r": s["dep"]["region"],
                "p": s["periode"]["id"] if s["periode"] else "autre",
                "f": FORMULES[s["formule"]].lower() if s.get("formule") else None,
                "fo": s.get("formule"),
                "o": s["org"]["nom"], "oi": s["org"]["id"] if s["org"].get("en_ligne") else None, "ok": s["org_cle"],
                "pa": bool(s["org"].get("partenaire")),
                "pz": bool(s["org"].get("partenaire") and s["departement"] in [str(z) for z in (s["org"].get("zones") or [])]),
                "px": s["prix"], "c": bool(s["complet"]), "n": notes, "vf": verif, "u": s["url"],
                "sp": s.get("specialite"), "spn": s["sp"]["nom"] if s["sp"] else None, "spg": s["sp"]["groupe"] if s["sp"] else None,
                "app": s.get("formule") == "apprentissage", "lba": s.get("source") == "catalogue-apprentissage",
                "site": s.get("source") == "ministere",
                "g": self.geo.get(f"{s['departement']}|{s['ville']}")})
        ecoles = self.ecoles_pro()
        (SORTIE / "se-former" / "sessions").mkdir(parents=True, exist_ok=True)
        (SORTIE / "se-former" / "sessions" / "ecoles.json").write_text(
            json.dumps(ecoles, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        cible = SORTIE / "se-former" / "sessions" / "sessions.json"
        cible.parent.mkdir(parents=True, exist_ok=True)
        cible.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    def deja_indexees(self):
        """Les pages que Google a déjà indexées (relevé de outils/indexation.py) : on ne les lui retire pas."""
        if not hasattr(self, "_deja_indexees"):
            f = RACINE / "donnees" / "pages-indexees.txt"
            self._deja_indexees = set(f.read_text(encoding="utf-8").split()) if f.exists() else set()
        return self._deja_indexees

    def dedoublonner(self):
        """Deux pages au même titre (« BAFA Paris » et « BAFA Paris, Paris », le département et son unique ville du même nom) :
        Google n'en garde qu'une et laisse l'autre de côté. La page la plus courte reste ; l'autre la désigne comme page
        de référence (balise canonique) et sort du plan du site."""
        par_titre = collections.defaultdict(list)
        for p in self.pages:
            if p.get("indexer"):
                par_titre[p["titre"]].append(p)
        n = 0
        for groupe in par_titre.values():
            if len(groupe) < 2:
                continue
            groupe.sort(key=lambda p: (len(p["url"]), p["url"]))
            for p in groupe[1:]:
                p["indexer"], p["canonique"] = False, groupe[0]["url"]
                n += 1
        if n:
            print(f"Pages en double : {n} renvoient vers leur page de référence")

    def ecrire_fichiers_seo(self):
        base = self.config["url"].rstrip("/")
        lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
                  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for p in self.pages:
            if p["indexer"]:
                # pas de <lastmod> : la date du jour sur toutes les pages à chaque publication, Google apprend à l'ignorer
                lignes.append(f"  <url><loc>{html.escape(base + p['url'])}</loc></url>")
        lignes.append("</urlset>")
        (SORTIE / "sitemap.xml").write_text("\n".join(lignes) + "\n", encoding="utf-8")
        (SORTIE / "robots.txt").write_text(
            f"User-agent: *\nAllow: /\n\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apercu", action="store_true",
                        help="liens relatifs, pour regarder le site sans serveur")
    parser.add_argument("--date", help="fabriquer le site comme si on était ce jour-là (AAAA-MM-JJ)")
    parser.add_argument("--bilan", action="store_true", help="écrire le bilan du mois (donnees/bilans/), s'il manque")
    args = parser.parse_args()
    site = Site(apercu=args.apercu, aujourdhui=en_date(args.date) if args.date else None)
    if args.bilan:
        return site.ecrire_bilan()
    site.construire()


if __name__ == "__main__":
    sys.exit(main())
