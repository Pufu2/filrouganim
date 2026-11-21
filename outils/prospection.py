#!/usr/bin/env python3
"""Prospection : un e-mail court et personnel aux structures repérées (admin, onglet Prospection) près des animateurs
qui ont décrit le poste qu'ils cherchent (annuaire inversé). Chaque envoi est noté dans admin_prospects (statut
« contacté », étape datée), et une structure déjà contactée n'est jamais réécrite par ce lot.

Usage (GitHub Actions, à la demande ; voir .github/workflows/prospection.yml) :
    python3 outils/prospection.py --lot 1 --essai   # n'envoie rien, montre qui recevrait quoi
    python3 outils/prospection.py --lot 1           # envoie

Démarchage entre professionnels : l'expéditeur est identifié, le message concerne leur métier, et on peut refuser
la suite en répondant « stop ». Les animateurs ne sont jamais nommés : le poste et le département seulement.
"""

import argparse
import datetime as dt
import html
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
IDF = {"75": "à Paris", "77": "en Seine-et-Marne", "78": "dans les Yvelines", "91": "en Essonne", "92": "dans les Hauts-de-Seine",
       "93": "en Seine-Saint-Denis", "94": "dans le Val-de-Marne", "95": "dans le Val-d'Oise"}


def appel(url, cle, methode="GET", corps=None):
    req = urllib.request.Request(url, method=methode, data=json.dumps(corps).encode() if corps is not None else None,
                                 headers={"apikey": cle, "Authorization": f"Bearer {cle}", "Content-Type": "application/json",
                                          "Prefer": "return=minimal"})
    with urllib.request.urlopen(req, timeout=30) as r:
        t = r.read()
        return json.loads(t) if t else None


def envoyer(cle_brevo, de, nom, a, sujet, texte, corps):
    data = json.dumps({"sender": {"email": de, "name": nom}, "replyTo": {"email": de, "name": nom}, "to": [{"email": a}],
                       "subject": sujet, "textContent": texte, "htmlContent": corps}).encode()
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/email", data=data, method="POST",
                                 headers={"api-key": cle_brevo, "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def dep_de(texte):
    m = re.search(r"\((\d{2}|2A|2B)[,)]", texte or "")
    if m:
        return m.group(1)
    if re.search(r"paris", texte or "", re.I):
        return "75"
    if re.search(r"le-de-france", texte or "", re.I):
        return "idf"
    return None


def liste(mots):
    return mots[0] if len(mots) == 1 else ", ".join(mots[:-1]) + " et " + mots[-1]


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lot", default="1")
    p.add_argument("--essai", action="store_true")
    args = p.parse_args()
    config = yaml.safe_load((RACINE / "config.yml").read_text(encoding="utf-8"))
    cle = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()
    cle_brevo = (os.environ.get("BREVO_API_KEY") or "").strip()
    if not cle or not (cle_brevo or args.essai):
        sys.exit("Prospection : secrets SUPABASE_SECRET_KEY et BREVO_API_KEY absents, rien n'est envoyé.")
    base, site = config["supabase"]["url"].rstrip("/") + "/rest/v1", config["url"].rstrip("/")
    de = config.get("email") or "contact@filrouganim.fr"

    demandes = appel(f"{base}/demandes?select=poste,departement,ville,zone", cle) or []
    prospects = appel(f"{base}/admin_prospects?select=cle,nom,email,ville,statut,etapes,note&type=eq.organisateur"
                      f"&statut=eq.a_contacter&email=not.is.null", cle) or []
    # chaque lot ne touche que ses structures : le lot 1 (repérées à la main), les suivants notés « lot N » à l'import
    prospects = [x for x in prospects if ((x.get("note") or "").startswith(f"lot {args.lot} ") if args.lot != "1"
                                          else not (x.get("note") or "").startswith("lot "))]
    envoyes, ignores, vus = 0, 0, set()
    for x in prospects:
        d = dep_de(x.get("ville")) or dep_de(x.get("nom"))
        if d not in IDF and d != "idf":
            ignores += 1
            continue
        # les demandes qui concernent le secteur de la structure (toute l'Île-de-France pour un organisateur régional)
        pour = [m for m in demandes if d == "idf" or m["departement"] == d or d in (m.get("zone") or [])] or demandes
        n = len(pour)
        stag = sum(1 for m in pour if m.get("poste") == "animateur-stagiaire")
        lieux = liste(sorted({IDF.get(m["departement"], "en Île-de-France") for m in pour}))
        qui = f"{n} animateur{'s' if n > 1 else ''}" + (f", dont {stag} stagiaire{'s' if stag > 1 else ''} BAFA," if stag and stag < n else (" stagiaires BAFA" if stag == n and n > 1 else (" stagiaire BAFA" if stag else "")))
        verbe = "cherchent" if n > 1 else "cherche"
        lien = f"{site}/recruter/"
        if (x.get("nom") or "").lower().startswith("mairie"):
            # mairies (annuaire officiel) : le message va à l'accueil, on demande de le transmettre au service enfance-jeunesse
            sujet = "Animateurs BAFA disponibles pour vos accueils de loisirs"
            p0 = "Pourriez-vous transmettre ce message au service enfance-jeunesse ?"
            p1 = "Sur Fil Roug'Anim, des animateurs décrivent le poste qu'ils cherchent."
            p2 = f"En ce moment, {qui} {verbe} un poste {IDF.get(d, 'en Île-de-France')}."
            p3 = "Votre service peut créer sa page gratuitement : les demandes du secteur arrivent alors directement chez vous."
            texte = (f"Bonjour,\n\n{p0}\n\n{p1} {p2}\n\n{p3}\n\n{lien}\n\n"
                     f"Bonne journée,\nL'équipe Fil Roug'Anim\n{site}\n\nVous ne souhaitez plus recevoir nos messages ? Répondez « stop ».\n")
            corps = (f"<p>Bonjour,</p><p>{html.escape(p0)}</p><p>{html.escape(p1)} {html.escape(p2)}</p><p>{html.escape(p3)}</p>"
                     f'<p><a href="{lien}">Créer la page de votre service</a></p>'
                     f"<p>Bonne journée,<br>L'équipe Fil Roug'Anim<br><a href=\"{site}\">filrouganim.fr</a></p>"
                     f'<p style="font-size:12px;color:#6b6f76">Vous ne souhaitez plus recevoir nos messages ? Répondez « stop ».</p>')
        else:
            sujet = f"{n} animateur{'s' if n > 1 else ''} {verbe} un poste près de chez vous"
            p1 = ("Sur Fil Roug'Anim, des animateurs décrivent le poste qu'ils cherchent, et leur demande part chez les structures "
                  "les plus proches.")
            p2 = (f"En ce moment, {qui} {verbe} un poste {lieux}. {'Ils n’ont' if n > 1 else 'Il n’a'} encore reçu aucune réponse : "
                  "aucune structure de votre secteur n'est inscrite.")
            p3 = "Votre page et une offre sont gratuites. Une fois votre structure vérifiée, les demandes de votre secteur arrivent directement chez vous."
            texte = (f"Bonjour,\n\n{p1} {p2}\n\n{p3}\n\nCréer la page de votre structure (2 minutes) : {lien}\n\n"
                     f"Bonne journée,\nL'équipe Fil Roug'Anim\n{site}\n\nVous ne souhaitez plus recevoir nos messages ? Répondez « stop ».\n")
            corps = (f"<p>Bonjour,</p><p>{html.escape(p1)} {html.escape(p2)}</p><p>{html.escape(p3)}</p>"
                     f'<p><a href="{lien}">Créer la page de votre structure</a> (2 minutes)</p>'
                     f"<p>Bonne journée,<br>L'équipe Fil Roug'Anim<br><a href=\"{site}\">filrouganim.fr</a></p>"
                     f'<p style="font-size:12px;color:#6b6f76">Vous ne souhaitez plus recevoir nos messages ? Répondez « stop ».</p>')
        if args.essai:
            if (sujet, texte) not in vus:
                vus.add((sujet, texte))
                print(f"\n----- modèle (ex. {x['cle']}) -----\nObjet : {sujet}\n\n{texte}-----")
            print(f"(essai) {x['cle']} <{x['email']}> [{d}] : {p2}")
            envoyes += 1
            continue
        try:
            envoyer(cle_brevo, de, config["nom"], x["email"], sujet, texte, corps)
        except urllib.error.HTTPError as e:
            print(f"Prospection : envoi refusé pour {x['cle']} ({e.code}) {e.read().decode(errors='ignore')[:200]}", file=sys.stderr)
            continue
        except Exception as e:
            print(f"Prospection : envoi échoué pour {x['cle']} ({e})", file=sys.stderr)
            continue
        etapes = (x.get("etapes") or []) + [{"n": len(x.get("etapes") or []) + 1, "date": dt.datetime.now(dt.timezone.utc).isoformat(), "lot": args.lot}]
        appel(f"{base}/admin_prospects?cle=eq.{urllib.parse.quote(x['cle'])}", cle, "PATCH",
              {"statut": "contacte", "etapes": etapes, "maj": dt.datetime.now(dt.timezone.utc).isoformat()})
        envoyes += 1
    print(f"Prospection lot {args.lot} : {envoyes} e-mails {'à envoyer (essai, rien n’est parti)' if args.essai else 'envoyés'}, {ignores} structures hors secteur laissées de côté.")


if __name__ == "__main__":
    main()
