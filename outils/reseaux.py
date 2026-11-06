#!/usr/bin/env python3
"""Les sessions BAFA et BAFD de trois grands réseaux, sur leurs propres catalogues nationaux (robots.txt respecté) :

- Familles Rurales (ma-formation-bafa.fr), qui organise aussi les sessions de la FACEL à Paris :
  liste /sessions/toutes/toutes/toutes/toutes/tous/date/<n>, 10 sessions par page (thème compris) ;
- les Francas (bafa-lesfrancas.fr) : recherche par région et par étape (20 stages au plus par recherche, découpée
  par mois au-delà), puis la fiche du stage (adresse et tarif) ;
- la FSCF (fscf.asso.fr) : calendrier des formations BAFA / BAFD, puis la fiche (lieu, formule, tarif).

Faits seulement : diplôme, étape, thème, dates, commune, département, formule, prix, lien vers la fiche.
"""

import datetime as dt
import html
import re
import unicodedata

FR = "https://www.ma-formation-bafa.fr"
FRANCAS = "https://www.bafa-lesfrancas.fr"
FSCF = "https://fscf.asso.fr"
MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"]


def sans_accents(t):
    return unicodedata.normalize("NFD", t or "").encode("ascii", "ignore").decode().lower()


def texte(fragment):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", fragment or "")).split())


def date_fr(t):
    j, m, a = t.split("/")
    return dt.date(int(a), int(m), int(j))


def dep_de_cp(cp):
    cp = cp.strip()
    if cp.startswith("20"):
        return "2A" if cp[:3] in ("200", "201") else "2B"
    return cp[:2]


def etape(titre):
    """(diplôme, étape) d'après un intitulé de session."""
    t = sans_accents(titre)
    diplome = "BAFD" if re.search(r"\bbafd\b|directeur", t) else "BAFA"
    if re.search(r"perfectionnement|perf\b|renouvellement", t):
        return "BAFD", "perfectionnement"
    if re.search(r"qualif|baignade|\bsb\b", t):
        return "BAFA", "qualification"
    if re.search(r"appro", t):
        return "BAFA", "approfondissement"
    if re.search(r"formation generale|\bfg\b|\bbase\b|generale", t):
        return diplome, "formation-generale"
    return None, None


def prix_euros(t):
    m = re.search(r"(\d[\d  ]*(?:[.,]\d{1,2})?)\s*(?:€|euros?)", t)
    if not m:
        return None
    v = float(m.group(1).replace(" ", "").replace(" ", "").replace(",", "."))
    return int(v) if v.is_integer() else v


def session(ident, organisme, diplome, type_, theme, debut, fin, ville, dep, formule, prix, url, note=None):
    return {"id": ident, "organisme": organisme, "diplome": diplome, "type": type_,
            "theme": theme if type_ in ("approfondissement", "qualification") else None,
            "debut": debut, "fin": fin, "ville": ville, "departement": dep, "formule": formule, "prix": prix,
            "prix_note": note, "aides": [], "complet": False, "url": url, "source": "page-organisme"}


# ---------------------------------------------------------------- Familles Rurales

def familles_rurales(lire_brut, commune):
    sessions, vus = [], set()
    for n in range(1, 60):
        brut = lire_brut(f"{FR}/sessions/toutes/toutes/toutes/toutes/tous/date/{n}")
        blocs = brut.split('<div class="session" data-nid="')[1:]
        nouveaux = 0
        for b in blocs:
            nid = b.split('"', 1)[0]
            if nid in vus:
                continue
            vus.add(nid)
            nouveaux += 1
            type_txt = texte((re.search(r"<h4>(.*?)</h4>", b, re.S) or [None, ""])[1])
            dates = re.search(r"(\d\d/\d\d/\d{4})\s*au\s*(\d\d/\d\d/\d{4})", b)
            adresse = texte((re.search(r'<div class="adresse">(.*?)</div>', b, re.S) or [None, ""])[1])
            m = re.match(r"(\d{5})\s+(.+)", adresse)
            entete = texte(b.split('class="dates"', 1)[0].split(">", 1)[-1])  # « BAFA Approfondissement A la Carte »
            diplome, type_ = etape(entete)
            if not (dates and m and type_):
                continue
            tarifs = {}
            for lib, val in re.findall(r'<div class="libelle">\s*(.*?)\s*</div>\s*<div class="prix">\s*(.*?)\s*</div>', b, re.S):
                p = prix_euros(texte(val))
                if p:
                    tarifs[{"Internat": "internat", "Demi-pension": "demi-pension", "Externat": "externat"}.get(texte(lib), "externat")] = p
            formule, prix = (min(tarifs.items(), key=lambda x: x[1]) if tarifs else (None, None))
            note = ("Aussi : " + ", ".join(f"{f} {v:.0f} €" for f, v in sorted(tarifs.items(), key=lambda x: x[1]) if f != formule)
                    if len(tarifs) > 1 else None)
            theme = None
            url = f"{FR}/session/{nid}"
            if type_ in ("approfondissement", "qualification"):
                theme = type_txt if not re.search(r"(?i)approfondissement|qualification", type_txt) else None
            ville = re.sub(r"(?i)\s+cedex.*$", "", m.group(2)).strip()
            sessions.append(session(f"fr-{nid}", "familles-rurales", diplome, type_, theme, date_fr(dates.group(1)),
                                    date_fr(dates.group(2)), commune(ville), dep_de_cp(m.group(1)), formule, prix, url, note))
        if not blocs or not nouveaux:
            break
    if len(sessions) < 20:
        raise SystemExit(f"Familles Rurales : seulement {len(sessions)} sessions lues")
    return sessions


# ---------------------------------------------------------------- Francas

_geo = {}
REGIONS_FRANCAS = {"aura": "auvergne-rhone-alpes", "paca": "provence-alpes-cote-d-azur",
                   "provence-alpes-cote-d-azur": "provence-alpes-cote-d-azur"}


def dep_de_ville(ville, region, territoire):
    """Le département d'une commune, avec l'API Géo de l'État (geo.api.gouv.fr), parmi ceux de la région donnée."""
    import json
    import urllib.parse
    import urllib.request
    reg = re.sub(r"[^a-z]+", "-", sans_accents(region)).strip("-")
    reg = REGIONS_FRANCAS.get(reg, reg)
    deps = {d["code"] for d in territoire["departements"]
            if next((r["slug"] for r in territoire["regions"] if r["id"] == d["region"]), "") == reg}
    cle = (sans_accents(ville), reg)
    if cle not in _geo:
        url = "https://geo.api.gouv.fr/communes?" + urllib.parse.urlencode(
            {"nom": ville, "fields": "nom,codeDepartement", "boost": "population", "limit": 10})
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "FilRougAnim-verif"}), timeout=30) as r:
                res = json.load(r)
        except Exception:
            res = []
        choix = [x for x in res if x["codeDepartement"] in deps] or ([] if deps else res)
        _geo[cle] = (choix[0]["codeDepartement"], choix[0]["nom"]) if choix else (None, None)
    return _geo[cle]


REGIONS_ID_FRANCAS = [219, 204, 205, 206, 207, 217, 211, 203, 201, 213, 216, 215]  # métropole et Corse
TYPES_FRANCAS = [4, 5, 6, 7, 8]  # FG BAFA, appro, qualification, FG BAFD, perfectionnement


def francas_pages(lire_brut):
    """La liste n'affiche que 20 stages et n'a pas de pages suivantes : on la lit région par région et étape par étape,
    puis par tranches de deux mois quand une recherche dépasse 20 stages."""
    aujourdhui = dt.date.today()
    for reg in REGIONS_ID_FRANCAS:
        for typ in TYPES_FRANCAS:
            base = f"{FRANCAS}/recherche-de-stage?type=+{typ}&regions=+{reg}&"
            brut = lire_brut(base + "search=extended&")
            total = int((re.search(r"(\d+)\s*résultats", brut) or [None, "0"])[1])
            if total <= brut.count('<div class="side-title-result">'):
                yield brut
                continue
            debut = aujourdhui.replace(day=1)
            for _ in range(8):
                fin = (debut + dt.timedelta(days=62)).replace(day=1) - dt.timedelta(days=1)
                yield lire_brut(base + f"fromDate={debut:%d/%m/%Y}&toDate={fin:%d/%m/%Y}&search=extended&")
                debut = fin + dt.timedelta(days=1)


def francas(lire_brut, commune, territoire):
    sessions, vus = [], set()
    for brut in francas_pages(lire_brut):
        cartes = brut.split('<div class="side-title-result">')[1:]
        for c in cartes:
            lien = re.search(r'href="(/stages/[^"]+-(\d+))"', c)
            if not lien or lien.group(1) in vus:
                continue
            vus.add(lien.group(1))
            h = {k: texte((re.search(fr"<{k}>(.*?)</{k}>", c, re.S) or [None, ""])[1]) for k in ("h3", "h4", "h5")}
            diplome, type_ = etape(h["h3"] + " " + h["h4"])
            dates = re.findall(r"(\d\d/\d\d/\d{4})", c.split('class="detail-geo"', 1)[0])
            if not type_ or len(dates) < 2:
                continue
            heb = sans_accents(texte((re.search(r"Hébergement :(.*?)</div>", c, re.S) or [None, ""])[1]))
            formule = "internat" if "internat" in heb else "demi-pension" if "pension" in heb else "externat" if "externat" in heb else None
            url = FRANCAS + lien.group(1)
            fiche = texte(lire_brut(url))
            adresse = fiche.split("Adresse du stage", 1)[-1][:300]
            cp = re.search(r"\b(\d{5})\s+([A-ZÀ-Ü' -]+?[A-ZÀ-Ü])(?=\s+[A-ZÀ-Ü][a-zà-ü]|\s*$)", adresse)
            geo = texte((re.search(r'class="detail-geo".*?more-detail">(.*?)</div>', c, re.S) or [None, ""])[1])
            lieu = (re.search(r"À : (.+?) Région :", geo) or [None, ""])[1]
            region = (re.search(r"Région : (.+)$", geo) or [None, ""])[1]
            m = re.search(r"([A-Za-zÀ-ÿ' -]+?)\s*\(?\s*(\d{2}|2A|2B)\s*\)?$", lieu)
            if cp:
                ville, dep = cp.group(2), dep_de_cp(cp.group(1))
            elif m:
                ville, dep = re.split(r"\s+-\s+|\(", m.group(1))[-1].strip(), m.group(2)
            else:
                ville = re.split(r"\s+-\s+", lieu)[-1].strip()
                dep, nom = dep_de_ville(ville, region, territoire)
                if not dep:
                    continue
                ville = nom
            prix = None
            t = re.search(r"Tarifs\s+(?:Internat|Externat|1/2 pension|Demi-pension)?\s*([\d.,]+)\s*€", fiche)
            if t:
                prix = prix_euros(t.group(1).replace(".00", "") + " €")
            theme = h["h5"].replace(" - ", ", ") if h["h5"] and not re.search(r"(?i)formation g[ée]n[ée]rale|perfectionnement", h["h5"]) else None
            sessions.append(session("francas-" + lien.group(1).rsplit("/", 1)[-1][-60:], "francas", diplome, type_, theme, date_fr(dates[0]),
                                    date_fr(dates[-1]), commune(re.sub(r"(?i)\s+cedex.*$", "", ville)),
                                    dep, formule, prix, url))
    if len(sessions) < 20:
        raise SystemExit(f"Francas : seulement {len(sessions)} sessions lues")
    return sessions


# ---------------------------------------------------------------- FSCF

def fscf(lire_brut, commune):
    sessions, vus = [], set()
    for n in range(1, 40):
        page = f"{FSCF}/calendrier-des-formations/" + (f"page/{n}/" if n > 1 else "") + "?titre=&type=bafa-bafd&disc_generique=&disc_bafa=&dateDeb=&dateFin=&dept="
        brut = lire_brut(page)
        cartes = brut.split('<div class="forma-item ')[1:]
        nouveaux = 0
        for c in cartes:
            lien = re.search(r'href="(https://fscf\.asso\.fr/formations/[^"]+)"', c)
            titre = texte((re.search(r'forma-item-infos-titre">(.*?)</h3>', c, re.S) or [None, ""])[1])
            if not lien or lien.group(1) in vus:
                continue
            vus.add(lien.group(1))
            nouveaux += 1
            diplome, type_ = etape(titre)
            dates = re.findall(r"(\d\d/\d\d/\d{4})", c)
            if not type_ or len(dates) < 2:
                continue
            fiche = texte(lire_brut(lien.group(1)))
            lieu = re.search(r"Lieu : (.+?) \((\d[\dAB]|\d{3})\)", fiche)
            cp = re.search(r"\b(\d{5})\s+([A-ZÀ-Üa-zà-ü' -]+)", texte((re.search(r'forma-item-infos-lieu">(.*?)</div>', c, re.S) or [None, ""])[1]))
            if lieu:
                ville, dep = lieu.group(1), lieu.group(2)
                if re.search(r"\d|,", ville):  # « 65, rue Bellecombe à Lyon » : la commune est à la fin
                    ville = re.split(r"\s+(?:à|a)\s+|,\s*", ville)[-1]
                    ville = re.sub(r"^\d{5}\s*", "", ville).strip()
            elif cp:
                ville, dep = cp.group(2), dep_de_cp(cp.group(1))
            else:
                continue
            fmt = sans_accents((re.search(r"Format : (\S+(?: \S+)?)", fiche) or [None, ""])[1])
            formule = "internat" if "internat" in fmt else "demi-pension" if "pension" in fmt else "externat" if "externat" in fmt else None
            tarifs = fiche.split("Tarifs", 1)[-1][:300] if "Tarifs" in fiche else ""
            m = re.search(r"Non licenci[ée]s?\s*:\s*([\d  ,.]+)\s*(?:€|euros?)", tarifs, re.I)
            prix = prix_euros(m.group(1) + " €") if m else prix_euros(tarifs)
            theme = None
            if type_ == "approfondissement":
                theme = re.sub(r"(?i)^.*?appro(fondissement)?\s*(bafa)?\s*[-–:]?\s*", "", titre)
                theme = re.split(r"\s+(?:à|a|-|–)\s+[A-ZÀ-Ü]|\s+du\s+\d|\s*\(\d", theme)[0].strip(" -–,") or None
                if theme and (re.match(r"(?i)(à|a|au|aux|en)\s", theme) or len(theme) < 4):
                    theme = None
            sessions.append(session("fscf-" + lien.group(1).rstrip("/").rsplit("/", 1)[-1][:60], "fscf", diplome, type_, theme,
                                    date_fr(dates[0]), date_fr(dates[1]), commune(re.sub(r"(?i)\s+cedex.*$", "", ville)),
                                    dep, formule, prix, lien.group(1),
                                    "Prix non licencié ; moins cher pour les licenciés FSCF" if m else None))
        if not cartes or not nouveaux:
            break
    if len(sessions) < 10:
        raise SystemExit(f"FSCF : seulement {len(sessions)} sessions lues")
    return sessions
