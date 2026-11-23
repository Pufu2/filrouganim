#!/usr/bin/env python3
"""Alertes du lundi : envoie à chaque candidat qui l'a demandé les nouvelles offres de son secteur, et à chaque
structure vérifiée les nouvelles fiches et demandes d'animateurs de son département.

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
    # au printemps, une ligne pour « Inscrire mon enfant » (les animateurs ont souvent des enfants ou des proches qui partent)
    sejour_t, sejour_h = "", ""
    if 3 <= dt.date.today().month <= 6:
        try:
            nb_sj = len(lire(f"{base}/sejours?select=id&statut=eq.publie", cle) or [])
        except Exception:
            nb_sj = 0
        if nb_sj >= 3:
            sejour_t = f"\n\nVos enfants ou vos proches partent cet été ? {nb_sj} séjours et accueils de loisirs sur {config['nom']} : {site}/enfants/"
            sejour_h = (f'<p style="padding:10px 14px;background:#fbf8f2;border-radius:10px">Vos enfants ou vos proches partent cet été ? '
                        f'<a href="{site}/enfants/">{nb_sj} séjours et accueils de loisirs</a> pour les 3-17 ans.</p>')
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
                 f"\n\nVous postulez avec votre profil, en un clic.{sejour_t}\n\nNe plus recevoir ces e-mails : {stop}\n")
        corps = (f"<p>Bonjour {html.escape(p['prenom'])},</p><p>Cette semaine sur {html.escape(config['nom'])} :</p>"
                 f"<ul>{''.join(items)}</ul><p>Vous postulez avec votre profil, en un clic.</p>{sejour_h}"
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
    """Chaque lundi, à toutes les structures vérifiées : les animateurs qui ont publié leur fiche dans leur secteur cette
    semaine, et les demandes de l'annuaire inversé (le poste qu'un animateur cherche) de leur département : celles de la
    semaine, et celles des 30 derniers jours qui attendent encore (pas marquées « traitée » dans le QG). Jamais le nom
    de famille, le message ni les coordonnées : ils sont dans l'espace structure. Les structures abonnées les contactent
    directement ; les autres voient ce qu'elles manquent."""
    structures = lire(f"{base}/structures?select=nom,departement,email_contact,abonnement_fin&verifiee=is.true&email_contact=not.is.null", cle)
    if not structures:
        print("Alertes structures : aucune structure vérifiée.")
        return
    profils = lire(f"{base}/profils?select=prenom,departement,mobilite,diplomes,poste_recherche,ville&publie=is.true&verifie=is.true"
                   f"&cree_le=gte.{urllib.parse.quote(depuis)}", cle) or []
    depuis30 = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    demandes = lire(f"{base}/demandes?select=poste,departement,ville,zone,partout,periodes,dispo_debut,diplomes,cree_le,suivi"
                    f"&cree_le=gte.{urllib.parse.quote(depuis30)}&order=cree_le.desc", cle) or []
    demandes = [d for d in demandes if d.get("suivi") != "traitee"]
    envoyes = 0
    for st in structures:
        dep = st["departement"]
        fiches = [p for p in profils if p.get("departement") == dep or dep in (p.get("mobilite") or [])]
        dem = [d for d in demandes if d.get("departement") == dep or d.get("partout") or dep in (d.get("zone") or [])]
        if not fiches and not dem:
            continue
        abonnee = bool(st.get("abonnement_fin") and st["abonnement_fin"] >= aujourdhui)
        lien = f"{site}/compte/?role=structure"
        l_f = [f"{p['prenom']}, {POSTES.get(p.get('poste_recherche'), p.get('poste_recherche') or 'animation')}"
               f"{', ' + p['ville'] if p.get('ville') else ''} ({p['departement']}){' · ' + ', '.join(p['diplomes'][:3]) if p.get('diplomes') else ''}" for p in fiches[:15]]
        def ligne_d(d):
            return (f"{POSTES.get(d.get('poste'), d.get('poste') or 'animation').capitalize()}"
                    f"{' à ' + d['ville'] if d.get('ville') else ''} ({d['departement']})"
                    f"{', dès le ' + dt.date.fromisoformat(d['dispo_debut']).strftime('%d/%m') if d.get('dispo_debut') else ''}"
                    f"{' · ' + ', '.join(d['diplomes'][:3]) if d.get('diplomes') else ''}")
        dem_neuves = [d for d in dem if (d.get("cree_le") or "") >= depuis]
        dem_attente = [d for d in dem if (d.get("cree_le") or "") < depuis]
        l_d = [ligne_d(d) for d in dem_neuves[:15]]
        l_a = [ligne_d(d) for d in dem_attente[:15]]
        nf, nd = len(fiches), len(dem)
        morceaux = []
        if nd:
            morceaux.append(f"{nd} animateur{'s cherchent' if nd > 1 else ' cherche'} un poste")
        if nf:
            morceaux.append(f"{nf} nouvelle{'s' if nf > 1 else ''} fiche{'s' if nf > 1 else ''} d'animateur")
        sujet = " et ".join(morceaux) + " près de chez vous"
        suite = ("Leurs fiches complètes (diplômes, expériences, disponibilités, CV) et leurs coordonnées sont dans votre espace."
                 if abonnee else "Avec l'abonnement, vous voyez leurs fiches complètes et vous leur écrivez directement, depuis votre espace.")
        blocs_t, blocs_h = [], []
        if l_d:
            blocs_t.append("Ils décrivent le poste qu'ils cherchent :\n" + "\n".join("- " + l for l in l_d))
            blocs_h.append("<p><b>Ils décrivent le poste qu'ils cherchent :</b></p><ul>" + "".join("<li>" + html.escape(l) + "</li>" for l in l_d) + "</ul>")
        if l_a:
            blocs_t.append("Ils attendent toujours une réponse :\n" + "\n".join("- " + l for l in l_a))
            blocs_h.append("<p><b>Ils attendent toujours une réponse :</b></p><ul>" + "".join("<li>" + html.escape(l) + "</li>" for l in l_a) + "</ul>")
        if l_f:
            blocs_t.append("Ils ont publié leur fiche :\n" + "\n".join("- " + l for l in l_f))
            blocs_h.append("<p><b>Ils ont publié leur fiche :</b></p><ul>" + "".join("<li>" + html.escape(l) + "</li>" for l in l_f) + "</ul>")
        texte = (f"Bonjour,\n\nPrès de {st['nom']} :\n\n" + "\n\n".join(blocs_t) +
                 f"\n\n{suite}\n{lien}\n\nVous recevez cet e-mail parce que votre structure est inscrite sur {config['nom']}. Pour ne plus le recevoir, répondez simplement « stop ».\n")
        corps = (f"<p>Bonjour,</p><p>Près de {html.escape(st['nom'])} :</p>" + "".join(blocs_h) +
                 f'<p>{html.escape(suite)}</p><p><a href="{html.escape(lien)}" style="display:inline-block;background:#d61f35;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700">Ouvrir mon espace</a></p>'
                 f'<p style="font-size:13px;color:#6e655d">Vous recevez cet e-mail parce que votre structure est inscrite sur {html.escape(config["nom"])}. Pour ne plus le recevoir, répondez « stop ».</p>')
        if args.essai:
            print(f"(essai) {nd} demande(s) et {nf} fiche(s) pour une structure du {dep}{' (abonnée)' if abonnee else ''}")
            continue
        try:
            envoyer(cle_brevo, config["email_alertes"], config["nom"], st["email_contact"], sujet, texte, corps)
            envoyes += 1
        except Exception as e:
            print(f"Alertes structures : un envoi a échoué ({e})", file=sys.stderr)
    print(f"Alertes structures : {len(profils)} nouvelles fiches, {len(demandes)} demandes de moins de 30 jours, {envoyes} e-mails envoyés.")


if __name__ == "__main__":
    main()
