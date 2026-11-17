#!/usr/bin/env python3
"""Fabrique statique/carte-departements.json : le tracé de chaque département de métropole, prêt pour un <svg>.

Usage : python3 outils/carte_departements.py departements-version-simplifiee.geojson
(fichier « france-geojson » de Grégoire David, sous licence ouverte, d'après les contours de l'IGN).
Projection simple (longitude resserrée par le cosinus de la latitude moyenne), coordonnées arrondies au pixel :
la carte sert à choisir des zones, pas à mesurer des distances.
"""
import json
import math
import sys
from pathlib import Path

LARGEUR = 1000
SORTIE = Path(__file__).resolve().parent.parent / "statique" / "carte-departements.json"


def main():
    geo = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    k = math.cos(math.radians(46.5))
    polys = {}
    for f in geo["features"]:
        code = f["properties"]["code"]
        g = f["geometry"]
        anneaux = [p[0] for p in g["coordinates"]] if g["type"] == "MultiPolygon" else [g["coordinates"][0]]
        polys[code] = (f["properties"]["nom"], anneaux)
    xs = [x * k for _, a in polys.values() for r in a for x, _ in r]
    ys = [-y for _, a in polys.values() for r in a for _, y in r]
    x0, y0, echelle = min(xs), min(ys), LARGEUR / (max(xs) - min(xs))
    hauteur = round((max(ys) - y0) * echelle)
    sortie = {"largeur": LARGEUR, "hauteur": hauteur, "departements": {}}
    for code, (nom, anneaux) in sorted(polys.items()):
        d = []
        for r in anneaux:
            pts, avant = [], None
            for x, y in r:
                p = (round((x * k - x0) * echelle), round((-y - y0) * echelle))
                if p != avant:
                    pts.append(p)
                    avant = p
            if len(pts) >= 3:
                d.append("M" + "L".join(f"{a},{b}" for a, b in pts) + "Z")
        sortie["departements"][code] = {"nom": nom, "d": "".join(d)}
    SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(sortie['departements'])} départements, {SORTIE.stat().st_size // 1024} Ko -> {SORTIE}")


if __name__ == "__main__":
    main()
