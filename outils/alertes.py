#!/usr/bin/env python3
"""Alertes du lundi : envoie à chaque candidat qui l'a demandé les nouvelles offres de son secteur.

Usage (GitHub Actions, chaque lundi ; voir .github/workflows/alertes.yml) :
    python3 outils/alertes.py            # envoie les e-mails
    python3 outils/alertes.py --essai    # n'envoie rien, affiche qui recevrait quoi

Il faut deux secrets, ajoutés par Pufu2 dans GitHub (Settings > Secrets and variables > Actions) :
    SUPABASE_SECRET_KEY  la clé secrète du projet Supabase (lecture des adresses des candidats)
    BREVO_API_KEY        une clé d'API Brevo (envoi des e-mails)
Sans eux, l'outil ne fait rien. Les adresses ne sont jamais écrites ailleurs que dans l'e-mail envoyé.
"""

import argparse
import datetime as dt
import html
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
CONTRATS = {"cee": "contrat d'engagement éducatif", "cdd": "CDD", "cdi": "CDI", "stage-pratique": "stage pratique BAFA",
            "apprentissage": "apprentissage", "benevole": "bénévolat"}


def lire(url, cle):
    req = urllib.request.Request(url, headers={"apikey": cle, "Authorization": f"Bearer {cle}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def envoyer(cle_brevo, expediteur, nom_site, a, sujet, texte, html_contenu):
    corps = json.dumps({"sender": {"email": expediteur, "name": nom_site}, "to": [{"email": a}], "subject": sujet,
                        "textContent": texte, "htmlContent": html_contenu}).encode()
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/email", data=corps, method="POST",
                                 headers={"api-key": cle_brevo, "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--essai", action="store_true", help="n'envoie rien")
    args = parser.parse_args()
    config = yaml.safe_load((RACINE / "config.yml").read_text(encoding="utf-8"))
    sb = config.get("supabase") or {}
    cle = os.environ.get("SUPABASE_SECRET_KEY")
    cle_brevo = os.environ.get("BREVO_API_KEY")
    if not (sb.get("url") and cle and (cle_brevo or args.essai)):
        print("Alertes : secrets SUPABASE_SECRET_KEY et BREVO_API_KEY absents, rien n'est envoyé.")
        return
    base, site = sb["url"].rstrip("/") + "/rest/v1", config["url"].rstrip("/")
    depuis = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    aujourdhui = dt.date.today().isoformat()
    # la clé secrète passe outre les règles d'accès : on refait ici les mêmes filtres que pour le public
    offres = lire(f"{base}/offres?select=id,intitule,ville,departement,debut,contrat,type_accueil,structures!inner(nom,verifiee)"
                  f"&publiee=is.true&expire_le=gte.{aujourdhui}&cree_le=gte.{urllib.parse.quote(depuis)}"
                  f"&structures.verifiee=is.true&order=debut", cle)
    if not offres:
        print("Alertes : aucune nouvelle offre cette semaine.")
        return
    profils = lire(f"{base}/profils?select=prenom,email_contact,departement,mobilite,jeton_alertes&alertes=is.true", cle)
    envoyes = 0
    for p in profils:
        deps = {p["departement"], *[m for m in p["mobilite"] if m != "france"]}
        pour = [o for o in offres if o["departement"] in deps
                or ("france" in p["mobilite"] and o.get("type_accueil") in ("sejour-vacances", "mini-camp"))]
        if not pour:
            continue
        lignes, items = [], []
        for o in pour[:15]:
            lien = f"{site}/compte/?postuler={o['id']}"
            debut = dt.date.fromisoformat(o["debut"]).strftime("%d/%m/%Y")
            quoi = f"{o['intitule']} - {o['structures']['nom']}, {o['ville']} ({o['departement']}), à partir du {debut}, {CONTRATS.get(o['contrat'], o['contrat'])}"
            lignes.append(f"- {quoi}\n  {lien}")
            items.append(f'<li><a href="{html.escape(lien)}">{html.escape(o["intitule"])}</a><br>'
                         f'{html.escape(o["structures"]["nom"])}, {html.escape(o["ville"])} ({o["departement"]}), '
                         f'à partir du {debut}, {html.escape(CONTRATS.get(o["contrat"], o["contrat"]))}</li>')
        stop = f"{site}/alertes/desabonnement/?j={p['jeton_alertes']}"
        n = len(pour)
        sujet = f"{n} nouvelle{'s' if n > 1 else ''} offre{'s' if n > 1 else ''} d'animation près de chez toi"
        texte = (f"Bonjour {p['prenom']},\n\nCette semaine sur {config['nom']} :\n\n" + "\n".join(lignes) +
                 f"\n\nTu postules avec ton profil, en un clic.\n\nNe plus recevoir ces e-mails : {stop}\n")
        corps = (f"<p>Bonjour {html.escape(p['prenom'])},</p><p>Cette semaine sur {html.escape(config['nom'])} :</p>"
                 f"<ul>{''.join(items)}</ul><p>Tu postules avec ton profil, en un clic.</p>"
                 f'<p style="font-size:13px;color:#6e655d"><a href="{html.escape(stop)}">Ne plus recevoir ces e-mails</a></p>')
        if args.essai:
            print(f"(essai) {n} offre(s) pour un candidat du {p['departement']}")
        else:
            try:
                envoyer(cle_brevo, config["email_alertes"], config["nom"], p["email_contact"], sujet, texte, corps)
                envoyes += 1
            except Exception as e:  # une adresse refusée n'arrête pas les autres
                print(f"Alertes : un envoi a échoué ({e})", file=sys.stderr)
    print(f"Alertes : {len(offres)} nouvelles offres, {envoyes} e-mails envoyés.")


if __name__ == "__main__":
    main()
