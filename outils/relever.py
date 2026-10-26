#!/usr/bin/env python3
"""Relève et revérifie les sessions sur les pages des organismes, puis réécrit donnees/sessions.yml.

Usage :
    python3 outils/relever.py              # relevé du jour, écrit donnees/sessions.yml
    python3 outils/relever.py --essai      # n'écrit rien, affiche seulement le résumé

Ce que fait l'outil (voir docs/METTRE-A-JOUR-LES-SESSIONS.md) :
- lit robots.txt de chaque organisme et s'arrête si une page de sessions est interdite ;
- AFOCAL : parcourt la liste Île-de-France (formations générales, approfondissements), puis lit
  chaque fiche (dates, lieu, thème, tarif, places) ; IFAC : lit la liste Île-de-France, puis la
  fiche des sessions retenues (tarif) ;
- garde les sessions des vacances à venir (donnees/territoire.yml) et les sessions BAFD,
  qui commencent dans 3 jours ou plus ;
- sélection : par organisme, une session par département, par vacances et par étape (la première
  non complète, par date puis par prix), pour ne pas reprendre l'essentiel de leur base ;
- n'enregistre que des faits, jamais leurs textes ; aucune donnée personnelle ;
- conserve la date du premier relevé (releve_le) et met verifie_le à la date du jour.
"""

import argparse
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.robotparser
from pathlib import Path
from urllib.request import Request, urlopen

import yaml

RACINE = Path(__file__).resolve().parent.parent
AGENT = "Mozilla/5.0 (compatible; FilRougAnim-verif; +https://filrouganim.fr)"
PAUSE = 0.6  # secondes entre deux pages, pour ne pas charger les sites
TERRITOIRE = yaml.safe_load((RACINE / "donnees" / "territoire.yml").read_text(encoding="utf-8"))
DEPS = {d["code"] for d in TERRITOIRE["departements"]}  # France métropolitaine et Corse
HORIZON = 300  # jours : au-delà, une session est trop lointaine pour être relevée
PETITS = {"sur", "sous", "le", "la", "les", "de", "du", "des", "en", "aux", "au", "et", "lès"}
ACCENTS = {"Velizy-Villacoublay": "Vélizy-Villacoublay", "L'haÿ-les-Roses": "L'Haÿ-les-Roses",
           "Evry-Courcouronnes": "Évry-Courcouronnes", "Vaux-le-Penil": "Vaux-le-Pénil"}
FORMULES = {"externat": "externat", "demi-pension": "demi-pension", "½ pension": "demi-pension",
            "1/2 pension": "demi-pension", "pension complète": "internat", "pension": "internat", "internat": "internat"}

_robots = {}


def autorise(url):
    hote = re.match(r"https?://[^/]+", url).group(0)
    if hote not in _robots:
        # lu avec notre identité : certains sites refusent le lecteur par défaut de Python
        rp = urllib.robotparser.RobotFileParser(hote + "/robots.txt")
        with urlopen(Request(hote + "/robots.txt", headers={"User-Agent": AGENT}), timeout=30) as r:
            rp.parse(r.read().decode("utf-8", errors="ignore").splitlines())
        _robots[hote] = rp
    # un site qui ferme sa porte aux robots d'IA (dont ceux d'Anthropic) n'est jamais lu
    return all(_robots[hote].can_fetch(a, url) for a in (AGENT, "ClaudeBot", "Claude-User", "anthropic-ai"))


def lire_brut(url):
    if not autorise(url):
        sys.exit(f"robots.txt interdit cette page : {url}")
    time.sleep(PAUSE)
    with urlopen(Request(url, headers={"User-Agent": AGENT}), timeout=30) as r:
        return r.read().decode("utf-8", errors="ignore")


def lire(url):
    """Texte de la page en lignes (balises retirées)."""
    brut = lire_brut(url)
    brut = re.sub(r"<script.*?</script>|<style.*?</style>", "", brut, flags=re.S)
    return brut, [" ".join(l.split()) for l in html.unescape(re.sub(r"<[^>]+>", "\n", brut)).split("\n") if l.strip()]


def commune(nom):
    nom = nom.strip()
    if nom.upper() == "PARIS":
        return "Paris"
    mots = nom.lower().replace("-", " ").split()
    sortie = [m if (m in PETITS and k) else m.capitalize() for k, m in enumerate(mots)]
    if sortie and sortie[0] in ("Le", "La", "Les") and len(sortie) > 1:
        r = sortie[0] + " " + "-".join(sortie[1:])
    else:
        r = "-".join(sortie)
    return ACCENTS.get(r, r)


def formule_prix(tarifs):
    """{'externat': 435.0, …} -> ('externat', 435, note sur les autres formules)."""
    if not tarifs:
        return None, None, None
    items = sorted(tarifs.items(), key=lambda x: x[1])
    note = "Aussi : " + ", ".join(f"{f} {v:.0f} €" for f, v in items[1:]) if len(items) > 1 else None
    p = items[0][1]
    return items[0][0], int(p) if float(p).is_integer() else p, note


# ---------------------------------------------------------------- AFOCAL

REGIONS_AFOCAL = ["auvergne-rhone-alpes", "bourgogne-franche-comte", "bretagne", "centre-val-de-loire", "corse", "grand-est",
                  "hauts-de-france", "ile-de-france", "normandie", "nouvelle-aquitaine", "occitanie", "pays-de-la-loire", "paca"]


FORMULES_AFOCAL = {"int": "internat", "ext": "externat", "dp": "demi-pension", "dpe": "demi-pension"}
TYPES_AFOCAL = {"Formation générale": "formation-generale", "Approfondissement": "approfondissement",
                "Qualification": "qualification", "Perfectionnement": "perfectionnement"}


def afocal():
    """Les listes de chaque région suffisent : dates, lieu, thème, tarifs par formule et « complet » y sont écrits."""
    sessions, vus = [], set()
    for region in REGIONS_AFOCAL:
        for typ in (1, 2):  # 1 : formations générales, 2 : approfondissements
            precedent = None
            for n in range(1, 80):
                brut = lire_brut(f"https://www.afocal.fr/bafa/recherche-bafa-{region}-{typ}-{n}.html")
                blocs = brut.split('<div class="sessions')[1:]
                page = frozenset(re.findall(r"stage-bafa-[0-9a-z]+\.html", brut))
                if page == precedent or not page:
                    break
                precedent = page
                for b in blocs:
                    lien = re.search(r"href='(stage-bafa-([0-9a-z]+)\.html)' title=\"([^\"]+)\"", b)
                    dl = re.search(r'class="datelieu[^"]*">du (\d\d)/(\d\d)/(\d\d) au (\d\d)/(\d\d)/(\d\d).*?à ([^<(]+?) \((\w\w)\)', b, re.S)
                    if not lien or not dl or lien.group(2) in vus:
                        continue
                    vus.add(lien.group(2))
                    titre = html.unescape(lien.group(3))
                    t = re.match(r"(Formation générale|Approfondissement|Qualification|Perfectionnement) (BAFA|BAFD)", titre)
                    if not t:
                        continue
                    theme = html.unescape(re.search(r'<span class="theme">([^<]*)', b).group(1)).strip() if '<span class="theme">' in b else ""
                    theme = theme.replace(" + ", " et ").strip() or None
                    if theme and theme.startswith("à préciser"):
                        theme = None
                    tarifs = {}
                    for f, m in re.findall(r'<div class="(\w+)"><span class="montant">\s*([\d ]+(?:,\d+)?)\s*&euro;', b):
                        if f in FORMULES_AFOCAL:
                            tarifs[FORMULES_AFOCAL[f]] = float(m.replace(" ", "").replace(",", "."))
                    formule, prix, note = formule_prix(tarifs)
                    complet = bool(re.search(r'<span class="complet">\s*COMPLET', b))
                    g = dl.groups()
                    sessions.append({
                        "id": "afocal-" + lien.group(2), "organisme": "afocal", "diplome": t.group(2), "type": TYPES_AFOCAL[t.group(1)],
                        "theme": theme, "debut": dt.date(2000 + int(g[2]), int(g[1]), int(g[0])),
                        "fin": dt.date(2000 + int(g[5]), int(g[4]), int(g[3])),
                        "ville": commune(html.unescape(g[6])), "departement": g[7].upper(), "formule": formule, "prix": prix,
                        "prix_note": note, "aides": [], "complet": complet,
                        "url": "https://www.afocal.fr/bafa/" + lien.group(1)})
    return sessions


# ---------------------------------------------------------------- IFAC

TYPES_IFAC = {"Formation Générale BAFA": ("BAFA", "formation-generale"), "Approfondissement BAFA": ("BAFA", "approfondissement"),
              "Qualification surveillant de baignade": ("BAFA", "qualification"),
              "Qualification BAFA": ("BAFA", "qualification"), "Formation Générale BAFD": ("BAFD", "formation-generale"),
              "Perfectionnement BAFD": ("BAFD", "perfectionnement")}


IFAC_PRO_LIBELLES = {"CQP- Animation Périscolaire": ("CQP-AP", None),
                     "CPJEPS Animateur d’activités et de vie quotidienne": ("CPJEPS", "aavq"),
                     "BPJEPS Animation Socio-Educative ou Culturelle": ("BPJEPS", "asec"),
                     "DEJEPS Coordination de projets": ("DEJEPS", "coordination-de-projets"),
                     "DESJEPS Direction de structure": ("DESJEPS", "direction")}  # spécialités : donnees/specialites.yml


def ifac_liste():
    """La liste nationale de l'IFAC (une seule page, toutes régions) : BAFA, BAFD et formations professionnelles."""
    brut = lire_brut("https://ifac-formation.fr/formations/sessions/")
    sessions = []
    for carte in brut.split('class="custom-card"')[1:]:
        texte = lambda motif: (lambda m: " ".join(html.unescape(re.sub(r"<[^>]+>", " ", m.group(1))).split()) if m else None)(
            re.search(motif, carte, re.S))
        titre = texte(r'<p class="title">(.*?)(?:<span|</p>)')
        sous_titre = texte(r'<span class="subtitle">(.*?)</span>')
        date = texte(r'<p class="date">(.*?)</p>')
        lieu = texte(r'<p class="location">(.*?)</p>')
        lien = re.search(r'href="/formations/sessions/(\d+)"', carte)
        if not (titre and date and lieu and lien):
            continue
        debut, fin = dates_texte(date)
        m = re.search(r"(\d{5}) (.+)$", lieu)
        if not debut or not m:
            continue
        cp, ident = m.group(1), lien.group(1)
        dep = "2A" if cp.startswith("20") and int(cp) < 20200 else ("2B" if cp.startswith("20") else cp[:2])
        ville = (f"Paris {int(cp[3:])}{'er' if int(cp[3:]) == 1 else 'e'}" if cp.startswith("75") else commune(m.group(2)))
        complet = bool(re.search(r"<strong[^>]*>\s*Complet\s*</strong>", carte))
        base = {"debut": debut, "fin": fin, "ville": ville, "departement": dep, "formule": None, "prix": None,
                "prix_note": None, "aides": [], "complet": complet}
        if titre in TYPES_IFAC:
            diplome, type_ = TYPES_IFAC[titre]
            if type_ == "approfondissement" and sous_titre and re.search(r"qualification|baignade", sous_titre, re.I):
                type_ = "qualification"
            sessions.append(dict(base, id="ifac-" + ident, organisme="ifac", diplome=diplome, type=type_,
                                 theme=re.sub(r"^Qualification\s+", "", sous_titre) if sous_titre else None,
                                 url=f"https://ifac-formation.fr/formations/sessions/bafa-bafd/{ident}"))
        elif titre in IFAC_PRO_LIBELLES:
            sessions.append(dict(base, id="ifac-pro-" + ident, organisme="ifac", diplome=IFAC_PRO_LIBELLES[titre][0],
                                 specialite=IFAC_PRO_LIBELLES[titre][1],
                                 type="parcours", theme=None, formule="alternance", pro=True,
                                 url=f"https://ifac-formation.fr/formations/sessions/professionnelles/{ident}"))
    if len(sessions) < 100:
        sys.exit(f"IFAC : seulement {len(sessions)} sessions lues, la page a peut-être changé de forme : à regarder à la main")
    return sessions


def ifac_fiche(s):
    """Lit le tarif sur la fiche et revérifie les dates."""
    _, L = lire(s["url"])
    if f"Du {s['debut']:%d/%m/%Y} au {s['fin']:%d/%m/%Y}" not in L:
        print(f"  IFAC {s['id']} : dates différentes sur la fiche, session écartée", file=sys.stderr)
        return False
    tarifs = {}
    for k, l in enumerate(L[:-1]):
        m = re.match(r"Tarif (externat|demi-pension|internat|pension complète)$", l, re.I)
        v = re.match(r"([\d ]+(?:,\d+)?) €$", L[k + 1])
        if m and v:
            tarifs[FORMULES[m.group(1).lower()]] = float(v.group(1).replace(" ", "").replace(",", "."))
    s["formule"], s["prix"], s["prix_note"] = formule_prix(tarifs)
    return True


# ---------------------------------------------------------------- UFCV

def dates_texte(l):
    m = re.search(r"Du (\d\d)/(\d\d)/(\d{4}) au (\d\d)/(\d\d)/(\d{4})", l)
    if not m:
        return None, None
    return (dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1))),
            dt.date(int(m.group(6)), int(m.group(5)), int(m.group(4))))


REGIONS_UFCV = [28, 4, 5, 6, 8, 29, 30, 10, 31, 32, 33, 18, 21]  # identifiants des régions sur bafa.ufcv.fr


def ufcv():
    """Liste de chaque département (le département est donc connu sans ouvrir la fiche)."""
    base = "https://bafa.ufcv.fr/R%C3%A9sultats-de-recherche?idType=0"
    sessions = []
    for region in REGIONS_UFCV:
        brut = lire_brut(f"{base}&idRegion={region}&page=1")
        deps = re.findall(r'<option value="(\d+)">([0-9][0-9AB]) - ', brut)
        for id_dep, code in deps:
            vus = set()
            for n in range(1, 40):
                brut = lire_brut(f"{base}&idRegion={region}&idDepartement={id_dep}&page={n}")
                lignes = re.findall(r"<tr[^>]*>(.*?)</tr>", brut, re.S)
                nouveaux = 0
                for ligne in lignes:
                    lien = re.search(r"idPeriode=(\d+)", ligne)
                    if not lien or lien.group(1) in vus:
                        continue
                    vus.add(lien.group(1))
                    nouveaux += 1
                    L = [" ".join(x.split()) for x in html.unescape(re.sub(r"<[^>]+>", "\n", ligne)).split("\n") if x.strip()]
                    type_l = next((x for x in L if re.match(r"BAF[AD] \d - ", x)), None)
                    pleines = [k for k, x in enumerate(L) if re.match(r"Du \d\d/\d\d/\d{4} au \d\d/\d\d/\d{4}$", x)]
                    if not type_l or not pleines:
                        continue
                    debut, fin = dates_texte(L[pleines[-1]])
                    k = L.index(type_l)
                    theme = L[k + 1] if k + 1 < len(L) and not re.search(r"\d\d/\d\d", L[k + 1]) else None
                    ville = L[pleines[-1] + 1] if pleines[-1] + 1 < len(L) else ""
                    prix = next((re.search(r"([\d ]+) €", x) for x in L[pleines[-1] + 1:] if "€" in x), None)
                    diplome = type_l[:4]
                    if "Formation Générale" in type_l:
                        type_ = "formation-generale"
                    elif "Perfectionnement" in type_l:
                        type_ = "perfectionnement"
                    elif theme and re.search(r"baignade|qualification", theme, re.I):
                        type_ = "qualification"
                    else:
                        type_ = "approfondissement"
                    sessions.append({"id": "ufcv-" + lien.group(1), "organisme": "ufcv", "diplome": diplome, "type": type_,
                                     "theme": re.sub(r"^Qualification\s+", "", theme) if theme else None,
                                     "debut": debut, "fin": fin, "ville": commune(ville), "departement": code,
                                     "formule": None, "prix": int(prix.group(1).replace(" ", "")) if prix else None,
                                     "prix_note": "en plusieurs parties (une interruption est prévue)"
                                     if any("interruption" in x for x in L) else None, "aides": [], "complet": False,
                                     "url": "https://bafa.ufcv.fr/D%C3%A9tail-de-la-session?idPeriode=" + lien.group(1)})
                if not nouveaux:
                    break
    return sessions


def ufcv_fiche(s):
    """Tarifs par formule et places restantes, sur la fiche de la session."""
    try:
        _, L = lire(s["url"])
    except Exception as e:
        print(f"  UFCV {s['id']} : illisible ({e})", file=sys.stderr)
        return False
    if not any(dates_texte(l) == (s["debut"], s["fin"]) for l in L):
        print(f"  UFCV {s['id']} : dates différentes sur la fiche, session écartée", file=sys.stderr)
        return False
    tarifs = {}
    if "Montant" in L:
        k = L.index("Montant") + 1
        while k + 1 < len(L) and re.match(r"([\d ]+(?:,\d+)?) €$", L[k + 1]) and L[k].lower() in FORMULES:
            tarifs[FORMULES[L[k].lower()]] = float(re.match(r"([\d ]+(?:,\d+)?) €$", L[k + 1]).group(1).replace(" ", "").replace(",", "."))
            k += 2
    if tarifs:
        s["formule"], s["prix"], s["prix_note"] = formule_prix(tarifs)
    etat = next((l for l in L if l.startswith("En date du")), "")
    s["complet"] = bool(etat) and "places disponibles" not in etat
    return not s["complet"]


# ---------------------------------------------------------------- Ligue de l'enseignement Île-de-France

def ligue():
    """Boutique formation-bafa-bafd.org (liste publique des produits), puis la fiche pour les dates et la formule."""
    produits = []
    for n in range(1, 20):
        page = json.loads(lire_brut(f"https://formation-bafa-bafd.org/wp-json/wc/store/v1/products?per_page=100&page={n}"))
        if not page:
            break
        produits += page
    cats = {"bafa-formation-generale": ("BAFA", "formation-generale"),
            "bafa-approfondissement-qualification": ("BAFA", "approfondissement"),
            "bafd-formation-generale": ("BAFD", "formation-generale"), "bafd-perfectionnement": ("BAFD", "perfectionnement")}
    sessions = []
    for p in produits:
        cat = next((cats[c["slug"]] for c in p.get("categories", []) if c["slug"] in cats), None)
        nom = html.unescape(p["name"])
        lieu = re.search(r" à (.+?) \((\d{2})\)", nom)
        if not cat or not lieu:
            continue
        _, L = lire(p["permalink"])
        i = next((k for k, l in enumerate(L) if re.match(r"Du \d\d/\d\d/\d{4}$", l)), None)
        if i is None or not re.match(r"au \d\d/\d\d/\d{4}$", L[i + 1]):
            continue
        d = lambda t: dt.date(int(t[-4:]), int(t[-7:-5]), int(t[-10:-8]))
        debut, fin = d(L[i]), d(L[i + 1])
        if not dt.date.today() + dt.timedelta(days=3) <= debut <= dt.date.today() + dt.timedelta(days=HORIZON):
            continue
        formule = next((FORMULES[l.lower()] for l in L[i + 2:i + 8] if l.lower() in FORMULES), None)
        prix = int(p["prices"]["price"]) / 10 ** p["prices"].get("currency_minor_unit", 2)
        sessions.append({"id": "ligue-" + str(p["id"]), "organisme": "ligue-idf", "diplome": cat[0], "type": cat[1],
                         "theme": None, "debut": debut, "fin": fin,
                         "ville": commune(lieu.group(1).split(" • ")[-1]),
                         "departement": lieu.group(2), "formule": formule, "prix": int(prix) if prix.is_integer() else prix,
                         "prix_note": None, "aides": [], "complet": not p.get("is_in_stock", True), "url": p["permalink"]})
    return sessions


# ---------------------------------------------------------------- IFAC : fiche d'une formation professionnelle

def ifac_pro_fiche(s):
    """Tarif, durée et date limite du dossier, sur la fiche d'une formation professionnelle."""
    try:
        _, L = lire(s["url"])
    except Exception as e:
        print(f"  IFAC pro {s['id']} : illisible ({e})", file=sys.stderr)
        return False
    if "Informations pratiques" not in L:
        return False
    k = L.index("Informations pratiques")
    bloc = L[k + 1:k + 30]
    duree = next((re.search(r"(\d+) heures", l).group(1) for l in bloc if re.match(r"Durée : \d+ heures", l)), None)
    if "Parcours complet" in bloc:
        v = re.match(r"([\d ]+)\s*€", bloc[bloc.index("Parcours complet") + 1])
        s["prix"] = int(v.group(1).replace(" ", "")) if v else None
    limite = next((l for l in L if l.startswith("Merci de compléter et nous adresser votre dossier")), "")
    m_lim = re.search(r"avant le : (\d{1,2}) (\w+) (\d{4})", limite)
    notes = []
    if duree:
        notes.append(f"{duree} heures de formation")
    if m_lim:
        notes.append(f"dossier avant le {m_lim.group(1)} {m_lim.group(2)} {m_lim.group(3)}")
    if any("apprentissage" in l.lower() for l in L):
        notes.append("possible en apprentissage (sans frais pour l'apprenti)")
    s["prix_note"] = " ; ".join(notes) or None
    return True


# ---------------------------------------------------------------- Protection civile : PSC1

def protection_civile():
    """Les sessions PSC1 de la Protection civile : la liste nationale est écrite dans la page de la formation."""
    url = "https://formations.protection-civile.org/formation-psc/"
    brut = lire_brut(url)
    i = brut.find("fnpc_training_list = [")
    if i < 0:
        sys.exit("Protection civile : la page a changé de forme : à regarder à la main")
    liste, _ = json.JSONDecoder().raw_decode(brut[brut.index("[", i):])
    sessions = []
    for x in liste:
        if x.get("training_name") != "PSC" or not x.get("availableForGP"):
            continue
        debut = dt.date.fromisoformat(x["start_date"]["date"][:10])
        fin = dt.date.fromisoformat(x["end_date"]["date"][:10])
        dep = str(x.get("dept") or "").upper()
        prix = float(x["priceGP"]) if x.get("priceGP") else None
        sessions.append({"id": f"pc-{x['id']}", "organisme": "protection-civile", "diplome": "PSC1", "type": "session",
                         "theme": None, "debut": debut, "fin": fin, "ville": commune(x.get("place_city") or ""),
                         "departement": dep, "formule": None,
                         "prix": (int(prix) if prix is not None and prix.is_integer() else prix),
                         "prix_note": None, "aides": [], "complet": not x.get("available_places"), "url": url})
    return sessions


# ---------------------------------------------------------------- sélection et écriture

def ecrire(chemin, sessions, entete):
    def q(v):
        if v is None:
            return "null"
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, (int, float)):
            return str(v)
        if isinstance(v, dt.date):
            return v.isoformat()
        return json.dumps(v, ensure_ascii=False)
    lignes = [entete.rstrip(), "", "sessions:"]
    for s in sessions:
        lignes.append(f"  - id: {s['id']}")
        for k in ["organisme", "diplome", "type", "theme", "debut", "fin", "ville", "departement",
                  "formule", "prix", "prix_note"]:
            lignes.append(f"    {k}: {q(s[k])}")
            if k == "diplome" and s.get("specialite"):
                lignes.append(f"    specialite: {q(s['specialite'])}")
        lignes.append(f"    aides: [{', '.join(q(a) for a in s['aides'])}]")
        for k in ["complet", "url", "releve_le", "verifie_le"]:
            lignes.append(f"    {k}: {q(s[k])}")
        lignes.append("    source: page-organisme")
    Path(chemin).write_text("\n".join(lignes) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--essai", action="store_true", help="n'écrit rien, affiche le résumé")
    args = parser.parse_args()
    aujourdhui = dt.date.today()
    chemin = RACINE / "donnees" / "sessions.yml"
    texte = chemin.read_text(encoding="utf-8")
    entete = texte.split("\nsessions:")[0]
    anciens = {s["id"]: s for s in (yaml.safe_load(texte) or {}).get("sessions", [])}
    zone = {d["code"]: d["zone"] for d in TERRITOIRE["departements"]}

    def periode(d, dep):
        """Les vacances scolaires de la zone du département, ou None."""
        for p in TERRITOIRE["periodes"]:
            z = p.get("zones", {}).get(zone.get(dep), p)
            if dt.date.fromisoformat(str(z["debut"])) <= d <= dt.date.fromisoformat(str(z["fin"])):
                return p["id"]
        return None

    candidates = []
    for nom, fonction in [("AFOCAL", afocal), ("IFAC", ifac_liste), ("UFCV", ufcv),
                          ("Ligue de l'enseignement Île-de-France", ligue), ("Protection civile (PSC1)", protection_civile)]:
        print(f"{nom}…", file=sys.stderr)
        try:
            lues = fonction()
        except SystemExit as e:
            # un organisme dont la page a changé ne bloque pas les autres : ses sessions actuelles sont gardées
            print(f"  {nom} : {e}", file=sys.stderr)
            lues = [dict(x, verifie=False) for x in anciens.values() if x["organisme"] == {
                "AFOCAL": "afocal", "IFAC": "ifac", "UFCV": "ufcv", "Protection civile (PSC1)": "protection-civile"}.get(nom, "ligue-idf")]
        print(f"  {len(lues)} sessions lues", file=sys.stderr)
        candidates += lues

    # sélection : par organisme, une session par département, par vacances (ou par mois hors vacances),
    # par diplôme et par étape : la première non complète, par date puis par prix. Jamais l'essentiel de leur base.
    groupes = {}
    for s in candidates:
        s["debut"] = dt.date.fromisoformat(str(s["debut"])) if not isinstance(s["debut"], dt.date) else s["debut"]
        s["fin"] = dt.date.fromisoformat(str(s["fin"])) if s.get("fin") and not isinstance(s["fin"], dt.date) else s.get("fin")
        if (s["departement"] not in DEPS or s["debut"] < aujourdhui + dt.timedelta(days=3)
                or s["debut"] > aujourdhui + dt.timedelta(days=HORIZON)):
            continue
        s["periode"] = periode(s["debut"], s["departement"])
        quand = s["periode"] or s["debut"].strftime("%Y-%m")
        cle = (s["organisme"], s["departement"], quand, s["diplome"], s["type"])
        groupes.setdefault(cle, []).append(s)
    fiches = {"ifac": lambda s: ifac_pro_fiche(s) if s.get("pro") else ifac_fiche(s),
              "ufcv": ufcv_fiche}
    retenues = []
    for liste in groupes.values():
        liste.sort(key=lambda s: (s["complet"], s["debut"], s["prix"] if s["prix"] is not None else 9999))
        for s in liste[:4]:  # la fiche est relue pour les tarifs ; si elle ne concorde pas, on prend la suivante
            lire_fiche = fiches.get(s["organisme"])
            if s.get("verifie") is False or not lire_fiche or lire_fiche(s):
                retenues.append(s)
                break
    for s in retenues:
        s["releve_le"] = anciens.get(s["id"], {}).get("releve_le") or aujourdhui
        s["verifie_le"] = anciens.get(s["id"], {}).get("verifie_le") if s.get("verifie") is False else aujourdhui
    retenues.sort(key=lambda s: (s["debut"], s["organisme"], s["departement"], s["id"]))

    nouveaux = {s["id"] for s in retenues}
    champs = ["debut", "fin", "ville", "formule", "prix", "complet", "theme"]
    modifies = [s["id"] for s in retenues if s["id"] in anciens
                and any(str(anciens[s["id"]].get(c)) != str(s[c]) for c in champs)]
    print(f"\n{len(candidates)} sessions trouvées, {len(retenues)} retenues.")
    print(f"Par organisme : {dict(sorted(__import__('collections').Counter(s['organisme'] for s in retenues).items()))}")
    print(f"Par diplôme : {dict(sorted(__import__('collections').Counter(s['diplome'] for s in retenues).items()))}")
    print(f"Départements couverts : {len({s['departement'] for s in retenues})}")
    print(f"Confirmées sans changement : {len([i for i in nouveaux & set(anciens) if i not in modifies])}")
    print(f"Modifiées : {len(modifies)}")
    print(f"Ajoutées : {len(nouveaux - set(anciens))}")
    print(f"Retirées (passées, complètes remplacées, disparues ou hors sélection) : {len(set(anciens) - nouveaux)}")
    if not args.essai:
        ecrire(chemin, retenues, entete)
        print(f"Écrit : {chemin}")


if __name__ == "__main__":
    main()
