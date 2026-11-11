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
import html
import json
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
PUBLICS = {"3-5": "3-5 ans", "6-11": "6-11 ans", "12-14": "12-14 ans", "15-17": "15-17 ans", "handicap": "Enfants en situation de handicap",
           "familles": "Familles"}
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
                                markdown=convertir_markdown, paragraphes=paragraphes)
        self.env.globals.update(EXEMPLES=self.donnees.get("exemples") or {}, CENTRES_DEP=self.centres_dep, DIPLOMES_PROFIL_NOMS=DIPLOMES_PROFIL, dates_fr=dates_fr, FORMULES=FORMULES, OUTILS=OUTILS, TYPES_STRUCTURE=TYPES_STRUCTURE, FAMILLES_STRUCTURE=FAMILLES_STRUCTURE, FAMILLE_DE=FAMILLE_DE,
                                PUBLICS=PUBLICS, DIPLOMES_PROFIL=DIPLOMES_PROFIL, RECHERCHE=RECHERCHE, EXPERIENCES=EXPERIENCES, CONTRATS=CONTRATS,
                                mois_nom=lambda m: f"{MOIS[int(m[5:7]) - 1]} {m[:4]}")
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
        offres.sort(key=lambda o: (o["debut"], o["id"]))
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
                  "structures(nom,type,site,slug,fondatrice,page_publique)")
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
                "structure": {"nom": st.get("nom", ""), "type": st.get("type"), "site": st.get("site"),
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
        return offres

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
        lignes = (self.lire_supabase(f"structures?select={champs},logo,photos{filtre}", "logos et photos des structures")
                  or self.lire_supabase(f"structures?select={champs}{filtre}", "pages des structures"))
        return [dict(l, exemple=False) for l in lignes if l.get("departement") in self.departements]

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
        cartes.sort(key=lambda c: (-c["n"], c["nom"]))
        autres = collections.Counter(s["org"]["nom"] for s in S if not s["organisme"] and s["diplome"] in ("BAFA", "BAFD", "BSB"))
        self.ajouter("/se-former/sessions/organismes/", "organismes.html", titre="Organismes de formation BAFA, BAFD, BSB et PSC : la liste",
                     h1="Les organismes de formation",
                     description="Les organismes de formation au BAFA, au BAFD, au BSB et au PSC présents sur le site : leurs prochaines sessions, leurs diplômes, leurs prix et le lien vers leur site.",
                     organismes=cartes, autres=autres.most_common(), fil=[SF, RUB, ("Organismes", "/se-former/sessions/organismes/")])
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
        PARTIES = {"se-former": SF, "trouver-un-poste": ("Animateurs & directeurs", "/trouver-un-poste/")}
        guides = []
        for f in sorted((RACINE / "contenu" / "guides").glob("*.md")):
            entete, corps = lire_markdown(f)
            partie = PARTIES[entete["partie"]]
            url = f"{partie[1]}{f.stem}/"
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
        for pg in self.pages:
            if pg["url"] == "/trouver-un-poste/":
                pg["faq_tp"], pg["schema_faq"] = faq_tp, self.schema_faq(faq_tp)
        for o in self.offres:
            self.ajouter(f"/trouver-un-poste/offres/{o['id']}/", "offre.html", titre=f"{o['intitule']} à {o['ville']}",
                         description=f"{o['intitule']} : {o['structure']['nom']}, {o['ville']} ({o['departement']}), à partir du {date_fr(o['debut'])}. Candidature directe auprès de la structure, gratuite.",
                         offre=o, schema=self.schema_offre(o),
                         fil=[("Animateurs & directeurs", "/trouver-un-poste/"), (o["intitule"], f"/trouver-un-poste/offres/{o['id']}/")])
        self.ajouter("/trouver-un-poste/offres/", "offres.html", titre="Offres de stages pratiques BAFA et de jobs d'animation",
                     description="Les offres de stages pratiques BAFA, de jobs d'été et de postes d'animation publiées par les structures vérifiées, avec des filtres par département, contrat, poste et date.",
                     h1="Les offres d'animation", indexer=bool(self.offres),
                     mois=sorted({o["debut"].strftime("%Y-%m") for o in self.offres}),
                     fil=[("Animateurs & directeurs", "/trouver-un-poste/"), ("Les offres", "/trouver-un-poste/offres/")])
        # l'annuaire inversé : le candidat décrit le poste qu'il cherche, les structures les plus proches reçoivent sa demande
        self.ajouter("/trouver-un-poste/demande/", "demande.html", titre="Trouver une structure : décrivez le poste que vous cherchez",
                     description="Stage pratique BAFA, colo, centre de loisirs, direction : décrivez le poste que vous cherchez, et votre demande part chez les 3 structures d'animation les plus proches de chez vous. Gratuit, sans intermédiaire.",
                     fil=[("Animateurs & directeurs", "/trouver-un-poste/"), ("Décrire ce que je cherche", "/trouver-un-poste/demande/")])
        # pages publiques des structures vérifiées, et les exemples fictifs
        TP = ("Animateurs & directeurs", "/trouver-un-poste/")
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
        g = {}
        for u, imp, clics, place in self.audience().get("pages_google") or []:
            u = u.split("?")[0].split("#")[0]
            g[u if u.endswith("/") else u + "/"] = (imp, clics, place)
        lieux = {}
        for p in self.pages:
            if not p.get("indexer") or p["gabarit"] not in ("liste.html", "ecoles.html"):
                continue
            u = p["url"]
            dep = p.get("departement")
            if p.get("ville"):
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
        (SORTIE / "chiffres").mkdir(parents=True, exist_ok=True)
        (SORTIE / "chiffres" / "lieux.json").write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

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

    FAMILLES_GOOGLE = [("bafa", "BAFA"), ("bafd", "BAFD"), ("bsb", "BSB"), ("psc", "PSC"), ("ecoles", "Écoles pros"), ("conseils", "Guides et blog")]

    def famille_page(self, url):
        """La famille d'une page, pour ranger les pages vues dans Google par formation."""
        if url.startswith("/se-former/ecoles/"):
            return "ecoles"
        if url.startswith("/se-former/sessions/"):
            for cle, mot in (("psc", "/psc1/"), ("bsb", "/bsb/"), ("bafd", "/bafd/")):
                if mot in url or url.endswith(mot.rstrip("/") + "/"):
                    return cle
            return "bafa"
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
            if len(l) >= minimum:
                nom = collections.Counter(sans_cedex(s["ville"]) for s in l).most_common(1)[0][0]
                villes.append({"nom": nom, "slug": sl, "sessions": l})
        return sorted(villes, key=lambda v: sans_accents(v["nom"]))

    def ajouter(self, url, gabarit, titre, description=None, indexer=True, **extra):
        if extra.get("sujet") and extra.get("sessions"):
            extra["bref"], extra["faq_page"] = self.synthese(extra["sessions"], *extra.pop("sujet"))
            if extra["faq_page"]:
                extra["schema_faq"] = self.schema_faq(extra["faq_page"])
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
    def rendre_page(self, page):
        url_page = page["url"]

        def lien(vers):
            return faire_lien(url_page, vers, self.apercu, self.config.get("chemin_de_base", ""))

        contexte = {
            "site": self.config, "page": page, "lien": lien, "apercu": self.apercu,
            "statique": lambda chemin: lien("/" + chemin.lstrip("/")),
            "toutes_sessions": self.sessions, "departements": list(self.departements.values()),
            "stats": self.stats, "audience": self.audience(), "filtres": self.filtres, "specialites": self.specialites, "offres": self.offres, "diplomes": list(self.diplomes.values()),
            "mois_sessions": sorted({s["mois"] for s in self.sessions}),
            "periodes": self.periodes, "types": self.types, "regions": list(self.regions.values()),
            "themes_appro": getattr(self, "themes_appro", []), "recherches": self.recherches_frequentes(), "pc": self.panneau_chiffres(), "cd": self.chiffres_detail(),
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
                "o": s["org"]["nom"], "oi": s["org"]["id"] if s["org"].get("en_ligne") else None,
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

    def ecrire_fichiers_seo(self):
        base = self.config["url"].rstrip("/")
        lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
                  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for p in self.pages:
            if p["indexer"]:
                lignes.append(f"  <url><loc>{html.escape(base + p['url'])}</loc>"
                              f"<lastmod>{self.aujourdhui.isoformat()}</lastmod></url>")
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
