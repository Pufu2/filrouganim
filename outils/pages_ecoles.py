#!/usr/bin/env python3
"""Lecteur commun des pages de formation des écoles (CPJEPS, BPJEPS ASEC, DEJEPS, DESJEPS, CC direction d'ACM).

Utilisé par outils/relever_pro.py. La liste des pages est dans donnees/pages-ecoles.yml : pour chaque page,
l'école, le diplôme (et la spécialité), et la ville par défaut si la page n'en donne pas.

Sur la page, on cherche les périodes de formation : une date de début suivie (sur la même ligne ou dans les
lignes suivantes) d'une date de fin, entre 2 et 30 mois plus tard. Les dates qui suivent les mots « inscription »,
« candidature », « dossier », « réunion », « sélection » ou « test » ne sont jamais prises pour un début de formation.
La ville est celle écrite juste avant (« Paris (75) », « 69100 Villeurbanne »…), sinon celle de la liste.
On ne garde que des faits, jamais les textes de l'école.
"""

import datetime as dt
import hashlib
import html
import re
import sys
import unicodedata
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]
MOTS_PAS_DEBUT = re.compile(r"inscri|candidat|dossier|reunion|information|selection|test|entretien|positionnement|"
                            r"limite|cloture|jusqu|avant le|webinaire|portes ouvertes|epreuve|jury|certification|mis a jour", re.I)
MOTS_FIN = re.compile(r"\bau\b|\bfin\b|jusqu|→|->|–|-|\bà\b", re.I)


def sans_accents(t):
    return unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()


def dates_de(ligne):
    """Toutes les dates complètes d'une ligne, dans l'ordre : « 8 octobre 2026 », « 08/10/2026 », « 1er mars 2027 »."""
    t = sans_accents(ligne)
    trouvees = []
    for m in re.finditer(r"\b(\d{1,2})(?:er)?\s+(" + "|".join(MOIS) + r")\.?\s+(20\d\d)\b", t):
        trouvees.append((m.start(), dt.date(int(m.group(3)), MOIS.index(m.group(2)) + 1, int(m.group(1)))))
    for m in re.finditer(r"\b(\d{1,2})[/.](\d{1,2})[/.](20\d\d)\b", t):
        try:
            trouvees.append((m.start(), dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))))
        except ValueError:
            pass
    # « du 8 au 29 octobre 2027 » ou « 8 octobre 2026 - 29 octobre 2027 » sont déjà couverts ; « octobre 2026 » seul ne l'est pas
    return [d for _, d in sorted(trouvees)]


def lignes_de(brut):
    brut = re.sub(r"<script.*?</script>|<style.*?</style>|<nav.*?</nav>|<footer.*?</footer>", "", brut, flags=re.S | re.I)
    texte = html.unescape(re.sub(r"<(br|/p|/div|/li|/h\d|/tr|/td|/span|/a)\b[^>]*>", "\n", brut, flags=re.I))
    texte = re.sub(r"<[^>]+>", " ", texte)
    return [" ".join(l.split()) for l in texte.split("\n") if l.strip()]


RE_VILLE_DEP = re.compile(r"((?:[A-ZÀ-Ý][\wÀ-ÿ'’\-]*)(?:[ \-](?:sur|sous|en|de|du|des|la|le|les|lès|aux|au|l'|d'|[A-ZÀ-Ý][\wÀ-ÿ'’\-]*))*)"
                          r"\s*\((\d{2}|2[AB])\)")
MOT_HEURE = re.compile(r"\b\d{1,2}\s?h\s?\d{0,2}\b|\b\d{1,2}:\d\d\b")


def villes_de_ligne(l):
    """Toutes les « Ville (NN) » d'une ligne : « à Angers (49) et La Roche-sur-Yon (85) »."""
    return [(m.group(1).strip(), m.group(2)) for m in RE_VILLE_DEP.finditer(l) if m.group(1).strip() not in ("Du", "Le", "La", "En", "Session")]
RE_CP_VILLE = re.compile(r"\b(\d{5})\s+([A-ZÀ-Ý][\wÀ-ÿ'’\- ]{1,40})")


def ville_avant(L, i, villes):
    """La ville écrite juste avant la date (6 lignes au plus) : « Paris (75) », « 69100 Villeurbanne » ou une ville connue."""
    for k in range(i, max(-1, i - 7), -1):
        l = L[k]
        vl = villes_de_ligne(l)
        if vl:
            return vl[0]
        m = RE_CP_VILLE.search(l)
        if m:
            cp = m.group(1)
            dep = "2A" if cp.startswith("20") and int(cp) < 20200 else ("2B" if cp.startswith("20") else cp[:2])
            return m.group(2).strip(), dep
        for v in villes:
            if re.search(r"\b" + re.escape(sans_accents(v["ville"])) + r"\b", sans_accents(l)):
                return v["ville"], v["departement"]
    return None


def sessions_de_page(brut, page, aujourdhui):
    """Les sessions d'une page : [(debut, fin, ville, departement)]."""
    L = lignes_de(brut)
    villes = page.get("villes") or [{"ville": page["ville"], "departement": page["departement"]}]
    vues = {}
    for i, l in enumerate(L):
        ds = dates_de(l)
        if not ds or MOT_HEURE.search(l):
            continue  # une date avec une heure : une réunion, pas une formation
        avant = sans_accents(" ".join(L[max(0, i - 1):i]) + " " + l.split(str(ds[0].year))[0])
        for j, debut in enumerate(ds):
            if MOTS_PAS_DEBUT.search(avant if j == 0 else ""):
                break
            # la fin : une date plus loin sur la même ligne, ou dans les 8 lignes suivantes
            suite = ds[j + 1:] + [d for k in range(i + 1, min(len(L), i + 9)) for d in dates_de(L[k])]
            fin = next((d for d in suite if 150 <= (d - debut).days <= 950), None)
            if not fin:  # « du 27 septembre 2027 à octobre 2028 » : la fin donnée par le mois seul (dernier jour du mois)
                m = re.search(r"(?:au|a|-)\s+(" + "|".join(MOIS) + r")\s+(20\d\d)", sans_accents(l))
                if m:
                    an, mo = int(m.group(2)), MOIS.index(m.group(1)) + 1
                    d = dt.date(an + (mo == 12), mo % 12 + 1, 1) - dt.timedelta(days=1)
                    fin = d if 150 <= (d - debut).days <= 950 else None
            # une date de début seule, si elle est annoncée comme telle (« Début : », « rentrée le », « entrée en formation »)
            if not fin and not re.search(r"debut|rentree|entree|demarrage|prochaine session|commence|demarre",
                                        sans_accents(" ".join(L[max(0, i - 1):i]) + " " + l)):
                continue
            if debut < aujourdhui + dt.timedelta(days=3):
                break
            lieux = villes_de_ligne(l) or [ville_avant(L, i, villes) or ((villes[0]["ville"], villes[0]["departement"]) if len(villes) == 1 else None)]
            for lieu in lieux:
                if not lieu:
                    continue
                cle = (debut, lieu[0])
                if cle not in vues or (fin and not vues[cle][1]):  # la version avec la date de fin l'emporte
                    vues[cle] = (debut, fin, lieu[0], lieu[1])
            break
    toutes = list(vues.values())
    # une date de début seule (« Prochaine session : … ») déjà donnée ailleurs avec sa fin et sa ville : en double
    completes = {d for d, f, _, _ in toutes if f}
    return [s for s in toutes if s[1] or s[0] not in completes]


def pages_ecoles(aujourdhui, lire_brut, autorise, nom_organisme, ville_de):
    """Toutes les pages de donnees/pages-ecoles.yml ; une page illisible n'arrête pas les autres."""
    liste = yaml.safe_load((RACINE / "donnees" / "pages-ecoles.yml").read_text(encoding="utf-8"))["pages"]
    sessions = []
    for page in liste:
        try:
            if not autorise(page["url"]):
                print(f"  {page['organisme']} : robots.txt interdit la page, ignorée", file=sys.stderr)
                continue
            brut = lire_brut(page["url"])
        except BaseException as e:  # noqa: B036 (SystemExit compris : une page en panne ne bloque pas les autres)
            print(f"  {page['organisme']} : illisible ({e})", file=sys.stderr)
            continue
        lues = sessions_de_page(brut, page, aujourdhui)
        print(f"  {page['organisme']} {page['diplome']} : {len(lues)} session(s)", file=sys.stderr)
        for debut, fin, ville, dep in lues:
            sessions.append({
                "id": "eco-" + hashlib.sha1(f"{page['url']}|{debut}|{ville}".encode()).hexdigest()[:12],
                "organisme": None, "organisme_nom": page["organisme"], "diplome": page["diplome"],
                "specialite": page.get("specialite"), "type": "parcours", "theme": None, "debut": debut, "fin": fin,
                "ville": ville_de(ville), "departement": dep, "formule": page.get("formule"), "prix": page.get("prix"),
                "prix_note": page.get("note"), "aides": [], "complet": False, "url": page["url"], "source": "page-organisme"})
    return sessions
