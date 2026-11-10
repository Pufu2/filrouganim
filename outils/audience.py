#!/usr/bin/env python3
"""Relève les chiffres publics de visibilité du site, puis écrit donnees/audience.yml.

Usage :
    python3 outils/audience.py            # relevé du jour
    python3 outils/audience.py --essai    # n'écrit rien, affiche le résumé

Trois sources, chacune facultative (une source sans secret est simplement sautée, et ses derniers
chiffres connus sont gardés) :

1. GoatCounter (visiteurs, sans cookie) : secret GOATCOUNTER_TOKEN, et le code du site dans
   `goatcounter` de config.yml.
2. Google Search Console (apparitions et clics dans Google) : secret GSC_SERVICE_ACCOUNT (la clé JSON
   d'un compte de service ajouté comme utilisateur de la propriété sc-domain:filrouganim.fr).
3. Supabase (comptes créés) : secret SUPABASE_SECRET_KEY (déjà utilisé par les alertes du lundi).

Ce qui est publié : des totaux et des tendances, et pour les dernières inscriptions seulement le rôle,
le département et le mois. Jamais de nom, d'e-mail ni de texte écrit par une personne.
Le réglage pas à pas est dans docs/CHIFFRES.md.
"""

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "donnees" / "audience.yml"
CONFIG = yaml.safe_load((RACINE / "config.yml").read_text(encoding="utf-8"))
AGENT = "FilRougAnim-chiffres/1.0 (+https://filrouganim.fr)"


def lire_json(url, entetes=None, donnees=None):
    req = urllib.request.Request(url, data=json.dumps(donnees).encode() if donnees is not None else None,
                                 headers={"User-Agent": AGENT, "Accept": "application/json",
                                          **({"Content-Type": "application/json"} if donnees is not None else {}),
                                          **(entetes or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8")), r.headers


def evolution(maintenant, avant):
    if not avant:
        return None
    return round(100 * (maintenant - avant) / avant)


def goatcounter(aujourdhui):
    code, jeton = CONFIG.get("goatcounter"), (os.environ.get("GOATCOUNTER_TOKEN") or "").strip()
    if not code or not jeton:
        print("GoatCounter : pas de code ou pas de jeton, sauté")
        return None
    def total(debut, fin):
        q = urllib.parse.urlencode({"start": debut.isoformat(), "end": fin.isoformat()})
        d, _ = lire_json(f"https://{code}.goatcounter.com/api/v0/stats/total?{q}", {"Authorization": f"Bearer {jeton}"})
        return int(d.get("total") or 0)
    fin = aujourdhui - dt.timedelta(days=1)
    v30 = total(fin - dt.timedelta(days=29), fin)
    v30_avant = total(fin - dt.timedelta(days=59), fin - dt.timedelta(days=30))
    print(f"GoatCounter : {v30} visiteurs sur 30 jours (avant : {v30_avant})")
    return {"visiteurs_30j": v30, "visiteurs_evolution": evolution(v30, v30_avant)}


def search_console(aujourdhui):
    cle = (os.environ.get("GSC_SERVICE_ACCOUNT") or "").strip()
    if not cle:
        print("Search Console : pas de clé, sauté")
        return None
    from google.oauth2 import service_account  # installé seulement pour ce relevé (voir relever.yml)
    from google.auth.transport.requests import Request
    cred = service_account.Credentials.from_service_account_info(
        json.loads(cle), scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
    cred.refresh(Request())
    site = urllib.parse.quote(CONFIG.get("search_console") or "sc-domain:filrouganim.fr", safe="")
    url = f"https://searchconsole.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query"
    entetes = {"Authorization": f"Bearer {cred.token}"}
    # les données de Search Console arrivent avec deux à trois jours de retard
    fin = aujourdhui - dt.timedelta(days=3)
    def periode(debut, fin_):
        d, _ = lire_json(url, entetes, {"startDate": debut.isoformat(), "endDate": fin_.isoformat()})
        l = (d.get("rows") or [{}])[0]
        return int(l.get("impressions") or 0), int(l.get("clicks") or 0)
    imp, clics = periode(fin - dt.timedelta(days=27), fin)
    imp_avant, clics_avant = periode(fin - dt.timedelta(days=55), fin - dt.timedelta(days=28))
    # les six derniers mois, mois par mois
    d, _ = lire_json(url, entetes, {"startDate": (fin - dt.timedelta(days=185)).isoformat(), "endDate": fin.isoformat(),
                                    "dimensions": ["date"], "rowLimit": 400})
    par_mois = {}
    for l in d.get("rows") or []:
        par_mois[l["keys"][0][:7]] = par_mois.get(l["keys"][0][:7], 0) + int(l.get("impressions") or 0)
    # le détail des 28 derniers jours : les recherches tapées dans Google et les pages du site affichées
    def detail(dimension):
        d, _ = lire_json(url, entetes, {"startDate": (fin - dt.timedelta(days=27)).isoformat(), "endDate": fin.isoformat(),
                                        "dimensions": [dimension], "rowLimit": 1000})
        return [{"cle": l["keys"][0], "impressions": int(l.get("impressions") or 0), "clics": int(l.get("clicks") or 0),
                 "place": round(float(l.get("position") or 0), 1)} for l in d.get("rows") or []]
    requetes, pages = detail("query"), detail("page")
    base = (CONFIG.get("url") or "https://filrouganim.fr").rstrip("/")
    for x in pages:
        x["cle"] = x["cle"].replace(base, "").replace("http://filrouganim.fr", "") or "/"
    premiere = lambda l: sorted((x for x in l if 0 < x["place"] <= 10), key=lambda x: (x["place"], -x["impressions"]))
    print(f"Search Console : {imp} apparitions et {clics} clics sur 28 jours, {len(requetes)} recherches, {len(pages)} pages")
    return {"impressions_28j": imp, "impressions_evolution": evolution(imp, imp_avant),
            "clics_28j": clics, "clics_evolution": evolution(clics, clics_avant),
            "impressions_par_mois": [{"mois": m, "n": n} for m, n in sorted(par_mois.items())][-7:],
            "gsc_du": (fin - dt.timedelta(days=27)).isoformat(), "gsc_au": fin.isoformat(),
            "recherches_total": len(requetes), "recherches_premiere_page": len(premiere(requetes)),
            "pages_vues_google": len(pages), "pages_premiere_page_n": len(premiere(pages)),
            # seulement des recherches et des adresses de pages : rien sur les personnes qui les tapent
            "recherches": [dict(x, recherche=x.pop("cle")) for x in premiere(requetes)[:40]],
            "pages_premiere_page": [dict(x, url=x.pop("cle")) for x in premiere(pages)[:200]],
            # toutes les pages vues dans Google (pour « Les chiffres de ta ville ») : [adresse, affichages, clics, place]
            "pages_google": [[x["cle"], x["impressions"], x["clics"], x["place"]] for x in sorted(pages, key=lambda x: -x["impressions"])]}


def supabase():
    cle = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()  # un retour à la ligne collé avec la clé ne gêne plus
    url = (CONFIG.get("supabase") or {}).get("url")
    if not cle or not url:
        print("Supabase : pas de clé, sauté")
        return None
    entetes = {"apikey": cle, "Authorization": f"Bearer {cle}", "Prefer": "count=exact", "Range": "0-0"}
    def compte(table, filtre=""):
        try:
            _, h = lire_json(f"{url}/rest/v1/{table}?select=id{filtre}", entetes)
        except urllib.error.HTTPError as e:  # une table que la clé n'a pas le droit de lire est passée, les autres comptent
            print(f"Supabase : {table} non lue ({e.code})")
            return None
        return int((h.get("Content-Range") or "*/0").split("/")[-1])
    def dernieres(table, role):
        try:
            d, _ = lire_json(f"{url}/rest/v1/{table}?select=departement,cree_le&order=cree_le.desc&limit=5",
                         {"apikey": cle, "Authorization": f"Bearer {cle}"})
        except urllib.error.HTTPError as e:
            print(f"Supabase : dernières inscriptions de {table} non lues ({e.code})")
            return []
        return [{"role": role, "departement": x.get("departement"), "mois": (x.get("cree_le") or "")[:7]} for x in d]
    r = {"animateurs": compte("profils"), "structures": compte("structures"),
         "offres": compte("offres", "&publiee=eq.true"), "candidatures": compte("candidatures")}
    r = {k: v for k, v in r.items() if v is not None}
    inscrits = sorted(dernieres("profils", "animateur") + dernieres("structures", "structure"), key=lambda x: x["mois"], reverse=True)
    r["dernieres_inscriptions"] = inscrits[:5]
    def toutes(table, role):
        try:
            d, _ = lire_json(f"{url}/rest/v1/{table}?select=departement,cree_le&limit=10000",
                             {"apikey": cle, "Authorization": f"Bearer {cle}"})
        except urllib.error.HTTPError as e:
            print(f"Supabase : {table} non lue en détail ({e.code})")
            return []
        return [(role, x.get("departement") or "", (x.get("cree_le") or "")[:7]) for x in d]
    tous = toutes("profils", "animateur") + toutes("structures", "structure")
    par_mois, par_dep = {}, {}
    for role, dep, mois in tous:
        if mois:
            par_mois.setdefault(mois, {"animateurs": 0, "structures": 0})[role + "s"] += 1
        if dep:
            par_dep.setdefault(dep, {"animateurs": 0, "structures": 0})[role + "s"] += 1
    r["inscriptions_par_mois"] = [{"mois": m, **v} for m, v in sorted(par_mois.items())][-6:]
    r["inscriptions_par_departement"] = [{"departement": d, **v} for d, v in sorted(par_dep.items(), key=lambda x: -(x[1]["animateurs"] + x[1]["structures"]))][:30]
    r["premiere_inscription"] = min((m for _, _, m in tous if m), default=None)
    print(f"Supabase : {r.get('animateurs')} animateurs, {r.get('structures')} structures, {r.get('offres')} offres")
    return r


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--essai", action="store_true", help="n'écrit rien, affiche le résumé")
    args = parser.parse_args()
    aujourdhui = dt.date.today()
    ancien = (yaml.safe_load(SORTIE.read_text(encoding="utf-8")) if SORTIE.exists() else None) or {}
    chiffres = dict(ancien.get("chiffres") or {})
    for nom, f in (("goatcounter", lambda: goatcounter(aujourdhui)), ("search_console", lambda: search_console(aujourdhui)),
                   ("supabase", supabase)):
        try:
            nouveau = f()
        except Exception as e:  # une source en panne garde ses derniers chiffres
            detail = ""
            if isinstance(e, urllib.error.HTTPError):
                try:
                    detail = " : " + " ".join(e.read().decode("utf-8", "ignore").split())[:200]
                except Exception:
                    pass
            print(f"{nom} : en panne ({e}{detail}), derniers chiffres gardés")
            continue
        if nouveau:
            chiffres.update(nouveau)
    if args.essai:
        print(json.dumps(chiffres, ensure_ascii=False, indent=1))
        return
    lignes = ["# Chiffres publics de visibilité du site (visiteurs, Google, comptes créés).",
              "# Fichier écrit chaque nuit par outils/audience.py : ne pas modifier à la main. Voir docs/CHIFFRES.md.", ""]
    SORTIE.write_text("\n".join(lignes) + yaml.safe_dump({"mis_a_jour": aujourdhui.isoformat(), "chiffres": chiffres},
                                                        allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"Écrit : {SORTIE}")


if __name__ == "__main__":
    main()
