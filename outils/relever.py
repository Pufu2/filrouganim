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
DEPS_IDF = {"75", "77", "78", "91", "92", "93", "94", "95"}
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

def afocal(anciens_ids):
    fichiers = set()
    for typ in (1, 2):  # 1 : formations générales, 2 : approfondissements
        precedent = None
        for n in range(1, 80):
            brut, _ = lire(f"https://www.afocal.fr/bafa/recherche-bafa-ile-de-france-{typ}-{n}.html")
            page = frozenset(re.findall(r"stage-bafa-[0-9a-z]+\.html", brut))
            if page == precedent:
                break
            fichiers |= page
            precedent = page
    fichiers |= {f"stage-bafa-{i[len('afocal-'):]}.html" for i in anciens_ids if i.startswith("afocal-")}
    sessions = []
    for f in sorted(fichiers):
        url = "https://www.afocal.fr/bafa/" + f
        try:
            _, L = lire(url)
        except Exception as e:  # page disparue : la session n'est plus proposée
            print(f"  AFOCAL {f} : illisible ({e})", file=sys.stderr)
            continue
        i = next((k for k, l in enumerate(L) if re.match(r"du \d\d/\d\d/\d\d au \d\d/\d\d/\d\d", l)), None)
        if i is None:
            continue
        m = re.match(r"du (\d\d)/(\d\d)/(\d\d) au (\d\d)/(\d\d)/(\d\d)", L[i])
        lieu = re.match(r"à (.+) \((\d\d)\)", L[i + 1])
        if not lieu:
            continue
        theme = next((re.sub(r"^Thèmes? : ", "", l).replace(" + ", " et ") for l in L[i + 2:i + 5]
                      if re.match(r"Thèmes? : ", l)), None)
        if theme and theme.startswith("à préciser"):
            theme = None
        tarifs = {}
        for l in L:
            t = re.match(r"(Externat|Demi-pension|½ pension|1/2 pension|Pension complète|Pension|Internat) : ([\d ]+,\d\d) €", l)
            if t:
                tarifs[FORMULES[t.group(1).lower()]] = float(t.group(2).replace(" ", "").replace(",", "."))
        formule, prix, note = formule_prix(tarifs)
        notes = [n for n in [note, "en plusieurs parties (une interruption est prévue)"
                             if any("plusieurs périodes" in l for l in L) else None] if n]
        type_ = {"Formation générale": "formation-generale", "Approfondissement": "approfondissement",
                 "Qualification": "qualification", "Perfectionnement": "perfectionnement"}.get(L[i - 2])
        if not type_ or L[i - 1] not in ("BAFA", "BAFD"):
            continue
        sessions.append({
            "id": "afocal-" + f[len("stage-bafa-"):-5], "organisme": "afocal", "diplome": L[i - 1], "type": type_,
            "theme": theme, "debut": dt.date(2000 + int(m.group(3)), int(m.group(2)), int(m.group(1))),
            "fin": dt.date(2000 + int(m.group(6)), int(m.group(5)), int(m.group(4))),
            "ville": commune(lieu.group(1)), "departement": lieu.group(2), "formule": formule, "prix": prix,
            "prix_note": "; ".join(notes) or None,
            "aides": ["aides possibles pour les habitants d'Île-de-France"] if "Aides financières possibles pour le BAFA" in L else [],
            "complet": "Stage complet" in L, "url": url})
    return sessions


# ---------------------------------------------------------------- IFAC

TYPES_IFAC = {"Formation Générale BAFA": ("BAFA", "formation-generale"), "Approfondissement BAFA": ("BAFA", "approfondissement"),
              "Qualification BAFA": ("BAFA", "qualification"), "Formation Générale BAFD": ("BAFD", "formation-generale"),
              "Perfectionnement BAFD": ("BAFD", "perfectionnement")}


def ifac_liste():
    brut, L = lire("https://ifac-formation.fr/formations/sessions/bafa/%C3%8Ele-de-France")
    ids = list(dict.fromkeys(re.findall(r'href="/formations/sessions/(\d+)"', brut)))
    blocs = []
    for i, l in enumerate(L):
        m = re.match(r"Du (\d\d)/(\d\d)/(\d{4}) au (\d\d)/(\d\d)/(\d{4})$", l)
        if not m:
            continue
        j = next(k for k in range(i - 1, i - 5, -1) if re.search(r"(BAFA|BAFD)$", L[k]))
        entre = [x for x in L[j + 1:i] if x not in ("Complet", "Dernières places")]
        blocs.append({"type": L[j], "theme": " ".join(entre) or None,
                      "debut": dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1))),
                      "fin": dt.date(int(m.group(6)), int(m.group(5)), int(m.group(4))), "adresse": L[i + 1],
                      "complet": "Complet" in L[j + 1:i] or L[i + 2] == "En savoir plus"})
    if len(ids) != len(blocs):
        sys.exit(f"IFAC : la page a changé de forme ({len(ids)} liens, {len(blocs)} sessions) : à regarder à la main")
    sessions = []
    for ident, b in zip(ids, blocs):
        if b["type"] not in TYPES_IFAC:
            continue
        diplome, type_ = TYPES_IFAC[b["type"]]
        m = re.search(r"(\d{5}) (.+)$", b["adresse"])
        if not m:
            continue
        cp = m.group(1)
        ville = (f"Paris {int(cp[3:])}{'er' if int(cp[3:]) == 1 else 'e'}" if cp.startswith("75") else commune(m.group(2)))
        sessions.append({"id": "ifac-" + ident, "organisme": "ifac", "diplome": diplome, "type": type_, "theme": b["theme"],
                         "debut": b["debut"], "fin": b["fin"], "ville": ville, "departement": cp[:2], "formule": None,
                         "prix": None, "prix_note": None, "aides": [], "complet": b["complet"],
                         "url": f"https://ifac-formation.fr/formations/sessions/bafa-bafd/{ident}"})
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


def ufcv(dans_periode):
    """Liste Île-de-France (idRegion=10), puis la fiche des sessions des vacances à venir (département, tarifs)."""
    base = "https://bafa.ufcv.fr/R%C3%A9sultats-de-recherche?idType=0&idRegion=10&page="
    vus, blocs = set(), []
    for n in range(1, 80):
        brut, L = lire(base + str(n))
        ids = list(dict.fromkeys(re.findall(r"idPeriode=(\d+)", brut)))
        nouveaux = [i for i in ids if i not in vus]
        if not nouveaux:
            break
        # la liste commence après l'en-tête « TYPE / DATE / LIEU / PRIX » (avant : les menus de recherche)
        k = next((x + 1 for x in range(len(L) - 2) if L[x:x + 3] == ["TYPE", "DATE / LIEU", "PRIX"]), len(L))
        fin_liste = next((x for x in range(k, len(L)) if L[x] == "TROUVER UNE FORMATION"), len(L))
        lus = []
        while k < fin_liste:
            if re.match(r"BAF[AD] \d - ", L[k]):
                type_l = L[k]
                j = k + 1
                theme = None
                if not L[j].startswith("Du "):
                    theme, j = L[j], j + 1
                debut, fin = dates_texte(L[j])
                while j < len(L) and L[j].startswith("Du "):
                    j += 1
                prix = re.match(r"([\d ]+) €$", L[j + 1]) if j + 1 < len(L) else None
                lus.append({"type_l": type_l, "theme": theme, "debut": debut, "fin": fin,
                            "prix_liste": float(prix.group(1).replace(" ", "")) if prix else None})
                k = j + 1
            else:
                k += 1
        if len(lus) != len(ids):
            sys.exit(f"UFCV : la page a changé de forme ({len(ids)} liens, {len(lus)} sessions) : à regarder à la main")
        for i, b in zip(ids, lus):
            if i not in vus:
                vus.add(i)
                b["id"] = i
                blocs.append(b)
    sessions = []
    for b in blocs:
        if not b["debut"] or not dans_periode(b["debut"], b["type_l"].startswith("BAFD")):
            continue
        url = "https://bafa.ufcv.fr/D%C3%A9tail-de-la-session?idPeriode=" + b["id"]
        try:
            _, L = lire(url)
        except Exception as e:
            print(f"  UFCV {b['id']} : illisible ({e})", file=sys.stderr)
            continue
        i = next((k for k, l in enumerate(L) if dates_texte(l) == (b["debut"], b["fin"])), None)
        lieu = re.match(r"(.+?) (\d{2}) - ", L[i + 1]) if i is not None else None
        if not lieu:
            print(f"  UFCV {b['id']} : lieu illisible, session écartée", file=sys.stderr)
            continue
        tarifs = {}
        if "Montant" in L:
            k = L.index("Montant") + 1
            while k + 1 < len(L) and re.match(r"([\d ]+(?:,\d+)?) €$", L[k + 1]) and L[k].lower() in FORMULES:
                tarifs[FORMULES[L[k].lower()]] = float(re.match(r"([\d ]+(?:,\d+)?) €$", L[k + 1]).group(1).replace(" ", "").replace(",", "."))
                k += 2
        formule, prix, note = formule_prix(tarifs)
        diplome = b["type_l"][:4]
        if "Formation Générale" in b["type_l"]:
            type_ = "formation-generale"
        elif "Perfectionnement" in b["type_l"]:
            type_ = "perfectionnement"
        elif b["theme"] and re.search(r"baignade|qualification", b["theme"], re.I):
            type_ = "qualification"
        else:
            type_ = "approfondissement"
        etat = next((l for l in L if l.startswith("En date du")), "")
        if b["theme"]:
            b["theme"] = re.sub(r"^Qualification\s+", "", b["theme"])
        sessions.append({"id": "ufcv-" + b["id"], "organisme": "ufcv", "diplome": diplome, "type": type_, "theme": b["theme"],
                         "debut": b["debut"], "fin": b["fin"], "ville": commune(lieu.group(1)), "departement": lieu.group(2),
                         "formule": formule, "prix": prix if prix is not None else b["prix_liste"], "prix_note": note,
                         "aides": [], "complet": bool(etat) and "places disponibles" not in etat,
                         "url": url})
    return sessions


# ---------------------------------------------------------------- Ligue de l'enseignement Île-de-France

def ligue(dans_periode):
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
        if not dans_periode(debut, cat[0] == "BAFD"):
            continue
        formule = next((FORMULES[l.lower()] for l in L[i + 2:i + 8] if l.lower() in FORMULES), None)
        prix = int(p["prices"]["price"]) / 10 ** p["prices"].get("currency_minor_unit", 2)
        sessions.append({"id": "ligue-" + str(p["id"]), "organisme": "ligue-idf", "diplome": cat[0], "type": cat[1],
                         "theme": None, "debut": debut, "fin": fin,
                         "ville": commune(lieu.group(1).split(" • ")[-1]),
                         "departement": lieu.group(2), "formule": formule, "prix": int(prix) if prix.is_integer() else prix,
                         "prix_note": None, "aides": [], "complet": not p.get("is_in_stock", True), "url": p["permalink"]})
    return sessions


# ---------------------------------------------------------------- IFAC : formations professionnelles de l'animation

IFAC_PRO = {92: "CQP-AP", 93: "CPJEPS", 94: "BPJEPS", 97: "DEJEPS", 99: "DESJEPS"}


def ifac_pro():
    """Les sessions en Île-de-France des formations professionnelles (CQP, CPJEPS, BPJEPS, DEJEPS, DESJEPS)."""
    sessions = []
    for page, diplome in IFAC_PRO.items():
        brut, _ = lire(f"https://ifac-formation.fr/formations/professionnelles/{page}")
        for ident in dict.fromkeys(re.findall(r'href="/formations/sessions/(\d+)"', brut)):
            url = f"https://ifac-formation.fr/formations/sessions/professionnelles/{ident}"
            try:
                _, L = lire(url)
            except Exception as e:
                print(f"  IFAC pro {ident} : illisible ({e})", file=sys.stderr)
                continue
            if "Informations pratiques" not in L:
                continue
            k = L.index("Informations pratiques")
            bloc = L[k + 1:k + 30]
            dates = next((dates_texte(l) for l in bloc if l.startswith("Du ")), (None, None))
            cp = next((re.search(r"(\d{5}) (.+)$", l) for l in bloc if re.search(r"\b(7[5789]|9[1-5])\d{3} ", l)), None)
            if not dates[0] or not cp:
                continue
            duree = next((re.search(r"(\d+) heures", l).group(1) for l in bloc if re.match(r"Durée : \d+ heures", l)), None)
            prix = None
            if "Parcours complet" in bloc:
                v = re.match(r"([\d ]+)\s*€", bloc[bloc.index("Parcours complet") + 1])
                prix = int(v.group(1).replace(" ", "")) if v else None
            limite = next((l for l in L if l.startswith("Merci de compléter et nous adresser votre dossier")), "")
            m_lim = re.search(r"avant le : (\d{1,2}) (\w+) (\d{4})", limite)
            notes = []
            if duree:
                notes.append(f"{duree} heures de formation")
            if m_lim:
                notes.append(f"dossier avant le {m_lim.group(1)} {m_lim.group(2)} {m_lim.group(3)}")
            if any("apprentissage" in l.lower() for l in L):
                notes.append("possible en apprentissage (sans frais pour l'apprenti)")
            code = cp.group(1)
            ville = (f"Paris {int(code[3:])}{'er' if int(code[3:]) == 1 else 'e'}" if code.startswith("75") else commune(cp.group(2)))
            sessions.append({"id": "ifac-pro-" + ident, "organisme": "ifac", "diplome": diplome, "type": "parcours",
                             "theme": bloc[0] if bloc and bloc[0] != diplome else None,
                             "debut": dates[0], "fin": dates[1], "ville": ville, "departement": code[:2],
                             "formule": "alternance", "prix": prix, "prix_note": " ; ".join(notes) or None,
                             "aides": [], "complet": "Complet" in bloc, "url": url, "pro": True})
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
    periodes = [p for p in yaml.safe_load((RACINE / "donnees" / "territoire.yml").read_text(encoding="utf-8"))["periodes"]
                if dt.date.fromisoformat(str(p["fin"])) >= aujourdhui]

    def periode(d):
        return next((p["id"] for p in periodes
                     if dt.date.fromisoformat(str(p["debut"])) <= d <= dt.date.fromisoformat(str(p["fin"]))), None)

    def dans_periode(d, bafd=False):
        return d >= aujourdhui + dt.timedelta(days=3) and (bafd or periode(d) is not None)

    print("AFOCAL…", file=sys.stderr)
    candidates = afocal(anciens)
    print("IFAC…", file=sys.stderr)
    candidates += ifac_liste()
    print("UFCV…", file=sys.stderr)
    candidates += ufcv(dans_periode)
    print("Ligue de l'enseignement…", file=sys.stderr)
    candidates += ligue(dans_periode)
    print("IFAC, formations professionnelles…", file=sys.stderr)
    pro = [x for x in ifac_pro() if x["debut"] >= aujourdhui]
    groupes = {}
    for s in candidates:
        s["periode"] = periode(s["debut"])
        # moins de 3 jours avant le début : trop tard pour s'inscrire, inutile de l'afficher
        if (s["departement"] not in DEPS_IDF or s["debut"] < aujourdhui + dt.timedelta(days=3)
                or (s["periode"] is None and s["diplome"] != "BAFD")):
            continue
        cle = (s["organisme"], s["departement"], s["periode"], s["diplome"], s["type"])
        groupes.setdefault(cle, []).append(s)
    retenues = []
    for liste in groupes.values():
        liste.sort(key=lambda s: (s["complet"], s["debut"], s["prix"] if s["prix"] is not None else 9999))
        for s in liste:  # IFAC : le tarif est sur la fiche ; si la fiche ne concorde pas, on prend la suivante
            if s["organisme"] != "ifac" or ifac_fiche(s):
                retenues.append(s)
                break
    for s in retenues:
        s["releve_le"] = anciens.get(s["id"], {}).get("releve_le") or aujourdhui
        s["verifie_le"] = aujourdhui
    # formations professionnelles : peu nombreuses, toutes gardées (pas de sélection)
    for x in pro:
        x["releve_le"] = anciens.get(x["id"], {}).get("releve_le") or aujourdhui
        x["verifie_le"] = aujourdhui
    retenues += pro
    retenues.sort(key=lambda s: (s["debut"], s["organisme"], s["departement"], s["id"]))

    nouveaux = {s["id"] for s in retenues}
    champs = ["debut", "fin", "ville", "formule", "prix", "complet", "theme"]
    modifies = [s["id"] for s in retenues if s["id"] in anciens
                and any(str(anciens[s["id"]].get(c)) != str(s[c]) for c in champs)]
    print(f"\n{len(candidates)} sessions trouvées, {len(retenues)} retenues.")
    print(f"Confirmées sans changement : {len([i for i in nouveaux & set(anciens) if i not in modifies])}")
    print(f"Modifiées : {len(modifies)} {modifies}")
    print(f"Ajoutées : {len(nouveaux - set(anciens))}")
    print(f"Retirées (passées, complètes remplacées, disparues ou hors sélection) : {len(set(anciens) - nouveaux)}")
    if not args.essai:
        ecrire(chemin, retenues, entete)
        print(f"Écrit : {chemin}")


if __name__ == "__main__":
    main()
