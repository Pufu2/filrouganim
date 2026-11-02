#!/usr/bin/env python3
"""Les sessions des CEMEA, sur leur catalogue national cemea-formation.com (robots.txt respecté : la recherche
/promo/search et les listes /action/…/next-promos sont permises ; /search ne l'est pas et n'est jamais lu).

- BAFA / BAFD : /promo/search?type=1 (formation générale BAFA), 3 (approfondissement), 4 (formation générale BAFD),
  5 (perfectionnement BAFD), 20 sessions par page, avec le prix total et ce qu'il comprend (repas, hébergement).
- Diplômes professionnels : /action/<n>/next-promos (CC direction d'ACM, CPJEPS, BPJEPS ASEC, DEJEPS, DESJEPS).
Faits seulement : dates, ville, thème, prix, lien vers la fiche de la session.
"""

import datetime as dt
import html
import re
import unicodedata

BASE = "https://cemea-formation.com"
TYPES_BAFX = {1: ("BAFA", "formation-generale"), 3: ("BAFA", "approfondissement"),
              4: ("BAFD", "formation-generale"), 5: ("BAFD", "perfectionnement")}
ACTIONS_PRO = {73: ("CC-ACM", None), 131: ("CPJEPS", "aavq"), 133: ("BPJEPS", "asec"),
               134: ("DEJEPS", "coordination-de-projets"), 136: ("DESJEPS", "direction")}
MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]


def sans_accents(t):
    return unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()


def periode(texte):
    """« du 30 novembre au 5 décembre 2026 », « du 19 au 27 décembre 2026 », « du 4 novembre 2026 au 29 octobre 2027 »."""
    t = sans_accents(" ".join(texte.split()))
    m = re.search(r"du (\d{1,2})(?:er)?(?: (\w+))?(?: (20\d\d))? au (\d{1,2})(?:er)? (\w+) (20\d\d)", t)
    if not m or m.group(5) not in MOIS or (m.group(2) and m.group(2) not in MOIS):
        return None, None
    fin = dt.date(int(m.group(6)), MOIS.index(m.group(5)) + 1, int(m.group(4)))
    mois_d = MOIS.index(m.group(2)) + 1 if m.group(2) else fin.month
    annee_d = int(m.group(3)) if m.group(3) else (fin.year if mois_d <= fin.month else fin.year - 1)
    return dt.date(annee_d, mois_d, int(m.group(1))), fin


def texte(fragment):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split())


def cartes_bafx(brut):
    """Les sessions d'une page de /promo/search."""
    sessions = []
    for bloc in brut.split('font-training uppercase text-[2rem] text-primary')[1:]:
        theme = texte(bloc.split("</span>", 1)[0].split(">", 1)[-1])
        spans = [texte(s) for s in re.findall(r'<span class="flex justify-center[^"]*">(.*?)</span>', bloc, re.S)]
        lien = re.search(r'href="(/promo/[^"#]+)"', bloc)
        prix = re.search(r'font-training uppercase text-2xl[^"]*">\s*([\d  ]+)\s*€', bloc)
        alts = " ".join(re.findall(r'alt="([^"]*)"', bloc.split("€", 1)[0])).lower()
        if len(spans) < 2 or not lien:
            continue
        # deux mises en page : formation générale (titre = ville, puis « (Doubs) ») ou approfondissement
        # (titre = thème, puis « RENNES (Ille et Vilaine) »)
        if spans[0].startswith("("):
            ville, dep_nom, theme = theme, spans[0].strip("() "), None
        else:
            lieu = re.match(r"(.+?)\s*\(([^)]+)\)$", spans[0])
            if not lieu:
                continue
            ville, dep_nom = lieu.group(1), lieu.group(2)
        debut, fin = periode(spans[1])
        if not debut:
            continue
        formule = "internat" if "heberg" in sans_accents(alts) else ("demi-pension" if "restauration" in alts else "externat")
        sessions.append({"theme": theme, "ville": ville, "departement_nom": dep_nom, "debut": debut, "fin": fin,
                         "prix": int(re.sub(r"\D", "", prix.group(1))) if prix else None, "formule": formule,
                         "url": BASE + html.unescape(lien.group(1)), "code": lien.group(1).rstrip("/").rsplit("/", 1)[-1]})
    return sessions


def cartes_pro(brut):
    """Les sessions d'une page de /action/<n>/next-promos."""
    sessions = []
    for bloc in brut.split('<span class="text-xs">')[1:]:
        debut, fin = periode(texte(bloc.split("</span>", 1)[0]))
        lieu = re.search(r"<span>([^<(]+?)\s*\(([^)]+)\)</span>", bloc)
        lien = re.search(r'href="(/promo/[^"#]+)"', bloc)
        if not debut or not lieu or not lien:
            continue
        sessions.append({"ville": texte(lieu.group(1)), "departement_nom": lieu.group(2), "debut": debut, "fin": fin,
                         "url": BASE + html.unescape(lien.group(1)), "code": lien.group(1).rstrip("/").rsplit("/", 1)[-1]})
    return sessions


def code_departement(nom, departements):
    """« Ille et Vilaine » → « 35 » (noms de donnees/territoire.yml, sans accents ni tirets)."""
    cle = re.sub(r"[^a-z]", "", sans_accents(nom))
    for d in departements:
        if re.sub(r"[^a-z]", "", sans_accents(d["nom"])) == cle:
            return d["code"]
    return None


def bafx(lire_brut, departements, ecrire_ville=str.title, pages_max=80):
    """Toutes les sessions BAFA / BAFD des CEMEA, au format de donnees/sessions.yml."""
    sessions = []
    for type_id, (diplome, type_) in TYPES_BAFX.items():
        for page in range(1, pages_max):
            brut = lire_brut(f"{BASE}/promo/search?type={type_id}&date=&radius=30&term=&display-full=0&international=0"
                             f"&only-remote=0&page={page}")
            cartes = cartes_bafx(brut)
            if not cartes:
                break
            for c in cartes:
                dep = code_departement(c["departement_nom"], departements)
                if not dep:
                    continue  # outre-mer ou étranger : pas encore sur le site
                theme = c["theme"] if c["theme"] and type_ != "formation-generale" and not re.match(r"(?i)(formation g|perfectionnement)", c["theme"]) else None
                sessions.append({"id": "cemea-" + c["code"], "organisme": "cemea", "diplome": diplome, "type": type_,
                                 "theme": theme, "debut": c["debut"], "fin": c["fin"], "ville": ecrire_ville(c["ville"]),
                                 "departement": dep, "formule": c["formule"], "prix": c["prix"], "prix_note": None,
                                 "aides": [], "complet": False, "url": c["url"]})
    return sessions


def pro(lire_brut, departements, ecrire_ville=str.title, pages_max=20):
    """Les sessions des diplômes professionnels d'animation des CEMEA, au format de donnees/sessions-pro.yml."""
    sessions = []
    for action, (diplome, sp) in ACTIONS_PRO.items():
        for page in range(1, pages_max):
            brut = lire_brut(f"{BASE}/action/{action}/next-promos?action={action}&date=&radius=30&page={page}")
            cartes = cartes_pro(brut)
            if not cartes:
                break
            for c in cartes:
                dep = code_departement(c["departement_nom"], departements)
                if not dep:
                    continue
                sessions.append({"id": "cemea-" + c["code"], "organisme": None, "organisme_nom": "CEMEA",
                                 "diplome": diplome, "specialite": sp, "type": "parcours", "theme": None,
                                 "debut": c["debut"], "fin": c["fin"], "ville": ecrire_ville(c["ville"]), "departement": dep,
                                 "formule": None, "prix": None, "prix_note": None, "aides": [], "complet": False,
                                 "url": c["url"], "source": "page-organisme"})
    return sessions
