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
- garde les sessions des vacances à venir (donnees/territoire.yml) et les sessions BAFD ;
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
ACCENTS = {"Velizy-Villacoublay": "Vélizy-Villacoublay", "L'haÿ-les-Roses": "L'Haÿ-les-Roses"}
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
    return _robots[hote].can_fetch(AGENT, url)


def lire(url):
    """Texte de la page en lignes (balises retirées)."""
    if not autorise(url):
        sys.exit(f"robots.txt interdit cette page : {url}")
    time.sleep(PAUSE)
    with urlopen(Request(url, headers={"User-Agent": AGENT}), timeout=30) as r:
        brut = r.read().decode("utf-8", errors="ignore")
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

    print("AFOCAL…", file=sys.stderr)
    candidates = afocal(anciens)
    print("IFAC…", file=sys.stderr)
    candidates += ifac_liste()
    groupes = {}
    for s in candidates:
        s["periode"] = periode(s["debut"])
        if (s["departement"] not in DEPS_IDF or s["debut"] < aujourdhui
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
