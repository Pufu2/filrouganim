#!/usr/bin/env python3
"""Récupère le logo de chaque organisme de donnees/organismes.yml sur son propre site et le range dans statique/logos/<id>.<ext>.

Usage : python3 outils/logos.py [id …]     (sans id : tous les organismes qui n'ont pas encore de logo)

Le logo sert seulement à reconnaître l'organisme sur la page « Les organismes » (avec son nom et un lien vers son
site). Ordre de recherche sur la page d'accueil : une image dont le nom, la classe ou le texte de remplacement
contient « logo », puis l'icône « apple-touch-icon », puis l'image de partage (og:image). robots.txt est respecté.
"""

import re
import sys
import urllib.parse
import urllib.request
import urllib.robotparser
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
DOSSIER = RACINE / "statique" / "logos"
AGENT = "Mozilla/5.0 (compatible; FilRougAnim-verif; +https://filrouganim.fr)"
TYPES = {"image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/x-icon": "ico",
         "image/vnd.microsoft.icon": "ico", "image/gif": "gif"}


def lire(url):
    req = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read(), r.headers.get_content_type()


def autorise(url):
    rp = urllib.robotparser.RobotFileParser(urllib.parse.urljoin(url, "/robots.txt"))
    try:
        rp.read()
    except Exception:
        return True
    return rp.can_fetch(AGENT, url)


def candidats(page, base):
    trouves = []
    for balise in re.findall(r"<img\b[^>]*>", page, re.I):
        attr = dict((k.lower(), v) for k, v in re.findall(r'(\w[\w-]*)\s*=\s*"([^"]*)"', balise))
        src = attr.get("src") or attr.get("data-src") or ""
        if src and re.search(r"logo", src + " " + attr.get("class", "") + " " + attr.get("alt", "") + " " + attr.get("id", ""), re.I):
            trouves.append(src)
    for rel in ("apple-touch-icon", "icon"):
        for balise in re.findall(r"<link\b[^>]*>", page, re.I):
            if re.search(rf'rel="[^"]*{rel}[^"]*"', balise, re.I):
                m = re.search(r'href="([^"]+)"', balise)
                if m:
                    trouves.append(m.group(1))
    m = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', page, re.I)
    if m:
        trouves.append(m.group(1))
    return [urllib.parse.urljoin(base, html_unescape(t)) for t in trouves]


def html_unescape(t):
    import html
    return html.unescape(t)


def main():
    organismes = yaml.safe_load((RACINE / "donnees" / "organismes.yml").read_text(encoding="utf-8"))["organismes"]
    voulus = set(sys.argv[1:])
    DOSSIER.mkdir(parents=True, exist_ok=True)
    for o in organismes:
        if voulus and o["id"] not in voulus:
            continue
        if not voulus and list(DOSSIER.glob(o["id"] + ".*")):
            continue
        accueil = re.match(r"https?://[^/]+", o["site"]).group(0) + "/"
        for page_url in (o["site"], accueil):
            if not autorise(page_url):
                continue
            try:
                page, _ = lire(page_url)
            except Exception as e:
                print(f"{o['id']} : {page_url} illisible ({e})")
                continue
            for url in candidats(page.decode("utf-8", errors="ignore"), page_url):
                try:
                    donnees, type_ = lire(url)
                except Exception:
                    continue
                ext = TYPES.get(type_) or (url.rsplit(".", 1)[-1].split("?")[0].lower() if "." in url.rsplit("/", 1)[-1] else None)
                if ext not in ("svg", "png", "jpg", "jpeg", "webp", "gif") or len(donnees) < 300:
                    continue
                for vieux in DOSSIER.glob(o["id"] + ".*"):
                    vieux.unlink()
                (DOSSIER / f"{o['id']}.{ext}").write_bytes(donnees)
                print(f"{o['id']} : {url} ({len(donnees)} octets)")
                break
            else:
                continue
            break
        else:
            print(f"{o['id']} : aucun logo trouvé")


if __name__ == "__main__":
    main()
