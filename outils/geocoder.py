#!/usr/bin/env python3
"""Place sur la carte chaque ville des sessions : écrit donnees/geo-communes.yml (« dép|ville » → latitude, longitude).

Usage : python3 outils/geocoder.py   (lancé après les relevés, voir .github/workflows/relever.yml)

Source : API Géo de l'État (geo.api.gouv.fr, découpage administratif, Licence Ouverte). Seules les villes nouvelles
sont cherchées ; une ville introuvable reçoit le centre de son département, pour rester sur la carte.
"""

import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
AGENT = "Mozilla/5.0 (compatible; FilRougAnim-verif; +https://filrouganim.fr)"
API = "https://geo.api.gouv.fr"
ARRONDISSEMENTS = {"paris": ("751", 20), "lyon": ("6938", 9), "marseille": ("132", 16)}


def cle(dep, ville):
    return f"{dep}|{ville}"


class Panne(Exception):
    """L'API ne répond pas : on ne place pas la ville (elle sera cherchée au prochain passage)."""


def lire(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": AGENT}), timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(1 + 2 * i)
        except Exception:
            time.sleep(1 + 2 * i)
    raise Panne(url)


def sans_accents(t):
    return unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()


def chercher(dep, ville):
    m = re.match(r"(?i)(paris|lyon|marseille) (\d{1,2})(?:er|e)$", ville)
    if m:
        prefixe, maxi = ARRONDISSEMENTS[m.group(1).lower()]
        n = int(m.group(2))
        if n <= maxi:
            code = f"{prefixe}{n:02d}" if prefixe != "6938" else f"6938{n}"
            r = lire(f"{API}/communes/{code}?type=arrondissement-municipal&fields=centre")
            if r and r.get("centre"):
                return r["centre"]["coordinates"]
    nom = re.sub(r"(?i)\s+(cedex.*|\d+(er|e)?)$", "", ville).strip()
    r = lire(f"{API}/communes?" + urllib.parse.urlencode(
        {"nom": nom, "codeDepartement": dep, "fields": "centre,nom", "boost": "population", "limit": 5}))
    if r:
        exact = [c for c in r if sans_accents(c["nom"]) == sans_accents(nom)]
        c = (exact or r)[0]
        if c.get("centre"):
            return c["centre"]["coordinates"]
    return None


def main():
    chemin = RACINE / "donnees" / "geo-communes.yml"
    connues = (yaml.safe_load(chemin.read_text(encoding="utf-8")) or {}).get("communes", {}) if chemin.exists() else {}
    sessions = []
    for f in ("sessions", "sessions-pro", "ecoles-pro"):
        p = RACINE / "donnees" / f"{f}.yml"
        if p.exists():
            d = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
            sessions += d.get("sessions") or d.get("ecoles") or []
    sys.path.insert(0, str(RACINE))
    from build import ville_propre  # la même écriture des villes que sur le site
    a_chercher = sorted({(s["departement"], ville_propre(s["ville"])) for s in sessions} - {tuple(k.split("|", 1)) for k in connues})
    print(f"{len(connues)} villes déjà placées, {len(a_chercher)} à chercher")
    centres = {}
    pannes = 0
    for dep, ville in a_chercher:
        if not ville.strip():
            continue
        try:
            lonlat = chercher(dep, ville)
        except Panne:
            pannes += 1
            if pannes > 20:
                print("API Géo injoignable : arrêt, la suite au prochain passage", file=sys.stderr)
                break
            continue
        if not lonlat:
            if dep not in centres:
                try:
                    r = lire(f"{API}/departements/{dep}/communes?fields=centre,population")
                except Panne:
                    continue
                pts = [c for c in (r or []) if c.get("centre")]
                centres[dep] = (max(pts, key=lambda c: c.get("population") or 0)["centre"]["coordinates"] if pts else None)
            lonlat = centres[dep]
            print(f"  introuvable : {ville} ({dep}), placée au chef-lieu du département", file=sys.stderr)
        if lonlat:
            connues[cle(dep, ville)] = [round(lonlat[1], 4), round(lonlat[0], 4)]
        time.sleep(0.05)
    lignes = ["# Position des villes des sessions (latitude, longitude) : API Géo de l'État (geo.api.gouv.fr).",
              "# Fichier écrit par outils/geocoder.py.", "", "communes:"]
    for k in sorted(connues):
        lignes.append(f"  {json.dumps(k, ensure_ascii=False)}: [{connues[k][0]}, {connues[k][1]}]")
    chemin.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print(f"Écrit : {chemin} ({len(connues)} villes)")


if __name__ == "__main__":
    main()
