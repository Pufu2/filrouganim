#!/usr/bin/env python3
"""Prospection automatique, chaque matin : pour chaque nouvel animateur (fiche publiée ou demande de l'annuaire inversé)
dans un département où aucune structure vérifiée n'est inscrite, les mairies les plus proches (annuaire officiel
service-public.fr) reçoivent le message de prospection. Elles sont notées dans admin_prospects (« lot auto-AAAA-MM-JJ »),
et une mairie déjà présente dans la liste n'est jamais réécrite. Les structures ajoutées à la main avec une note
« lot auto-AAAA-MM-JJ · … » (accueils de loisirs trouvés par recherche web autour des nouveaux animateurs) partent aussi. Les lots automatiques sont relancés une seule fois,
7 jours après le premier message, s'ils n'ont pas répondu (statut resté « contacte »).

Usage (GitHub Actions ; voir .github/workflows/prospection-auto.yml) :
    python3 outils/prospection_auto.py --essai   # n'écrit ni n'envoie rien aux mairies, montre qui recevrait quoi
    python3 outils/prospection_auto.py           # importe et envoie

Garde-fous : 30 mairies au plus par animateur, à 15 km au plus de sa commune (dans son département ou sa zone),
100 e-mails au plus par jour. Les animateurs ne sont jamais nommés. L'e-mail type part à COPIE_EMAIL.
"""

import argparse
import datetime as dt
import json
import math
import os
import re
import sys
import tarfile
import tempfile
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prospection as P  # noqa: E402

SOURCE = "https://lecomarquage.service-public.gouv.fr/donnees_locales_v4/all_latest.tar.bz2"
DEBUT = dt.datetime(2026, 11, 21, tzinfo=dt.timezone.utc)  # les animateurs inscrits avant sont traités à la main
FENETRE = dt.timedelta(days=3)  # rattrape un matin manqué ; les mairies déjà écrites ne le sont jamais deux fois
RAYON_KM, PAR_ANIMATEUR, PAR_JOUR = 15, 30, 100


def simple(t):
    t = unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\bcedex\b.*", "", t)
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def liste_py(v):
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return []
    return v or []


def mairies():
    """Toutes les mairies de l'annuaire officiel qui ont une adresse e-mail et des coordonnées."""
    with tempfile.TemporaryDirectory() as tmp:
        arch = Path(tmp) / "all.tar.bz2"
        req = urllib.request.Request(SOURCE, headers={"User-Agent": "filrouganim-prospection"})
        with urllib.request.urlopen(req, timeout=600) as r, open(arch, "wb") as f:
            while bloc := r.read(1 << 20):
                f.write(bloc)
        with tarfile.open(arch, "r:bz2") as t:
            membre = next(m for m in t.getmembers() if m.name.endswith("data.gouv_local.json") and m.isfile())
            services = json.load(t.extractfile(membre))["service"]
    res = []
    for s in services:
        pivot = liste_py(s.get("pivot"))
        if not any(isinstance(p, dict) and p.get("type_service_local") == "mairie" for p in pivot):
            continue
        courriels = [c for c in liste_py(s.get("adresse_courriel")) if "@" in (c or "")]
        adr = next((a for a in liste_py(s.get("adresse")) if a.get("latitude") and a.get("longitude")), None)
        insee = s.get("code_insee_commune") or ""
        if not courriels or not adr or not insee:
            continue
        dep = insee[:3] if insee.startswith("97") else insee[:2]
        site = next((x.get("valeur") for x in liste_py(s.get("site_internet")) if x.get("valeur")), "")
        try:
            pos = (float(adr["latitude"]), float(adr["longitude"]))
        except ValueError:
            continue
        # la commune vient du nom du service (« Mairie - Eckbolsheim ») : l'adresse peut être celle d'un bureau distributeur
        commune = re.sub(r"^mairie( d[ée]l[ée]gu[ée]e)?\s*-\s*", "", s.get("nom") or "", flags=re.I).strip() \
            or re.sub(r"\s+cedex.*$", "", adr.get("nom_commune") or "", flags=re.I).strip()
        res.append({"insee": insee, "dep": dep, "commune": commune, "cle_commune": simple(commune), "cle_postale": simple(adr.get("nom_commune")), "email": courriels[0].strip(),
                    "pos": pos, "site": site, "nom": s.get("nom") or f"Mairie - {commune}",
                    "cle": "orga:" + simple(s.get("nom") or f"Mairie - {commune}")})
    return res


def situer(a, toutes):
    """Position de l'animateur : sa commune (code INSEE, sinon nom), à défaut le centre des mairies de son département."""
    dep = a.get("departement")
    du_dep = [m for m in toutes if m["dep"] == dep]
    m = next((m for m in du_dep if a.get("code_commune") and m["insee"] == a["code_commune"]), None) \
        or next((m for m in du_dep if a.get("ville") and m["cle_commune"] == simple(a["ville"])), None) \
        or next((m for m in du_dep if a.get("ville") and m["cle_postale"] == simple(a["ville"])), None)
    if m:
        return m["pos"], a.get("ville") or m["commune"], True
    if not du_dep:
        return None, None, False
    return (sum(m["pos"][0] for m in du_dep) / len(du_dep), sum(m["pos"][1] for m in du_dep) / len(du_dep)), None, False


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--essai", action="store_true")
    args = p.parse_args()
    import yaml
    config = yaml.safe_load((P.RACINE / "config.yml").read_text(encoding="utf-8"))
    cle = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()
    cle_brevo = (os.environ.get("BREVO_API_KEY") or "").strip()
    copie = (os.environ.get("COPIE_EMAIL") or "").strip()
    if not cle or not (cle_brevo or args.essai):
        sys.exit("Prospection auto : secrets SUPABASE_SECRET_KEY et BREVO_API_KEY absents, rien n'est fait.")
    base = config["supabase"]["url"].rstrip("/") + "/rest/v1"
    maintenant = dt.datetime.now(dt.timezone.utc)
    lot = "auto-" + maintenant.strftime("%Y-%m-%d")
    depuis = max(DEBUT, maintenant - FENETRE)

    tous = P.animateurs(base, cle)
    nouveaux = [a for a in tous if a.get("cree_le") and dt.datetime.fromisoformat(a["cree_le"]) >= depuis and a.get("departement") in P.LIEU]
    verifiees = {s["departement"] for s in (P.appel(f"{base}/structures?select=departement&verifiee=is.true", cle) or [])}
    a_traiter = [a for a in nouveaux if a["departement"] not in verifiees]
    print(f"Prospection auto : {len(nouveaux)} nouvel(s) animateur(s) depuis le {depuis:%d/%m}, "
          f"{len(a_traiter)} dans un département sans structure vérifiée.")

    recap, choisies = [], []
    if a_traiter:
        connues = P.appel(f"{base}/admin_prospects?select=cle,email", cle) or []
        cles = {c["cle"] for c in connues}
        emails = {(c.get("email") or "").lower() for c in connues}
        toutes = mairies()
        print(f"Annuaire officiel : {len(toutes)} mairies avec une adresse e-mail.")
        for a in a_traiter:
            pos, ville, precis = situer(a, toutes)
            deps = {a["departement"], *(a.get("zone") or [])}
            ligne = f"{'stagiaire BAFA' if a['poste'] == 'animateur-stagiaire' else 'animateur'}, {a['departement']}" + (f" ({ville})" if ville else "")
            if not pos:
                recap.append((ligne, [], "commune introuvable dans l'annuaire"))
                continue
            proches = sorted(((km(pos, m["pos"]), m) for m in toutes if m["dep"] in deps), key=lambda x: x[0])
            if precis:
                proches = [x for x in proches if x[0] <= RAYON_KM]
            pour_lui = []
            for _, m in proches[:PAR_ANIMATEUR]:
                if m["cle"] in cles or m["email"].lower() in emails or len(choisies) >= PAR_JOUR:
                    continue
                cles.add(m["cle"])
                emails.add(m["email"].lower())
                pour_lui.append(m)
                choisies.append(m)
            recap.append((ligne, pour_lui, "" if precis else "pas de commune : mairies les plus centrales du département"))

    lignes = [{"cle": m["cle"], "type": "organisateur", "nom": m["nom"], "email": m["email"],
               "ville": f"{m['commune']} ({m['dep']}) · accueils de loisirs et périscolaire", "statut": "a_contacter", "etapes": [],
               "note": f"lot {lot} · annuaire officiel service-public.fr" + (f" · {m['site']}" if m["site"] else "")} for m in choisies]
    # en attente : les structures ajoutées à la main dans un lot automatique (accueils de loisirs, centres sociaux, MJC,
    # associations trouvés par recherche web autour des nouveaux animateurs), pas encore écrites
    attente = [x for x in (P.appel(f"{base}/admin_prospects?select=cle,nom,email,ville,statut,etapes,note&type=eq.organisateur"
                                   f"&statut=eq.a_contacter&email=not.is.null", cle) or [])
               if (x.get("note") or "").startswith("lot auto-")]
    if args.essai:
        envoyes = P.traiter("auto", essai=True, prospects=lignes + attente) if (lignes or attente) else 0
    else:
        if lignes:
            req = urllib.request.Request(f"{base}/admin_prospects?on_conflict=cle", method="POST", data=json.dumps(lignes).encode(),
                                         headers={"apikey": cle, "Authorization": f"Bearer {cle}", "Content-Type": "application/json",
                                                  "Prefer": "return=minimal,resolution=ignore-duplicates"})
            urllib.request.urlopen(req, timeout=60).read()
        envoyes = P.traiter("auto") if (lignes or attente) else 0
    if attente:
        print(f"  {len(attente)} structure(s) ajoutée(s) à la main dans un lot automatique, envoyée(s) avec ce lancement.")
    relances = P.traiter("auto", essai=args.essai, relance=True, delai=7)

    for ligne, ms, rem in recap:
        print(f"  {ligne} : {len(ms)} mairie(s)" + (f" — {rem}" if rem else ""))
    print(f"Prospection auto : {envoyes} premier(s) message(s), {relances} relance(s){' (essai)' if args.essai else ''}.")


if __name__ == "__main__":
    main()
