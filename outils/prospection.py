#!/usr/bin/env python3
"""Prospection : un e-mail court et personnel aux structures repérées (admin, onglet Prospection) près des animateurs
qui ont décrit le poste qu'ils cherchent (annuaire inversé). Chaque envoi est noté dans admin_prospects (statut
« contacté », étape datée), et une structure déjà contactée n'est jamais réécrite par ce lot.

Usage (GitHub Actions, à la demande ; voir .github/workflows/prospection.yml) :
    python3 outils/prospection.py --lot 1 --essai             # n'envoie rien aux structures, montre qui recevrait quoi
    python3 outils/prospection.py --lot 1                     # envoie
    python3 outils/prospection.py --lot 1 --relance [--essai] # une seule relance, aux structures du lot restées « contacté »
                                                              # depuis au moins 7 jours (--delai) sans réponse

Copie de contrôle : si la variable COPIE_EMAIL (secret GitHub) est définie, chaque modèle de message différent est
aussi envoyé à cette adresse (« [Copie] » ou « [Aperçu essai] » dans l'objet), une fois par lancement.

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
# « dans le Bas-Rhin », « en Maine-et-Loire »… pour toute la France (lots automatiques autour des nouveaux animateurs)
LIEU = {d["code"]: d["a"] for d in yaml.safe_load((RACINE / "donnees" / "territoire.yml").read_text(encoding="utf-8"))["departements"]}
LIEU.update(IDF)


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


MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
STOP = "Vous ne souhaitez plus recevoir nos messages ? Répondez « stop »."


def animateurs(base, cle):
    """Les animateurs qui cherchent : demandes de l'annuaire inversé et fiches publiées (poste, département, zone)."""
    dem = appel(f"{base}/demandes?select=poste,departement,ville,zone,cree_le", cle) or []
    fiches = appel(f"{base}/profils?select=poste_recherche,departement,ville,code_commune,mobilite,cree_le&publie=is.true", cle) or []
    for f in fiches:
        dem.append({"poste": "animateur-stagiaire" if "stag" in (f.get("poste_recherche") or "").lower() else "animateur",
                    "departement": f.get("departement"), "ville": f.get("ville"), "code_commune": f.get("code_commune"),
                    "zone": [z for z in (f.get("mobilite") or []) if z != "france"], "cree_le": f.get("cree_le"), "fiche": True})
    return dem


def message(x, d, demandes, site, relance):
    """Objet, texte brut, HTML et phrase-clé du message pour une structure (premier envoi ou relance)."""
    pour = [m for m in demandes if d == "idf" or m["departement"] == d or d in (m.get("zone") or [])] or demandes
    n = len(pour)
    stag = sum(1 for m in pour if m.get("poste") == "animateur-stagiaire")
    s = "s" if n > 1 else ""
    verbe = "cherchent" if n > 1 else "cherche"
    toujours = " toujours" if relance else ""
    lien = f"{site}/recruter/"
    date = ""
    if relance:
        try:
            j = dt.datetime.fromisoformat(x["etapes"][0]["date"])
            date = f" du {j.day}{'er' if j.day == 1 else ''} {MOIS[j.month - 1]}"
        except Exception:
            pass
    mairie = (x.get("nom") or "").lower().startswith("mairie")
    if mairie:
        qui = (f"{n} stagiaire{s} BAFA" if stag == n else
               f"{n} animateur{s}" + (f", dont {stag} stagiaire{'s' if stag > 1 else ''} BAFA," if stag else ""))
        lieu = LIEU.get(d, "en Île-de-France")
        sujet = (("Rappel : " if relance else "") + ("animateurs BAFA disponibles" if n > 1 else "un animateur BAFA disponible")
                 + " pour vos accueils de loisirs")
        sujet = sujet[0].upper() + sujet[1:]
        cle = f"En ce moment, {qui} {verbe}{toujours} un poste {lieu}."
        if relance:
            paras = [f"Nous nous permettons de revenir vers vous au sujet de notre message{date}. Pourriez-vous le transmettre au "
                     "service enfance-jeunesse ?",
                     f"{cle} Si votre service recrute pour les vacances ou le périscolaire, il peut créer sa page gratuitement : "
                     "les demandes du secteur arrivent alors directement chez vous.",
                     "Dès que votre page est vérifiée, vous voyez les animateurs qui cherchent déjà près de chez vous.",
                     "C'est notre dernier message à ce sujet."]
        else:
            paras = ["Pourriez-vous transmettre ce message au service enfance-jeunesse ?",
                     f"Sur Fil Roug'Anim, des animateurs décrivent le poste qu'ils cherchent. {cle}",
                     "Votre service peut créer sa page gratuitement : les demandes du secteur arrivent alors directement chez vous."]
        bouton = "Créer la page de votre service"
    else:
        qui = f"{n} animateur{s}" + (f", dont {stag} stagiaire{'s' if stag > 1 else ''} BAFA," if stag and stag < n else
                                     (" stagiaires BAFA" if stag == n and n > 1 else (" stagiaire BAFA" if stag else "")))
        lieux = liste(sorted({LIEU.get(m["departement"], "en Île-de-France") for m in pour}))
        sujet = f"{'Rappel : ' if relance else ''}{n} animateur{s} {verbe} un poste près de chez vous"
        cle = f"En ce moment, {qui} {verbe}{toujours} un poste {lieux}."
        if relance:
            paras = [f"Nous nous permettons de revenir vers vous au sujet de notre message{date}. {cle}",
                     "Votre page et une offre sont gratuites. Dès que votre page est vérifiée, vous voyez les animateurs qui "
                     "cherchent déjà près de chez vous, et les nouvelles demandes de votre secteur arrivent directement chez vous.",
                     "C'est notre dernier message à ce sujet."]
        else:
            paras = ["Sur Fil Roug'Anim, des animateurs décrivent le poste qu'ils cherchent, et leur demande part chez les "
                     f"structures les plus proches. {cle} {'Ils n’ont' if n > 1 else 'Il n’a'} encore reçu aucune réponse : "
                     "aucune structure de votre secteur n'est inscrite.",
                     "Votre page et une offre sont gratuites. Une fois votre structure vérifiée, les demandes de votre secteur "
                     "arrivent directement chez vous."]
        bouton = "Créer la page de votre structure (2 minutes)"
    texte = ("Bonjour,\n\n" + "\n\n".join(paras) + f"\n\n{bouton} : {lien}\n\n"
             f"Bonne journée,\nL'équipe Fil Roug'Anim\n{site}\n\n{STOP}\n")
    corps = ("<p>Bonjour,</p>" + "".join(f"<p>{html.escape(t)}</p>" for t in paras) + f'<p><a href="{lien}">{html.escape(bouton)}</a></p>'
             f"<p>Bonne journée,<br>L'équipe Fil Roug'Anim<br><a href=\"{site}\">filrouganim.fr</a></p>"
             f'<p style="font-size:12px;color:#6b6f76">{html.escape(STOP)}</p>')
    return sujet, texte, corps, cle


def traiter(lot, essai=False, relance=False, delai=7, prospects=None):
    """Envoie (ou montre, en essai) les messages d'un lot. « auto » = tous les lots automatiques (« lot auto-AAAA-MM-JJ »).
    prospects : liste fournie à la place de la table (essai des lots automatiques, avant leur import)."""
    config = yaml.safe_load((RACINE / "config.yml").read_text(encoding="utf-8"))
    cle = (os.environ.get("SUPABASE_SECRET_KEY") or "").strip()
    cle_brevo = (os.environ.get("BREVO_API_KEY") or "").strip()
    copie = (os.environ.get("COPIE_EMAIL") or "").strip()
    if not cle or not (cle_brevo or essai):
        sys.exit("Prospection : secrets SUPABASE_SECRET_KEY et BREVO_API_KEY absents, rien n'est envoyé.")
    base, site = config["supabase"]["url"].rstrip("/") + "/rest/v1", config["url"].rstrip("/")
    de = config.get("email") or "contact@filrouganim.fr"
    maintenant = dt.datetime.now(dt.timezone.utc)
    auto = lot.startswith("auto")

    demandes = animateurs(base, cle)
    if prospects is None:
        statut = "contacte" if relance else "a_contacter"
        prospects = appel(f"{base}/admin_prospects?select=cle,nom,email,ville,statut,etapes,note&type=eq.organisateur"
                          f"&statut=eq.{statut}&email=not.is.null", cle) or []
        # chaque lot ne touche que ses structures : le lot 1 (repérées à la main), les suivants notés « lot N » à l'import
        prefixe = "lot auto-" if lot == "auto" else f"lot {lot} "
        prospects = [x for x in prospects if ((x.get("note") or "").startswith(prefixe) if lot != "1"
                                              else not (x.get("note") or "").startswith("lot "))]
    envoyes, ignores, trop_tot, deja, copies, vus = 0, 0, 0, 0, 0, set()
    for x in prospects:
        d = dep_de(x.get("ville")) or dep_de(x.get("nom"))
        if not ((auto and d in LIEU) or d in IDF or d == "idf"):
            ignores += 1
            continue
        etapes = x.get("etapes") or []
        if relance:
            # une seule relance : uniquement les structures qui n'ont reçu que le premier message de ce lot
            if len(etapes) != 1:
                deja += 1
                continue
            try:
                ecart = maintenant - dt.datetime.fromisoformat(etapes[0]["date"])
            except Exception:
                ecart = dt.timedelta(0)
            if ecart < dt.timedelta(days=delai):
                trop_tot += 1
                continue
        sujet, texte, corps, phrase = message(x, d, demandes, site, relance)
        modele = (sujet, texte)
        if modele not in vus:
            vus.add(modele)
            if essai:
                print(f"\n----- modèle (ex. {x['cle']}) -----\nObjet : {sujet}\n\n{texte}-----")
            if copie and cle_brevo:
                tag = "[Aperçu essai]" if essai else "[Copie]"
                note = f"{tag} Modèle envoyé par exemple à {x['nom']} <{x['email']}> ({'relance' if relance else 'premier envoi'}, lot {lot})"
                try:
                    envoyer(cle_brevo, de, config["nom"], copie, f"{tag} {sujet}", f"{note}\n\n{texte}",
                            f'<p style="font-size:12px;color:#6b6f76">{html.escape(note)}</p><hr>{corps}')
                    copies += 1
                except Exception as e:
                    print(f"Prospection : copie de contrôle non envoyée ({e})", file=sys.stderr)
        if essai:
            print(f"(essai) {x['cle']} <{x['email']}> [{d}] : {phrase}")
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
        lot_note = ((x.get("note") or "").split(" ")[1] if lot == "auto" else lot)
        etape = {"n": len(etapes) + 1, "date": dt.datetime.now(dt.timezone.utc).isoformat(), "lot": lot_note}
        if relance:
            etape["relance"] = True
        appel(f"{base}/admin_prospects?cle=eq.{urllib.parse.quote(x['cle'])}", cle, "PATCH",
              {"statut": "contacte", "etapes": etapes + [etape], "maj": dt.datetime.now(dt.timezone.utc).isoformat()})
        envoyes += 1
    quoi = "relances" if relance else "e-mails"
    print(f"Prospection lot {lot} : {envoyes} {quoi} {'à envoyer (essai, rien n’est parti aux structures)' if essai else 'envoyés'}, "
          f"{ignores} structures hors secteur laissées de côté."
          + (f" {trop_tot} contactées depuis moins de {delai} jours, {deja} déjà relancées." if relance else "")
          + (f" {copies} copie(s) de contrôle envoyée(s)." if copie else " Pas de copie de contrôle (secret COPIE_EMAIL absent)."))
    return envoyes


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--lot", default="1")
    p.add_argument("--essai", action="store_true")
    p.add_argument("--relance", action="store_true")
    p.add_argument("--delai", type=int, default=7, help="relance : jours minimum depuis le premier envoi")
    args = p.parse_args()
    traiter(args.lot, args.essai, args.relance, args.delai)


if __name__ == "__main__":
    main()
