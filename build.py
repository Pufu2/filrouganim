#!/usr/bin/env python3
"""Fabrique le site Fil Roug'Anim dans le dossier _site/.

Usage :
    python3 build.py              # version en ligne (adresses propres : /bafa/paris/)
    python3 build.py --apercu     # version d'aperçu (liens relatifs vers index.html)

Repris du générateur de Jeuphorie (Markdown + Jinja2 + YAML).
Les sessions passées disparaissent toutes seules à chaque fabrication.
"""

import argparse
import datetime as dt
import html
import json
import os
import posixpath
import re
import shutil
import sys
import urllib.error
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
FORMULES = {"internat": "Internat", "demi-pension": "Demi-pension", "externat": "Externat", "alternance": "En alternance"}


# ---------------------------------------------------------------- lecture

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
        self.organismes = {o["id"]: o for o in self.donnees["organismes"]["organismes"]}
        self.sessions = self.charger_sessions()
        self.stats = self.calculer_stats()
        self.faq = self.donnees.get("faq", {}).get("questions", [])
        self.offres = self.charger_offres()
        self.env = Environment(loader=FileSystemLoader(RACINE / "gabarits"),
                               autoescape=select_autoescape(["html", "xml"]),
                               trim_blocks=True, lstrip_blocks=True)
        self.env.filters.update(date_fr=date_fr, euros=euros, resume=resume,
                                majuscule=lambda t: t[:1].upper() + t[1:] if t else t,
                                mois_court=lambda d: MOIS_COURTS[en_date(d).month - 1],
                                markdown=convertir_markdown, paragraphes=paragraphes)
        self.env.globals.update(dates_fr=dates_fr, FORMULES=FORMULES, OUTILS=OUTILS, TYPES_STRUCTURE=TYPES_STRUCTURE,
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
        for s in self.donnees["sessions"]["sessions"]:
            s = dict(s)
            if s["id"] in ids:
                sys.exit(f"Identifiant de session en double : {s['id']}")
            ids.add(s["id"])
            if s["organisme"] not in self.organismes:
                sys.exit(f"Organisme inconnu dans la session {s['id']} : {s['organisme']}")
            if s["departement"] not in self.departements:
                sys.exit(f"Département inconnu dans la session {s['id']} : {s['departement']}")
            s["debut"], s["fin"] = en_date(s["debut"]), en_date(s.get("fin"))
            s["releve_le"], s["verifie_le"] = en_date(s.get("releve_le")), en_date(s.get("verifie_le"))
            if (s["fin"] or s["debut"]) < self.aujourdhui:
                continue  # session passée : elle disparaît du site
            s["org"] = self.organismes[s["organisme"]]
            s["dep"] = self.departements[s["departement"]]
            s["periode"] = self.periode_de(s["debut"], s["dep"])
            s["type_nom"] = {"formation-generale": "Formation générale", "approfondissement": "Approfondissement",
                             "qualification": "Qualification", "perfectionnement": "Perfectionnement",
                             "parcours": "Formation complète", "session": "Session"}[s["type"]]
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
        lignes = self.lire_supabase(f"offres?select={champs}&order=debut", "offres des comptes")
        if lignes == [] and self.config.get("supabase"):
            # base pas encore en version 3 : lecture avec les colonnes de la version 1
            ancien = champs.split(",nb_postes")[0] + ",structures(nom,type,site)"
            lignes = self.lire_supabase(f"offres?select={ancien}&order=debut", "offres des comptes (version 1)")
        offres = []
        for l in lignes:
            st = l.get("structures") or {}
            offres.append({
                "id": str(l["id"]), "intitule": l["intitule"], "poste": l["poste"], "contrat": l["contrat"],
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

    def structures_en_ligne(self):
        """Pages publiques des structures vérifiées (les règles d'accès ne montrent que celles-là)."""
        champs = "nom,type,ville,departement,site,presentation,fondatrice,slug,accroche,couleur,publics,activites,lieux,projet,avantages"
        lignes = self.lire_supabase(f"structures?select={champs}&page_publique=is.true&slug=not.is.null&order=nom",
                                    "pages des structures")
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
                "nb_organismes": len({s["organisme"] for s in self.sessions}),
                "nb_deps": len({s["departement"] for s in self.sessions}),
                "verifie_le": max(verif) if verif else None}

    def schema_faq(self, questions):
        return json_ld({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q["q"], "acceptedAnswer": {"@type": "Answer", "text": q["r_rendu"]}}
            for q in questions]})

    def schema_sessions(self, sessions):
        """Données structurées schema.org (Course + CourseInstance) pour une liste de sessions."""
        objets = []
        for s in sessions:
            nom = f"{s['dipl']['nom']} – {s['type_nom']}" + (f" : {s['theme']}" if s["theme"] else "")
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
                                   "category": "Paid", "url": s["url"]}
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
                             sessions=liste, periode=p, lien_tout=f"/se-former/sessions/?diplome=BAFA&quand=p:{p['id']}",
                             fil=[SF, RUB, (p["court"], f"/se-former/sessions/{p['slug']}/")])
        for r in self.regions.values():
            de_la_region = [s for s in bafa if s["dep"]["reg"] is r]
            r["nb"] = len(de_la_region)
            self.ajouter(f"/se-former/sessions/{r['slug']}/", "liste.html",
                         titre=f"BAFA {r['nom']} : sessions, dates et prix",
                         h1=f"Passer le BAFA {r['a']}",
                         description=f"Les sessions BAFA {r['a']} : formation générale, approfondissement, dates, ville, formule et prix, département par département.",
                         intro=f"Les sessions dont le lieu est {r['a']}. Choisissez votre département plus bas, ou cherchez avec les filtres.",
                         region=r, sessions=de_la_region, indexer=bool(de_la_region),
                         lien_tout=f"/se-former/sessions/?diplome=BAFA&dep=r:{r['id']}",
                         fil=[SF, RUB, (r["nom"], f"/se-former/sessions/{r['slug']}/")])
        for dep in self.departements.values():
            du_dep = [s for s in bafa if s["dep"] is dep]
            dep["nb"] = len(du_dep)
            RG = (dep["reg"]["nom"], f"/se-former/sessions/{dep['reg']['slug']}/")
            villes = self.villes(du_dep) if dep["code"] != "75" else []
            per_dep = [p for p in self.periodes if any(s["periode"] is p for s in du_dep)]
            self.ajouter(f"/se-former/sessions/{dep['slug']}/", "liste.html",
                         titre=f"BAFA {dep['nom']} ({dep['code']}) : sessions, dates et prix",
                         h1=f"Passer le BAFA {dep['a']}",
                         description=f"Les sessions BAFA {dep['a']} ({dep['code']}) : formation générale, approfondissement, dates, formule et prix par organisme.",
                         intro=f"Les sessions dont le lieu est {dep['a']}. Une session peut se suivre dans n'importe quel département : regardez aussi les départements voisins.",
                         departement=dep, sessions=du_dep, indexer=bool(du_dep), periodes_dep=per_dep, villes=villes,
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
                             fil=[SF, RUB, RG, (dep["nom"], f"/se-former/sessions/{dep['slug']}/"), (p["court"], f"/se-former/sessions/{dep['slug']}/{p['slug']}/")])
            for v in villes:
                self.ajouter(f"/se-former/sessions/{dep['slug']}/{v['slug']}/", "liste.html",
                             titre=f"BAFA {v['nom']} ({dep['code']}) : sessions, dates et prix",
                             h1=f"Passer le BAFA à {v['nom']}",
                             description=f"Les sessions BAFA à {v['nom']} ({dep['code']}) : formation générale, approfondissement, dates, formule et prix, avec le lien vers l'organisme.",
                             intro=f"Les sessions qui ont lieu à {v['nom']}. D'autres sessions ont lieu tout près, {dep['a']}.",
                             departement=dep, ville=v, sessions=v["sessions"], periodes_dep=per_dep, villes=villes,
                             fil=[SF, RUB, RG, (dep["nom"], f"/se-former/sessions/{dep['slug']}/"), (v["nom"], f"/se-former/sessions/{dep['slug']}/{v['slug']}/")])
        for t in self.types:
            liste = [s for s in bafa if s["type"] == t["id"]]
            self.ajouter(f"/se-former/sessions/{t['slug']}/", "liste.html",
                         titre=f"BAFA {t['nom'].lower()} : sessions et prix partout en France",
                         h1=f"BAFA : {t['nom'].lower()}",
                         description=f"Les sessions de {t['nom'].lower()} du BAFA partout en France : dates, villes, formules et prix, avec le lien vers chaque organisme.",
                         type_session=t, sessions=liste, indexer=bool(liste), lien_tout=f"/se-former/sessions/?type=BAFA-{t['id']}",
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
                         fil=[SF, RUB, (d["nom"], f"/se-former/sessions/{d['slug']}/")])
        bafd = [s for s in S if s["diplome"] == "BAFD"]
        self.ajouter("/se-former/sessions/bafd/", "liste.html", titre="BAFD : sessions, dates et prix partout en France",
                     h1="Les sessions BAFD",
                     description="Les sessions de formation BAFD (directeur d'accueil collectif de mineurs) partout en France : formation générale et perfectionnement, dates, lieu, formule et prix.",
                     intro="Formation générale et perfectionnement du BAFD, dès 18 ans avec le BAFA.",
                     sessions=bafd, diplome="BAFD", indexer=bool(bafd), lien_tout="/se-former/sessions/?diplome=BAFD",
                     fil=[SF, RUB, ("BAFD", "/se-former/sessions/bafd/")])
        en_ligne = [o for o in self.organismes.values() if o.get("en_ligne")]
        self.ajouter("/se-former/sessions/organismes/", "organismes.html", titre="Organismes de formation BAFA, BAFD et PSC1",
                     description="Les organismes de formation au BAFA, au BAFD, au PSC1 et aux diplômes professionnels de l'animation présents sur le site, avec leurs prochaines sessions et le lien vers leur site.",
                     organismes=list(self.organismes.values()), fil=[SF, RUB, ("Organismes", "/se-former/sessions/organismes/")])
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
        PARTIES = {"se-former": SF, "trouver-un-poste": ("Trouver un poste", "/trouver-un-poste/")}
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
        for o in self.offres:
            self.ajouter(f"/trouver-un-poste/offres/{o['id']}/", "offre.html", titre=f"{o['intitule']} à {o['ville']}",
                         description=f"{o['intitule']} : {o['structure']['nom']}, {o['ville']} ({o['departement']}), à partir du {date_fr(o['debut'])}. Candidature directe auprès de la structure, gratuite.",
                         offre=o, schema=self.schema_offre(o),
                         fil=[("Trouver un poste", "/trouver-un-poste/"), (o["intitule"], f"/trouver-un-poste/offres/{o['id']}/")])
        self.ajouter("/trouver-un-poste/offres/", "offres.html", titre="Offres de stages pratiques BAFA et de jobs d'animation",
                     description="Les offres de stages pratiques BAFA, de jobs d'été et de postes d'animation publiées par les structures vérifiées, avec des filtres par département, contrat, poste et date.",
                     h1="Les offres d'animation", indexer=bool(self.offres),
                     mois=sorted({o["debut"].strftime("%Y-%m") for o in self.offres}),
                     fil=[("Trouver un poste", "/trouver-un-poste/"), ("Les offres", "/trouver-un-poste/offres/")])
        # pages publiques des structures vérifiées, et les exemples fictifs
        TP = ("Trouver un poste", "/trouver-un-poste/")
        STR = ("Les structures", "/trouver-un-poste/structures/")
        structures = self.structures_en_ligne()
        for st in structures:
            st["offres"] = [o for o in self.offres if o["structure"].get("slug") == st["slug"]]
            url = f"/trouver-un-poste/structures/{st['slug']}/"
            self.ajouter(url, "structure.html", titre=f"{st['nom']} : {TYPES_STRUCTURE.get(st['type'], 'structure')} à {st['ville']}",
                         description=(st.get("accroche") or f"{st['nom']}, {TYPES_STRUCTURE.get(st['type'], 'structure d animation').lower()} à {st['ville']}") + " Ses offres de stages et de jobs d'animation.",
                         structure=st, fil=[TP, STR, (st["nom"], url)])
        self.ajouter("/trouver-un-poste/structures/", "structures.html", titre="Les structures d'animation qui recrutent",
                     description="Les centres de loisirs, organisateurs de séjours et associations d'animation inscrits et vérifiés : leur projet, leurs publics et leurs offres.",
                     h1="Les structures qui recrutent", structures=structures, indexer=bool(structures), fil=[TP, STR])
        ex = self.donnees.get("exemples", {})
        if ex.get("structure"):
            st = dict(ex["structure"], exemple=True)
            st["offres"] = [dict(o, debut=en_date(o["debut"])) for o in st.pop("offres", [])]
            self.ajouter("/recruter/exemple-de-page-structure/", "structure.html", titre="Exemple de page structure",
                         description="À quoi ressemble la page d'une structure sur Fil Roug'Anim : un exemple fictif.",
                         indexer=False, structure=st, fil=[("Recruter", "/recruter/"), ("Exemple de page structure", "/recruter/exemple-de-page-structure/")])
        if ex.get("profil"):
            pr = dict(ex["profil"], dispo_debut=en_date(ex["profil"].get("dispo_debut")), dispo_fin=en_date(ex["profil"].get("dispo_fin")),
                      maj_le=en_date(ex["profil"].get("maj_le")))
            self.ajouter("/trouver-un-poste/exemple-de-profil/", "exemple-profil.html", titre="Exemple de profil de candidat",
                         description="À quoi ressemble un profil de candidat sur Fil Roug'Anim, et qui peut le voir : un exemple fictif.",
                         h1="Un exemple de profil", indexer=False, profil=pr,
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
        fixes = {"/se-former/": ["/formations/", "/guides/", "/bafa/"],
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

    def villes(self, sessions, minimum=2):
        """Les communes qui ont assez de sessions pour mériter leur page."""
        par_ville = {}
        for s in sessions:
            par_ville.setdefault(s["ville"], []).append(s)
        return [{"nom": v, "slug": slug(v), "sessions": l} for v, l in sorted(par_ville.items()) if len(l) >= minimum]

    def ajouter(self, url, gabarit, titre, description=None, indexer=True, **extra):
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
            "stats": self.stats, "offres": self.offres, "diplomes": list(self.diplomes.values()),
            "mois_sessions": sorted({s["mois"] for s in self.sessions}),
            "periodes": self.periodes, "types": self.types, "regions": list(self.regions.values()),
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
        if not self.apercu:
            self.ecrire_fichiers_seo()
            if self.config.get("nom_de_domaine"):
                (SORTIE / "CNAME").write_text(self.config["nom_de_domaine"] + "\n", encoding="utf-8")
        (SORTIE / ".nojekyll").write_text("", encoding="utf-8")
        print(f"{len(self.pages)} pages fabriquées dans {SORTIE}, {len(self.sessions)} sessions à venir"
              + (" (aperçu)" if self.apercu else ""))

    def ecrire_donnees_recherche(self):
        """Toutes les sessions, en données compactes, pour la recherche avec filtres (lue par statique/js/filtres.js)."""
        donnees = []
        for s in self.sessions:
            verif = (f"Vérifié le {date_fr(s['verifie_le'])}" if s["verifie_le"] else f"Relevé le {date_fr(s['releve_le'])}")
            notes = ([s["prix_note"][0].upper() + s["prix_note"][1:]] if s.get("prix_note") else []) + \
                    ([", ".join(s["aides"])[0].upper() + ", ".join(s["aides"])[1:]] if s.get("aides") else [])
            donnees.append({
                "di": s["diplome"], "dn": s["dipl"]["nom"], "dl": s["dipl"]["long"], "t": s["type"], "tn": s["type_nom"],
                "th": s["theme"], "j": s["debut"].day, "m": s["debut"].strftime("%Y-%m"),
                "dates": dates_fr(s["debut"], s["fin"])[0].upper() + dates_fr(s["debut"], s["fin"])[1:],
                "v": s["ville"], "d": s["departement"], "dn2": s["dep"]["nom"], "r": s["dep"]["region"],
                "p": s["periode"]["id"] if s["periode"] else "autre",
                "f": FORMULES[s["formule"]].lower() if s.get("formule") else None,
                "o": s["org"]["nom"], "oi": s["org"]["id"] if s["org"].get("en_ligne") else None,
                "px": s["prix"], "c": bool(s["complet"]), "n": notes, "vf": verif, "u": s["url"]})
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
    args = parser.parse_args()
    Site(apercu=args.apercu, aujourdhui=en_date(args.date) if args.date else None).construire()


if __name__ == "__main__":
    sys.exit(main())
