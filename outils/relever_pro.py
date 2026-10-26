#!/usr/bin/env python3
"""Relève les sessions CPJEPS, BPJEPS, DEJEPS et DESJEPS de toute la France, puis écrit donnees/sessions-pro.yml.

Usage :
    python3 outils/relever_pro.py            # relevé du jour
    python3 outils/relever_pro.py --essai    # n'écrit rien, affiche le résumé

Deux sources publiques, toutes écoles confondues (organismes privés, associations, CREPS, CFA…) :

1. Le catalogue national des formations en apprentissage (Réseau des Carif-Oref, API ouverte,
   https://catalogue-apprentissage.intercariforef.org/api/docs/). C'est l'offre que reprennent
   La bonne alternance, Parcoursup et les régions. Le lien « Voir » mène à la fiche de la formation
   sur La bonne alternance (site public), qui donne le contact de l'école.
2. L'API Offre Info du Réseau des Carif-Oref (toute l'offre de formation, avec les prix), si le
   secret RCO_OFFREINFO_TOKEN existe : le jeton se demande à api-offreinfo@intercariforef.org
   (gratuit). Conditions : citer la source avec le logo du RCO, ne pas vendre les données.

Comme pour les autres sessions, on ne garde que des faits (diplôme, spécialité, dates, ville,
organisme, prix) et jamais les textes des écoles.
"""

import argparse
import collections
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from relever import AGENT, DEPS, commune  # noqa: E402

RACINE = Path(__file__).resolve().parent.parent
HORIZON = 420  # jours : les formations professionnelles se choisissent un an à l'avance
CATALOGUE = "https://catalogue-apprentissage.intercariforef.org/api/entity/formations"
OFFREINFO = "https://api-offreinfo.intercariforef.org"
LBA = "https://labonnealternance.apprentissage.beta.gouv.fr/formation/"
SPECIALITES = yaml.safe_load((RACINE / "donnees" / "specialites.yml").read_text(encoding="utf-8"))
SIGLES = {"CREPS", "UFCV", "IFAC", "CEMEA", "AFPA", "UCPA", "INFA", "IRFA", "CFA", "AFOCAL", "FFE", "FFF", "CNAM", "IUT",
          "GRETA", "STAPS", "IFEP", "IRTS", "FAL", "UFOLEP", "USEP", "MJC", "MFR", "IRFSS", "ADPS", "URFOL", "CROS", "CDOS",
          "DRAJES", "IPMS", "CAPS", "EPMS", "CFPPA", "LEPA", "PSL", "ASPTT", "FSCF", "IUFM", "ENSV", "FNMNS", "AFDAS", "IFPS"}
PETITS = {"de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "a", "à", "sur", "pour", "d", "l"}
# mots courts écrits en minuscules ; les autres mots de 5 lettres ou moins sont pris pour des sigles (IRSS, ENCP…)
COMMUNS = {"sport", "sports", "sante", "santé", "club", "cours", "ecole", "école", "union", "ligue", "rural", "monde", "mer",
           "nord", "sud", "est", "ouest", "ile", "île", "val", "haute", "haut", "basse", "bas", "grand", "terre", "ville",
           "cheval", "nature", "plein", "air", "eau", "vie", "jeune", "jeux", "arts", "art", "paris", "lyon", "nice", "metz",
           "caen", "brest", "tours", "dijon", "reims", "nancy", "nimes", "nîmes", "pau", "laval", "vichy", "agen", "albi",
           "arles", "blois", "evry", "évry", "foix", "gap", "lens", "lille", "mende", "niort", "rodez", "sete", "sète",
           "sedan", "sens", "tulle", "dax", "auch", "melun", "macon", "mâcon", "vannes", "lorient", "anger", "lorie",
           "cergy", "creil", "sarre", "alpes", "loire", "rhone", "rhône", "seine", "marne", "somme", "oise", "aube",
           "indre", "cher", "gers", "lot", "tarn", "var", "ain", "orne", "eure", "aisne", "corse", "savoie", "maine",
           "anjou", "berry", "nantes", "rouen", "lille", "amiens", "troyes", "vienne", "isere", "isère", "doubs", "jura",
           "centre", "pole", "pôle", "maison", "campus", "groupe", "espace", "formation", "pays", "cote", "côte", "azur", "voile",
           "lac", "lacs", "potes", "foot", "saint", "drome", "drôme", "auto", "elite", "forma", "golf", "tennis", "rugby", "judo",
           "leo", "basket", "surf", "kayak", "ski", "club", "plage", "port", "golfe", "baie", "mont", "ferme", "parc", "relai", "relais"}
ABREGES = {"ASS": "Association", "ASSO": "Association", "ST": "Saint", "STE": "Sainte"}


def sans_accents(t):
    return unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()


def lire_json(url, entetes=None, essais=5):
    for i in range(essais):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENT, "Accept": "application/json", **(entetes or {})})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(2 + 3 * i)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(2 + 3 * i)
    raise SystemExit(f"illisible après {essais} essais : {url[:120]}")


def nom_organisme(texte):
    """« CENTRE DE FORMATION XYZ » → « Centre de formation XYZ » (sigles gardés en capitales)."""
    texte = " ".join((texte or "").replace("’", "'").split())
    if not texte:
        return None
    if texte != texte.upper():
        return texte  # déjà écrit en minuscules et capitales : on ne touche à rien
    mots = []
    for i, mot in enumerate(re.split(r"(\s+|-|')", texte)):
        bas = mot.lower()
        if not mot.strip() or mot in "-'":
            mots.append(mot)
        elif mot in ABREGES:
            mots.append(ABREGES[mot])
        elif mot in SIGLES or "." in mot or (len(mot) <= 5 and bas not in COMMUNS and bas not in PETITS and mot.isalpha()):
            mots.append(mot)
        elif bas in PETITS and mots:
            mots.append(bas)
        else:
            mots.append(bas[:1].upper() + bas[1:])
    return "".join(mots)


def lien_lba(cle, intitule):
    lettres = re.sub(r"[^a-z0-9]+", "-", sans_accents(intitule)).strip("-")[:80] or "formation"
    return LBA + urllib.parse.quote(cle, safe="") + "/" + lettres


def diplome_de(texte, type_certif=None):
    t = (type_certif or "") + " " + texte
    t = sans_accents(t).replace(" ", "").replace("-", "")
    for code, motif in [("DESJEPS", "desjeps|diplomedetatsuperieur"), ("DEJEPS", "dejeps|diplomedetat"),
                        ("BPJEPS", "bpjeps|brevetprofessionnel"), ("CPJEPS", "cpjeps|certificatprofessionnel")]:
        if re.search(motif, t):
            return code
    return None


def specialite_de(diplome, certifinfo, *textes):
    liste = SPECIALITES.get(diplome) or []
    for sp in liste:
        if certifinfo and int(certifinfo) in sp["certifinfo"]:
            return sp["id"]
    texte = sans_accents(" ".join(t or "" for t in textes))
    for sp in liste:
        if re.search(sp["mots"], texte):
            return sp["id"]
    return None


def ville_de(nom):
    """commune() de relever.py, plus la majuscule après l'apostrophe : « L'ETRAT » → « L'Étrat »."""
    v = commune(nom or "")
    v = re.sub(r"^([LlDd]')(\w)", lambda m: m.group(1).upper() + m.group(2).upper(), v)  # en tête : L'Étrat
    return re.sub(r"-([LlDd]')(\w)", lambda m: "-" + m.group(1).lower() + m.group(2).upper(), v)  # Saint-Martin-d'Hères


def departement_de(code_postal, dep):
    cp = (code_postal or "").strip()
    if cp.startswith("20") and len(cp) == 5:
        return "2A" if int(cp) < 20200 else "2B"
    dep = (dep or cp[:2]).strip()
    return dep.zfill(2) if dep.isdigit() and len(dep) < 2 else dep


# ---------------------------------------------------------------- 1. catalogue de l'apprentissage

def catalogue(aujourdhui):
    requete = {"published": True, "$or": [{"rncp_intitule": {"$regex": "JEPS|jeunesse, de l", "$options": "i"}},
                                          {"intitule_long": {"$regex": "JEPS", "$options": "i"}}]}
    formations, page = [], 1
    while True:
        d = lire_json(f"{CATALOGUE}?limit=200&page={page}&query={urllib.parse.quote(json.dumps(requete))}")
        formations += d["formations"]
        if page >= int(d["pagination"]["nombre_de_page"]):
            break
        page += 1
        time.sleep(0.5)
    if len(formations) < 300:
        raise SystemExit(f"catalogue : seulement {len(formations)} formations, l'API a peut-être changé")
    sessions = []
    for f in formations:
        diplome = diplome_de(f.get("intitule_long") or "", (f.get("rncp_details") or {}).get("code_type_certif"))
        if not diplome:
            continue
        dep = departement_de(f.get("code_postal"), f.get("num_departement"))
        org = nom_organisme(f.get("etablissement_formateur_enseigne") or f.get("etablissement_formateur_entreprise_raison_sociale")
                            or f.get("etablissement_gestionnaire_enseigne") or f.get("etablissement_gestionnaire_entreprise_raison_sociale"))
        if org and len(org) <= 6 and f.get("etablissement_formateur_localite"):
            org = f"{org} {commune(f['etablissement_formateur_localite'])}"  # « CREPS » seul ne dit rien
        sp = specialite_de(diplome, f.get("id_certifinfo"), f.get("intitule_long"), f.get("rncp_intitule"), f.get("intitule_court"))
        duree = f.get("duree")
        for debut, fin in zip(f.get("date_debut") or [], f.get("date_fin") or []):
            debut, fin = dt.date.fromisoformat(debut[:10]), dt.date.fromisoformat(fin[:10])
            if fin < debut:
                continue
            notes = []  # « gratuit en apprentissage » est déjà écrit à la place du prix
            if duree and str(duree).isdigit():
                notes.append(f"{duree} an{'s' if int(duree) > 1 else ''} en alternance")
            cle = f["cle_ministere_educatif"]
            sessions.append({
                "id": f"app-{hashlib.sha1(cle.encode()).hexdigest()[:10]}-{debut:%Y%m%d}",
                "organisme": None, "organisme_nom": org, "diplome": diplome, "specialite": sp, "type": "parcours", "theme": None,
                "debut": debut, "fin": fin, "ville": ville_de(f.get("localite")), "departement": dep,
                "formule": "apprentissage", "prix": 0, "prix_note": " ; ".join(notes), "aides": [], "complet": False,
                "url": lien_lba(cle, f.get("intitule_long") or diplome), "source": "catalogue-apprentissage"})
    return sessions


# ---------------------------------------------------------------- 2. API Offre Info (avec jeton)

def offre_info(aujourdhui, jeton):
    entetes = {"Authorization": f"Bearer {jeton}"}
    codes = ",".join(str(c) for liste in SPECIALITES.values() for sp in liste for c in sp["certifinfo"])
    ids, page = [], 1
    while True:
        d = lire_json(f"{OFFREINFO}/recherche?certifinfo={codes}&date_debut={aujourdhui.isoformat()}&limit=1000&page={page}"
                      f"&fields=id,date_debut,date_fin,certification,intitule_formation", entetes)
        ids += d.get("results") or []
        if not d.get("results") or page * int(d.get("limit") or 1000) >= int(d.get("total") or 0):
            break
        page += 1
    champs = ("id,intitule_formation,date_debut,date_fin,certification,prix_total_TTC,lieu_formation,organisme_formateur,"
              "organisme_responsable,url_session,url_action,url_formation,etat_recrutement,nombre_heures_total,"
              "extra_contrat_apprentissage,modalites_enseignement")
    sessions = []
    for r in ids:
        time.sleep(0.15)  # au plus 10 requêtes par seconde
        try:
            o = lire_json(f"{OFFREINFO}/offre/{urllib.parse.quote(r['id'], safe='')}?fields={champs}", entetes)
        except Exception as e:  # une fiche illisible n'arrête pas les autres
            print(f"  Offre Info {r['id']} : {e}", file=sys.stderr)
            continue
        o = o.get("data", o) if isinstance(o, dict) else o
        certifs = o.get("certification") or []
        certifinfo = next((c.get("code_certifinfo") for c in certifs if c.get("code_certifinfo")), None)
        diplome = diplome_de(o.get("intitule_formation") or "")
        sp = None
        for nom_dipl, liste in SPECIALITES.items():
            for spe in liste:
                if certifinfo and int(certifinfo) in spe["certifinfo"]:
                    diplome, sp = nom_dipl, spe["id"]
        if not diplome or not o.get("date_debut"):
            continue
        sp = sp or specialite_de(diplome, None, o.get("intitule_formation"))
        lieu = o.get("lieu_formation") or {}
        formateurs = o.get("organisme_formateur") or []
        org = nom_organisme((formateurs[0].get("raison_sociale") if formateurs else None)
                            or (o.get("organisme_responsable") or {}).get("raison_sociale"))
        prix = o.get("prix_total_TTC")
        try:
            prix = round(float(str(prix).replace(",", ".").replace(" ", ""))) if prix not in (None, "", "0", 0) else None
        except ValueError:
            prix = None
        notes = []
        if o.get("nombre_heures_total"):
            notes.append(f"{o['nombre_heures_total']} heures de formation")
        if o.get("extra_contrat_apprentissage"):
            notes.append("possible en apprentissage (sans frais pour l'apprenti)")
        url = o.get("url_session") or o.get("url_action") or o.get("url_formation") or (
            "https://www.intercariforef.org/outils/recherche-offreinfo/formations/sessions/"
            f"{o.get('numero_formation')}/{o.get('numero_action')}/{o.get('numero_session')}")
        sessions.append({
            "id": "rco-" + re.sub(r"[^A-Za-z0-9_]", "", o["id"])[-40:], "organisme": None, "organisme_nom": org,
            "diplome": diplome, "specialite": sp, "type": "parcours", "theme": None,
            "debut": dt.date.fromisoformat(o["date_debut"][:10]),
            "fin": dt.date.fromisoformat(o["date_fin"][:10]) if o.get("date_fin") else None,
            "ville": ville_de(lieu.get("ville")), "departement": departement_de(lieu.get("codepostal"), lieu.get("departement")),
            "formule": "distance" if o.get("modalites_enseignement") == 2 else None, "prix": prix,
            "prix_note": " ; ".join(notes) or None, "aides": [], "complet": o.get("etat_recrutement") == 2,
            "url": url, "source": "offre-info"})
    return sessions


# ---------------------------------------------------------------- écriture

ENTETE = """# Sessions des diplômes professionnels (CPJEPS, BPJEPS, DEJEPS, DESJEPS) de toute la France.
# Fichier écrit par outils/relever_pro.py (ne pas modifier à la main : il est réécrit à chaque relevé).
# Sources : catalogue national des formations en apprentissage et, quand le jeton existe, API Offre
# Info (Réseau des Carif-Oref). Faits seulement : diplôme, spécialité, dates, ville, organisme, prix.
# Champs : ceux de sessions.yml, plus specialite (donnees/specialites.yml), organisme_nom (école absente
# de organismes.yml) et source (catalogue-apprentissage | offre-info)."""


def ecrire(chemin, sessions):
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
    lignes = [ENTETE, "", "sessions:"]
    for s in sessions:
        lignes.append(f"  - id: {s['id']}")
        for k in ["organisme", "organisme_nom", "diplome", "specialite", "type", "theme", "debut", "fin", "ville",
                  "departement", "formule", "prix", "prix_note"]:
            lignes.append(f"    {k}: {q(s[k])}")
        lignes.append("    aides: []")
        for k in ["complet", "url", "releve_le", "verifie_le", "source"]:
            lignes.append(f"    {k}: {q(s[k])}")
    Path(chemin).write_text("\n".join(lignes) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--essai", action="store_true", help="n'écrit rien, affiche le résumé")
    args = parser.parse_args()
    aujourdhui = dt.date.today()
    chemin = RACINE / "donnees" / "sessions-pro.yml"
    anciens = {}
    if chemin.exists():
        anciens = {s["id"]: s for s in (yaml.safe_load(chemin.read_text(encoding="utf-8")) or {}).get("sessions") or []}

    lues = []
    sources = [("Catalogue de l'apprentissage", catalogue)]
    jeton = (os.environ.get("RCO_OFFREINFO_TOKEN") or "").strip()
    if jeton:
        sources.append(("API Offre Info", lambda j: offre_info(j, jeton)))
    else:
        print("API Offre Info : pas de jeton (secret RCO_OFFREINFO_TOKEN), source ignorée.", file=sys.stderr)
    for nom, fonction in sources:
        print(f"{nom}…", file=sys.stderr)
        try:
            liste = fonction(aujourdhui)
        except SystemExit as e:
            # une source en panne ne vide pas le site : ses sessions actuelles sont gardées telles quelles
            print(f"  {nom} : {e}", file=sys.stderr)
            source = "catalogue-apprentissage" if "apprentissage" in nom else "offre-info"
            liste = [dict(s, garder=True) for s in anciens.values() if s.get("source") == source]
        print(f"  {len(liste)} sessions lues", file=sys.stderr)
        lues += liste

    # filtres : France métropolitaine et Corse (comme le reste du site), début dans 3 jours à 14 mois ;
    # doublons (même école, même ville, même spécialité, même date) : le premier lu est gardé,
    # Offre Info (avec le prix) passant avant le catalogue.
    lues.sort(key=lambda s: s["source"] != "offre-info")
    vues, retenues = set(), []
    for s in lues:
        s["debut"] = s["debut"] if isinstance(s["debut"], dt.date) else dt.date.fromisoformat(str(s["debut"]))
        if s.get("fin") and not isinstance(s["fin"], dt.date):
            s["fin"] = dt.date.fromisoformat(str(s["fin"]))
        if (s["departement"] not in DEPS or not s["ville"] or not s.get("organisme_nom")
                or not aujourdhui + dt.timedelta(days=3) <= s["debut"] <= aujourdhui + dt.timedelta(days=HORIZON)):
            continue
        cle = (sans_accents(s["organisme_nom"]), sans_accents(s["ville"]), s["diplome"], s["specialite"], s["debut"])
        if cle in vues:
            continue
        vues.add(cle)
        ancien = anciens.get(s["id"], {})
        s["releve_le"] = ancien.get("releve_le") or aujourdhui
        s["verifie_le"] = ancien.get("verifie_le") if s.get("garder") else aujourdhui
        retenues.append(s)
    retenues.sort(key=lambda s: (s["debut"], s["diplome"], s["departement"], s["id"]))

    compte = collections.Counter
    print(f"\n{len(lues)} sessions lues, {len(retenues)} retenues.")
    print(f"Par diplôme : {dict(sorted(compte(s['diplome'] for s in retenues).items()))}")
    print(f"Par source : {dict(compte(s['source'] for s in retenues))}")
    print(f"Sans spécialité reconnue : {len([s for s in retenues if not s['specialite']])}")
    print(f"Écoles : {len({s['organisme_nom'] for s in retenues})} ; départements : {len({s['departement'] for s in retenues})}")
    print(f"Ajoutées : {len({s['id'] for s in retenues} - set(anciens))} ; retirées : {len(set(anciens) - {s['id'] for s in retenues})}")
    if not args.essai:
        ecrire(chemin, retenues)
        print(f"Écrit : {chemin}")


if __name__ == "__main__":
    main()
