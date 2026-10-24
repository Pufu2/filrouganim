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
import posixpath
import re
import shutil
import sys
from pathlib import Path

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

RACINE = Path(__file__).resolve().parent
SORTIE = RACINE / "_site"

MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
        "août", "septembre", "octobre", "novembre", "décembre"]
FORMULES = {"internat": "Internat", "demi-pension": "Demi-pension", "externat": "Externat"}


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


def json_ld(objet):
    """JSON-LD sûr à placer dans une balise <script>."""
    return json.dumps(objet, ensure_ascii=False, indent=1).replace("</", "<\\/")


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
        self.departements = {d["code"]: d for d in t["departements"]}
        self.periodes = [{**p, "debut": en_date(p["debut"]), "fin": en_date(p["fin"])} for p in t["periodes"]]
        self.types = t["types"]
        self.organismes = {o["id"]: o for o in self.donnees["organismes"]["organismes"]}
        self.sessions = self.charger_sessions()
        self.env = Environment(loader=FileSystemLoader(RACINE / "gabarits"),
                               autoescape=select_autoescape(["html", "xml"]),
                               trim_blocks=True, lstrip_blocks=True)
        self.env.filters.update(date_fr=date_fr, euros=euros, resume=resume)
        self.env.globals.update(dates_fr=dates_fr, FORMULES=FORMULES)
        self.pages = []

    # -- sessions
    def periode_de(self, jour):
        return next((p for p in self.periodes if p["debut"] <= jour <= p["fin"]), None)

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
            s["periode"] = self.periode_de(s["debut"])
            s["type_nom"] = {"formation-generale": "Formation générale", "approfondissement": "Approfondissement",
                             "qualification": "Qualification", "perfectionnement": "Perfectionnement"}[s["type"]]
            sessions.append(s)
        # Classement (expliqué sur /classement-des-sessions/) : date de début, puis prix, puis organisme
        sessions.sort(key=lambda s: (s["debut"], s["prix"] is None, s["prix"] or 0, s["org"]["nom"], s["ville"]))
        return sessions

    def schema_sessions(self, sessions):
        """Données structurées schema.org (Course + CourseInstance) pour une liste de sessions."""
        objets = []
        for s in sessions:
            nom = f"{s['diplome']} – {s['type_nom']}" + (f" : {s['theme']}" if s["theme"] else "")
            instance = {"@type": "CourseInstance", "courseMode": "Onsite",
                        "startDate": s["debut"].isoformat(),
                        "location": {"@type": "Place", "name": s["ville"],
                                     "address": {"@type": "PostalAddress", "addressLocality": s["ville"],
                                                 "addressRegion": "Île-de-France", "addressCountry": "FR"}}}
            if s["fin"]:
                instance["endDate"] = s["fin"].isoformat()
            objet = {"@context": "https://schema.org", "@type": "Course", "name": nom,
                     "description": f"Session de {s['diplome']} ({s['type_nom'].lower()}) organisée par {s['org']['nom']} à {s['ville']}, {dates_fr(s['debut'], s['fin'])}.",
                     "provider": {"@type": "Organization", "name": s["org"]["nom"], "sameAs": s["org"]["site"]},
                     "hasCourseInstance": instance}
            if s["prix"] is not None:
                objet["offers"] = {"@type": "Offer", "price": s["prix"], "priceCurrency": "EUR",
                                   "category": "Paid", "url": s["url"]}
            objets.append(objet)
        return json_ld(objets) if objets else ""

    # -- déclaration des pages
    def declarer(self):
        S = self.sessions
        bafa = [s for s in S if s["diplome"] == "BAFA"]
        self.ajouter("/", "accueil.html",
                     titre="BAFA en Île-de-France : toutes les sessions, dates et prix",
                     description="Comparez les sessions BAFA et BAFD en Île-de-France : dates, ville, formule et prix, organisme par organisme. Gratuit, sans inscription.",
                     sessions=S, schema=self.schema_sessions(S))

        # une page par période de vacances, toute l'Île-de-France
        for p in self.periodes:
            liste = [s for s in bafa if s["periode"] is p]
            if liste:
                self.ajouter(f"/bafa/{p['slug']}/", "liste.html",
                             titre=f"BAFA {p['nom']} en Île-de-France : dates et prix",
                             h1=f"BAFA pendant les {p['nom']} en Île-de-France",
                             description=f"Les sessions BAFA des {p['nom']} en Île-de-France ({dates_fr(p['debut'], p['fin'])}) : formation générale et approfondissement, ville, formule et prix.",
                             intro=f"Les {p['nom']} vont {dates_fr(p['debut'], p['fin'])} pour la zone C (Paris, Créteil, Versailles). Voici les sessions qui commencent pendant ces vacances.",
                             sessions=liste, periode=p, fil=[("BAFA", "/bafa/"), (p["court"], f"/bafa/{p['slug']}/")])

        # une page par département, et par département et période
        for dep in self.departements.values():
            du_dep = [s for s in bafa if s["dep"] is dep]
            self.ajouter(f"/bafa/{dep['slug']}/", "liste.html",
                         titre=f"BAFA {dep['nom']} ({dep['code']}) : sessions, dates et prix",
                         h1=f"Passer le BAFA {dep['a']} ({dep['code']})",
                         description=f"Toutes les sessions BAFA {dep['a']} ({dep['code']}) : formation générale, approfondissement, dates, formule et prix par organisme.",
                         intro=None, departement=dep, sessions=du_dep, indexer=bool(du_dep),
                         periodes_dep=[p for p in self.periodes if any(s["periode"] is p for s in du_dep)],
                         fil=[("BAFA", "/bafa/"), (dep["nom"], f"/bafa/{dep['slug']}/")])
            for p in self.periodes:
                liste = [s for s in du_dep if s["periode"] is p]
                if liste:
                    self.ajouter(f"/bafa/{dep['slug']}/{p['slug']}/", "liste.html",
                                 titre=f"BAFA {dep['nom']} {p['nom']} : dates et prix",
                                 h1=f"BAFA {dep['a']} pendant les {p['nom']}",
                                 description=f"Sessions BAFA {dep['a']} ({dep['code']}) pendant les {p['nom']} : dates, ville, formule, prix et lien vers l'organisme.",
                                 intro=f"Les {p['nom']} vont {dates_fr(p['debut'], p['fin'])} en Île-de-France (zone C).",
                                 departement=dep, periode=p, sessions=liste,
                                 periodes_dep=[q for q in self.periodes if any(s["periode"] is q for s in du_dep)],
                                 fil=[("BAFA", "/bafa/"), (dep["nom"], f"/bafa/{dep['slug']}/"),
                                      (p["court"], f"/bafa/{dep['slug']}/{p['slug']}/")])

        # une page par type de session
        for t in self.types:
            liste = [s for s in bafa if s["type"] == t["id"]]
            self.ajouter(f"/bafa/{t['slug']}/", "liste.html",
                         titre=f"BAFA {t['nom'].lower()} en Île-de-France : sessions et prix",
                         h1=f"BAFA : {t['nom'].lower()} en Île-de-France",
                         description=f"Les sessions de {t['nom'].lower()} du BAFA en Île-de-France : dates, villes, formules et prix, avec le lien vers chaque organisme.",
                         type_session=t, sessions=liste, indexer=bool(liste),
                         fil=[("BAFA", "/bafa/"), (t["nom"], f"/bafa/{t['slug']}/")])
        self.ajouter("/bafa/", "bafa.html", titre="Sessions BAFA en Île-de-France par département et par vacances",
                     description="Trouvez une session BAFA en Île-de-France par département, par période de vacances ou par étape : formation générale, approfondissement, qualification.",
                     fil=[("BAFA", "/bafa/")])
        bafd = [s for s in S if s["diplome"] == "BAFD"]
        self.ajouter("/bafd/", "liste.html", titre="BAFD en Île-de-France : sessions, dates et prix",
                     h1="Passer le BAFD en Île-de-France",
                     description="Les sessions de formation BAFD (directeur d'accueil collectif de mineurs) en Île-de-France : dates, lieu, formule et prix.",
                     sessions=bafd, diplome="BAFD", indexer=bool(bafd), fil=[("BAFD", "/bafd/")])

        # organismes
        en_ligne = [o for o in self.organismes.values() if o.get("en_ligne")]
        self.ajouter("/organismes/", "organismes.html", titre="Organismes de formation BAFA et BAFD en Île-de-France",
                     description="Les organismes qui forment au BAFA et au BAFD en Île-de-France, avec leurs prochaines sessions et le lien vers leur site.",
                     organismes=list(self.organismes.values()), fil=[("Organismes", "/organismes/")])
        for o in en_ligne:
            liste = [s for s in S if s["organisme"] == o["id"]]
            self.ajouter(f"/organismes/{o['id']}/", "liste.html",
                         titre=f"BAFA avec {o['nom']} en Île-de-France : sessions et prix",
                         h1=f"{o['nom']} : sessions BAFA et BAFD en Île-de-France",
                         description=f"Les prochaines sessions BAFA et BAFD de {o['nom']} en Île-de-France : dates, villes, formules et prix, avec le lien vers sa page.",
                         organisme=o, sessions=liste,
                         fil=[("Organismes", "/organismes/"), (o["nom"], f"/organismes/{o['id']}/")])

        # guides et pages fixes (Markdown)
        guides = []
        for f in sorted((RACINE / "contenu" / "guides").glob("*.md")):
            entete, corps = lire_markdown(f)
            url = f"/guides/{f.stem}/"
            guides.append({**entete, "url": url})
            self.ajouter(url, "guide.html", titre=entete["titre"], description=entete["description"],
                         corps_md=corps, entete=entete, fil=[("Guides", "/guides/"), (entete["court"], url)])
        guides.sort(key=lambda g: g.get("ordre", 99))
        self.config["guides"] = guides
        self.ajouter("/guides/", "guides.html", titre="Guides du BAFA : étapes, financement, stage pratique",
                     description="Des guides clairs et vérifiés pour passer le BAFA : les étapes, les aides pour le financer, trouver son stage pratique.",
                     fil=[("Guides", "/guides/")])
        for f in sorted((RACINE / "contenu" / "pages").glob("*.md")):
            entete, corps = lire_markdown(f)
            self.ajouter(entete["url"], "page.html", titre=entete["titre"], description=entete.get("description", ""),
                         indexer=entete.get("indexer", True), corps_md=corps, entete=entete)
        self.ajouter("/404.html", "404.html", titre="Page introuvable", indexer=False)

    def ajouter(self, url, gabarit, titre, description=None, indexer=True, **extra):
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
            "periodes": self.periodes, "types": self.types,
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
        if not self.apercu:
            self.ecrire_fichiers_seo()
            if self.config.get("nom_de_domaine"):
                (SORTIE / "CNAME").write_text(self.config["nom_de_domaine"] + "\n", encoding="utf-8")
        (SORTIE / ".nojekyll").write_text("", encoding="utf-8")
        print(f"{len(self.pages)} pages fabriquées dans {SORTIE}, {len(self.sessions)} sessions à venir"
              + (" (aperçu)" if self.apercu else ""))

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
