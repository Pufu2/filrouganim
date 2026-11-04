#!/usr/bin/env python3
"""Relève les formations CPJEPS, BPJEPS, DEJEPS et DESJEPS (mentions d'animation) du catalogue Mon Compte Formation,
puis écrit donnees/formations-cpf.yml.

Usage :
    python3 outils/relever_cpf.py            # relevé du jour
    python3 outils/relever_cpf.py --essai    # n'écrit rien, affiche le résumé

Source : « Catalogue des formations éligibles au CPF » (Caisse des Dépôts, jeu de données
moncompteformation_catalogueformation, Licence Ouverte Etalab), mis à jour chaque jour :
https://opendata.caissedesdepots.fr/explore/dataset/moncompteformation_catalogueformation/

Ce catalogue donne, pour chaque école, le diplôme préparé, le département, la durée et le prix, mais pas les
dates des rentrées. On garde toutes les écoles, même sans session ouverte ce jour-là. Sur le site, ces formations complètent les sessions datées (FOROMES, catalogue de
l'apprentissage) dans le bloc « Les écoles qui forment à ce diplôme ». Comme pour les sessions, on ne garde
que des faits (école, diplôme, département, durée, prix) et jamais les textes des écoles.
"""

import argparse
import datetime as dt
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from relever import AGENT, DEPS  # noqa: E402
from relever_pro import nom_organisme  # noqa: E402

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "donnees" / "formations-cpf.yml"
JEU = "https://opendata.caissedesdepots.fr/api/explore/v2.1/catalog/datasets/moncompteformation_catalogueformation"
CHAMPS = ["nom_of", "siret", "code_departement", "intitule_certification", "code_certifinfo", "frais_ttc_tot_min",
          "frais_ttc_tot_max", "nombre_heures_total_mean", "nb_session_active", "nb_session_a_distance"]
SPECIALITES = yaml.safe_load((RACINE / "donnees" / "specialites.yml").read_text(encoding="utf-8"))
MINIMUM = 50  # en dessous, la source a sans doute changé : on garde l'ancien fichier


def sans_accents(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()


def diplome_de(intitule):
    t = sans_accents(intitule)
    for d in ("DESJEPS", "DEJEPS", "BPJEPS", "CPJEPS"):  # DESJEPS avant DEJEPS
        if re.search(r"\b" + d.lower() + r"\b", t):
            return d
    if "diplome d'etat superieur de la jeunesse" in t:
        return "DESJEPS"
    if "diplome d'etat de la jeunesse" in t:
        return "DEJEPS"
    if "brevet professionnel de la jeunesse" in t:
        return "BPJEPS"
    if "certificat professionnel de la jeunesse" in t:
        return "CPJEPS"
    return None


def specialite_de(diplome, certifinfo, intitule):
    """Seulement les mentions d'animation de donnees/specialites.yml : les mentions sportives sont écartées."""
    t = sans_accents(intitule)
    if re.search(r"educateur sportif|perfectionnement sportif|performance sportive|activites physiques", t):
        return None
    for sp in SPECIALITES.get(diplome) or []:
        if certifinfo and str(certifinfo) in {str(c) for c in sp.get("certifinfo") or []}:
            return sp["id"]
    for sp in SPECIALITES.get(diplome) or []:
        if sp.get("mots") and re.search(sp["mots"], t):
            return sp["id"]
    return None


def lire(where):
    url = JEU + "/exports/json?" + urllib.parse.urlencode({"select": ",".join(CHAMPS), "where": where, "limit": -1})
    for essai in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # réseau capricieux : on réessaie un peu plus tard
            print(f"  essai {essai + 1} : {e}")
            time.sleep(5 * (essai + 1))
    raise SystemExit("Catalogue CPF injoignable : l'ancien fichier est gardé")


def releve():
    codes = sorted({str(c) for liste in SPECIALITES.values() for sp in liste for c in sp.get("certifinfo") or []})
    where = "code_certifinfo in (" + ",".join(f'"{c}"' for c in codes) + ') or search(intitule_certification, "JEPS")'
    lignes = lire(where)
    formations = {}
    for x in lignes:
        diplome = diplome_de(x.get("intitule_certification"))
        if not diplome:
            continue
        sp = specialite_de(diplome, x.get("code_certifinfo"), x.get("intitule_certification"))
        dep = (x.get("code_departement") or "").strip().upper()
        if len(dep) == 1:
            dep = "0" + dep
        if not sp or dep not in DEPS or not x.get("nom_of"):
            continue
        # toutes les écoles du catalogue, même sans session ouverte aujourd'hui : elles forment au diplôme
        cle = (x.get("siret") or sans_accents(x["nom_of"]), diplome, sp, dep)
        prix_min, prix_max = x.get("frais_ttc_tot_min"), x.get("frais_ttc_tot_max")
        f = formations.setdefault(cle, {"organisme_nom": nom_organisme(x["nom_of"]), "siret": x.get("siret"),
                                        "diplome": diplome, "specialite": sp, "departement": dep,
                                        "prix_min": None, "prix_max": None, "heures": None, "sessions": 0, "distance": False})
        if prix_min:
            f["prix_min"] = round(min(prix_min, f["prix_min"] or prix_min))
        if prix_max:
            f["prix_max"] = round(max(prix_max, f["prix_max"] or prix_max))
        if x.get("nombre_heures_total_mean"):
            f["heures"] = round(x["nombre_heures_total_mean"])
        f["sessions"] += int(x.get("nb_session_active") or 0)
        f["distance"] = f["distance"] or bool(x.get("nb_session_a_distance"))
    return sorted(formations.values(), key=lambda f: (f["diplome"], f["departement"], sans_accents(f["organisme_nom"])))


def ecrire(formations):
    aujourdhui = dt.date.today().isoformat()
    lignes = ["# Formations CPJEPS, BPJEPS, DEJEPS et DESJEPS (mentions d'animation) du catalogue Mon Compte Formation.",
              "# Source : Caisse des Dépôts, catalogue des formations éligibles au CPF (Licence Ouverte Etalab).",
              "# Fichier écrit par outils/relever_cpf.py : ne pas modifier à la main. Faits seulement : école, diplôme,",
              "# département, durée moyenne en heures, prix TTC (le plus bas et le plus haut), nombre de sessions ouvertes.",
              f"# Relevé du {aujourdhui}.", "", "formations:"]
    for f in formations:
        lignes.append("  - " + json.dumps(f, ensure_ascii=False))
    SORTIE.write_text("\n".join(lignes) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--essai", action="store_true", help="n'écrit rien, affiche le résumé")
    args = parser.parse_args()
    formations = releve()
    compte = {}
    for f in formations:
        compte[f["diplome"]] = compte.get(f["diplome"], 0) + 1
    print(f"Formations CPF (animation) : {len(formations)} {compte}")
    if len(formations) < MINIMUM:
        raise SystemExit(f"Seulement {len(formations)} formations : l'ancien fichier est gardé")
    if not args.essai:
        ecrire(formations)
        print(f"Écrit : {SORTIE}")


if __name__ == "__main__":
    main()
