#!/usr/bin/env python3
"""Vérifie auprès de Google si les pages du site sont indexées (API d'inspection d'URL de la Search Console),
puis écrit le résultat dans la table admin_indexation, que seule l'administration peut lire.

Usage :
    python3 outils/indexation.py              # ~300 pages par passage
    python3 outils/indexation.py --nombre 50

Secrets : GSC_SERVICE_ACCOUNT (le même que pour les chiffres) et SUPABASE_SECRET_KEY.
Google autorise 2 000 inspections par jour : à 4 passages par jour, tout le plan du site est vu en quelques jours.
Ordre : les pages jamais vérifiées, puis celles qui ne sont pas encore indexées (revues après 3 jours),
puis les indexées (revues après 21 jours).
"""

import argparse
import concurrent.futures
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
CONFIG = yaml.safe_load((RACINE / "config.yml").read_text(encoding="utf-8"))
AGENT = "FilRougAnim-indexation/1.0 (+https://filrouganim.fr)"
SITE = "https://filrouganim.fr"


def appel(url, methode="GET", entetes=None, donnees=None):
    req = urllib.request.Request(url, method=methode, data=json.dumps(donnees).encode() if donnees is not None else None,
                                 headers={"User-Agent": AGENT, "Accept": "application/json",
                                          **({"Content-Type": "application/json"} if donnees is not None else {}), **(entetes or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        corps = r.read().decode("utf-8")
        return json.loads(corps) if corps.strip() else None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--nombre", type=int, default=300)
    args = p.parse_args()
    cle_gsc = (os.environ.get("GSC_SERVICE_ACCOUNT") or "").strip()
    cle_sb = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()
    base = (CONFIG.get("supabase") or {}).get("url")
    if not cle_gsc or not cle_sb or not base:
        print("Indexation : clé Search Console ou Supabase absente, sauté")
        return
    sb = {"apikey": cle_sb, "Authorization": f"Bearer {cle_sb}"}

    plan = urllib.request.urlopen(urllib.request.Request(SITE + "/sitemap.xml", headers={"User-Agent": AGENT}), timeout=60).read().decode("utf-8")
    urls = re.findall(r"<loc>([^<]+)</loc>", plan)
    connus = {}
    debut = 0
    while True:  # la base renvoie 1 000 lignes au plus par appel
        lot = appel(f"{base}/rest/v1/admin_indexation?select=url,couverture,verifie_le,lien&order=url&offset={debut}&limit=1000", entetes=sb) or []
        connus.update({x["url"]: x for x in lot})
        if len(lot) < 1000:
            break
        debut += 1000
    maintenant = dt.datetime.now(dt.timezone.utc)

    def priorite(u):
        x = connus.get(u)
        if not x or not x.get("verifie_le"):
            return (0, 0)
        age = (maintenant - dt.datetime.fromisoformat(x["verifie_le"].replace("Z", "+00:00"))).days
        indexee = (x.get("couverture") or "").lower().startswith(("submitted and indexed", "indexed", "envoyée et indexée", "indexée"))
        if not x.get("lien"):
            return (2, -age)  # pas encore de lien direct vers la page d'inspection de la Search Console
        if indexee:
            return (3, -age) if age >= 21 else (9, 0)
        return (1, -age) if age >= 3 else (9, 0)

    a_voir = sorted((u for u in urls if priorite(u)[0] < 9), key=priorite)[:args.nombre]
    print(f"Plan du site : {len(urls)} pages, {len(connus)} déjà vues, {len(a_voir)} à vérifier maintenant")
    if not a_voir:
        return

    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    cred = service_account.Credentials.from_service_account_info(
        json.loads(cle_gsc), scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
    cred.refresh(Request())
    propriete = CONFIG.get("search_console") or "sc-domain:filrouganim.fr"

    def inspecter(u):
        try:
            r = appel("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", "POST",
                      {"Authorization": f"Bearer {cred.token}"}, {"inspectionUrl": u, "siteUrl": propriete, "languageCode": "fr-FR"})
            res = (r or {}).get("inspectionResult", {})
            i = res.get("indexStatusResult", {})
            # inspectionResultLink : le lien direct vers la page d'inspection de cette adresse dans la Search Console
            return {"url": u, "etat": i.get("verdict"), "couverture": i.get("coverageState"),
                    "dernier_passage": i.get("lastCrawlTime"), "verifie_le": maintenant.isoformat(),
                    "lien": res.get("inspectionResultLink")}
        except urllib.error.HTTPError as e:
            print(f"  {u} : erreur {e.code} {e.read()[:200]!r}")
            return {"erreur": e.code}
        except Exception as e:
            print(f"  {u} : {e}")
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        resultats = list(ex.map(inspecter, a_voir))
    if any(r and r.get("erreur") == 429 for r in resultats):
        print("Quota de Google atteint pour aujourd'hui : la suite au prochain passage")
    lignes = [r for r in resultats if r and "url" in r]
    for i in range(0, len(lignes), 200):
        appel(f"{base}/rest/v1/admin_indexation?on_conflict=url", "POST",
              {**sb, "Prefer": "resolution=merge-duplicates,return=minimal"}, lignes[i:i + 200])
    etats = {}
    for r in lignes:
        etats[r["couverture"] or "?"] = etats.get(r["couverture"] or "?", 0) + 1
    print(f"{len(lignes)} pages vérifiées : " + ", ".join(f"{k} {v}" for k, v in sorted(etats.items(), key=lambda x: -x[1])))
    if not lignes and resultats:
        sys.exit(1)


if __name__ == "__main__":
    main()
