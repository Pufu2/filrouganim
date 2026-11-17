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
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
CONTRATS = {"cee": "contrat d'engagement éducatif", "cdd": "CDD", "cdi": "CDI", "stage-pratique": "stage pratique BAFA",
            "apprentissage": "apprentissage", "benevole": "bénévolat"}


def lire(url, cle):
    req = urllib.request.Request(url, headers={"apikey": cle, "Authorization": f"Bearer {cle}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Alertes : Supabase refuse la lecture ({e.code}) : {e.read().decode(errors='ignore')[:300]}")


def envoyer(cle_brevo, expediteur, nom_site, a, sujet, texte, html_contenu):
    corps = json.dumps({"sender": {"email": expediteur, "name": nom_site}, "to": [{"email": a}], "subject": sujet,
                        "textContent": texte, "htmlContent": html_contenu}).encode()
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/email", data=corps, method="POST",
                                 headers={"api-key": cle_brevo, "Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def garder_la_cle_active(cle_brevo):
    """Une lecture sans effet chaque lundi : une clé Brevo inutilisée 90 jours expire, même sans offre à envoyer."""
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/statistics/aggregatedReport?days=7",
                                 headers={"api-key": cle_brevo, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        print(f"Alertes : Brevo refuse la clé ({e.code}) : {e.read().decode(errors='ignore')[:300]}", file=sys.stderr)
    except Exception as e:
        print(f"Alertes : Brevo ne répond pas ({e})", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--essai", action="store_true", help="n'envoie rien")
    args = parser.parse_args()
    config = yaml.safe_load((RACINE / "config.yml").read_text(encoding="utf-8"))
    sb = config.get("supabase") or {}
    # .strip() : une clé collée dans GitHub garde parfois un retour à la ligne à la fin
    cle = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()
    cle_brevo = (os.environ.get("BREVO_API_KEY") or "").strip()
    if not (sb.get("url") and cle and (cle_brevo or args.essai)):
        print("Alertes : secrets SUPABASE_SECRET_KEY et BREVO_API_KEY absents, rien n'est envoyé.")
        return
    if cle_brevo:
        garder_la_cle_active(cle_brevo)
    base, site = sb["url"].rstrip("/") + "/rest/v1", config["url"].rstrip("/")
    depuis = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    aujourdhui = dt.date.today().isoformat()
    # la clé secrète passe outre les règles d'accès : on refait ici les mêmes filtres que pour le public
    offres = lire(f"{base}/offres?select=id,intitule,ville,departement,debut,contrat,type_accueil,structures!inner(nom,verifiee)"
                  f"&publiee=is.true&expire_le=gte.{aujourdhui}&cree_le=gte.{urllib.parse.quote(depuis)}"
                  f"&structures.verifiee=is.true&order=debut", cle)
    # pour les structures abonnées : les nouveaux animateurs de leur secteur (une fonction de l'abonnement)
    alertes_structures(args, config, base, site, cle, cle_brevo, depuis, aujourdhui)
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
        sujet = f"{n} nouvelle{'s' if n > 1 else ''} offre{'s' if n > 1 else ''} d'animation près de chez vous"
        texte = (f"Bonjour {p['prenom']},\n\nCette semaine sur {config['nom']} :\n\n" + "\n".join(lignes) +
                 f"\n\nVous postulez avec votre profil, en un clic.\n\nNe plus recevoir ces e-mails : {stop}\n")
        corps = (f"<p>Bonjour {html.escape(p['prenom'])},</p><p>Cette semaine sur {html.escape(config['nom'])} :</p>"
                 f"<ul>{''.join(items)}</ul><p>Vous postulez avec votre profil, en un clic.</p>"
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


POSTES = {"animateur-stagiaire": "stage pratique BAFA", "animateur": "animateur ou animatrice", "directeur": "direction",
          "directeur-adjoint": "direction adjointe", "surveillant-baignade": "surveillance de baignade", "coordinateur": "coordination"}


def alertes_structures(args, config, base, site, cle, cle_brevo, depuis, aujourdhui):
    """Chaque lundi, aux structures abonnées : les animateurs qui ont publié leur profil dans leur secteur cette semaine."""
    structures = lire(f"{base}/structures?select=nom,departement,email_contact&verifiee=is.true&abonnement_fin=gte.{aujourdhui}&email_contact=not.is.null", cle)
    if not structures:
        print("Alertes structures : aucune structure abonnée.")
        return
    profils = lire(f"{base}/profils?select=prenom,departement,mobilite,diplomes,poste_recherche,ville&publie=is.true"
                   f"&cree_le=gte.{urllib.parse.quote(depuis)}", cle)
    envoyes = 0
    for st in structures:
        pour = [p for p in profils if p.get("departement") == st["departement"] or st["departement"] in (p.get("mobilite") or [])]
        if not pour:
            continue
        lien = f"{site}/compte/?role=structure"
        lignes = [f"- {p['prenom']}, {POSTES.get(p.get('poste_recherche'), p.get('poste_recherche') or 'animation')}"
                  f"{', ' + p['ville'] if p.get('ville') else ''} ({p['departement']}){' · ' + ', '.join(p['diplomes'][:3]) if p.get('diplomes') else ''}" for p in pour[:20]]
        n = len(pour)
        sujet = f"{n} nouve{'aux' if n > 1 else 'l'} animateur{'s' if n > 1 else ''} dans votre secteur"
        texte = (f"Bonjour,\n\nCette semaine, {n} animateur{'s ont' if n > 1 else ' a'} publié son profil près de {st['nom']} :\n\n" + "\n".join(lignes) +
                 f"\n\nLeurs profils complets (diplômes, expériences, disponibilités, CV) sont dans votre espace, onglet « Candidats » : {lien}\n\n"
                 f"Vous recevez cet e-mail avec l'abonnement {config['nom']}. Pour ne plus le recevoir, répondez simplement « stop ».\n")
        corps = (f"<p>Bonjour,</p><p>Cette semaine, {n} animateur{'s ont' if n > 1 else ' a'} publié son profil près de {html.escape(st['nom'])} :</p>"
                 f"<ul>{''.join('<li>' + html.escape(l[2:]) + '</li>' for l in lignes)}</ul>"
                 f'<p><a href="{html.escape(lien)}">Voir leurs profils complets dans votre espace</a> (onglet « Candidats »).</p>'
                 f'<p style="font-size:13px;color:#6e655d">Vous recevez cet e-mail avec l\'abonnement {html.escape(config["nom"])}. Pour ne plus le recevoir, répondez « stop ».</p>')
        if args.essai:
            print(f"(essai) {n} profil(s) pour une structure du {st['departement']}")
            continue
        try:
            envoyer(cle_brevo, config["email_alertes"], config["nom"], st["email_contact"], sujet, texte, corps)
            envoyes += 1
        except Exception as e:
            print(f"Alertes structures : un envoi a échoué ({e})", file=sys.stderr)
    print(f"Alertes structures : {len(profils)} nouveaux profils, {envoyes} e-mails envoyés.")


if __name__ == "__main__":
    main()
