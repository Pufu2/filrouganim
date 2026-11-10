"""Relève les abonnements des structures dans Stripe et les recopie dans la base (Supabase).
Lancé toutes les 15 minutes par GitHub Actions (.github/workflows/abonnements.yml), sur le modèle des livraisons de Jeuphorie.

1. Les paiements terminés des 3 derniers jours, faits avec les liens de paiement de Fil Roug'Anim (config.yml,
   abonnement.liens_stripe) : la structure est reconnue par « client_reference_id » (son identifiant, ajouté au lien
   depuis « Mon espace »). On note l'abonnement Stripe dans sa fiche.
2. Tous les abonnements Fil Roug'Anim (métadonnée site = filrouganim) : on recopie la date de fin de la période payée,
   le nombre de centres payés (la quantité) et le tarif fondateur. Un abonnement arrêté garde sa fin de période ;
   un abonnement payé sur facture se rattache avec la métadonnée « structure_id » (voir docs/COMPTES-SUPABASE.md).

La structure ne peut pas modifier ces champs elle-même : seul le rôle serveur (clé secrète) les écrit.
Secrets GitHub : STRIPE_ABONNEMENTS_KEY (clé restreinte Stripe : « Checkout Sessions » et « Subscriptions » en lecture)
et SUPABASE_SECRET_KEY (déjà utilisée pour les chiffres).
Usage : python3 outils/abonnements.py [--essai]   (--essai affiche ce qui serait écrit, sans rien écrire)
"""
import base64
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parents[1]
CONFIG = yaml.safe_load((RACINE / "config.yml").read_text(encoding="utf-8"))
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
GRACE = 3  # jours de plus après la fin de période, le temps que Stripe renouvelle le paiement


def stripe(chemin, cle, **params):
    url = f"https://api.stripe.com/v1/{chemin}" + ("?" + urllib.parse.urlencode(params, doseq=True) if params else "")
    req = urllib.request.Request(url, headers={"Authorization": "Basic " + base64.b64encode(f"{cle}:".encode()).decode()})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def tout(chemin, cle, **params):
    """Toutes les pages d'une liste Stripe."""
    apres = None
    while True:
        p = dict(params, limit=100, **({"starting_after": apres} if apres else {}))
        page = stripe(chemin, cle, **p)
        yield from page["data"]
        if not page.get("has_more") or not page["data"]:
            return
        apres = page["data"][-1]["id"]


def supabase(methode, chemin, cle, corps=None):
    url = f"{CONFIG['supabase']['url']}/rest/v1/{chemin}"
    req = urllib.request.Request(url, method=methode, data=json.dumps(corps).encode() if corps is not None else None,
                                 headers={"apikey": cle, "Authorization": f"Bearer {cle}", "Content-Type": "application/json",
                                          "Prefer": "return=representation"})
    with urllib.request.urlopen(req, timeout=60) as r:
        texte = r.read().decode("utf-8")
        return json.loads(texte) if texte else None


def fin_de_periode(abo):
    """Date de fin de la période payée (selon la version de l'API, sur l'abonnement ou sur sa ligne)."""
    fin = abo.get("current_period_end")
    if not fin and abo.get("items", {}).get("data"):
        fin = abo["items"]["data"][0].get("current_period_end")
    if abo.get("status") == "canceled" and abo.get("ended_at"):
        fin = min(fin or abo["ended_at"], abo["ended_at"])
    return dt.datetime.fromtimestamp(fin, dt.timezone.utc).date() if fin else None


def etat(abo):
    """Ce qu'on écrit dans la fiche de la structure."""
    fin = fin_de_periode(abo)
    if abo["status"] in ("active", "trialing", "past_due") and fin:
        fin = fin + dt.timedelta(days=GRACE)
    elif abo["status"] in ("incomplete", "incomplete_expired", "unpaid"):
        fin = None
    quantite = sum((l.get("quantity") or 0) for l in abo.get("items", {}).get("data", [])) or 1
    return {"abonnement_id": abo["id"], "abonnement_fin": fin.isoformat() if fin else None,
            "centres_payes": min(quantite, 50), "fondatrice": (abo.get("metadata") or {}).get("formule") == "fondateur"}


def main():
    essai = "--essai" in sys.argv
    cle_stripe = os.environ.get("STRIPE_ABONNEMENTS_KEY", "").strip()
    cle_sb = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    if not cle_stripe or not cle_sb:
        print("Secrets STRIPE_ABONNEMENTS_KEY ou SUPABASE_SECRET_KEY absents : rien n'est relevé.")
        return
    liens = set((CONFIG.get("abonnement") or {}).get("liens_stripe") or [])

    # les structures de la base, et leur abonnement déjà connu
    structures = {s["id"]: s for s in supabase("GET", "structures?select=id,nom,abonnement_id,abonnement_fin,centres_payes,fondatrice", cle_sb)}
    par_abonnement = {s["abonnement_id"]: i for i, s in structures.items() if s.get("abonnement_id")}

    # 1. les paiements récents : quelle structure a payé quel abonnement
    depuis = int(time.time()) - 3 * 86400
    for session in tout("checkout/sessions", cle_stripe, status="complete", **{"created[gte]": depuis}):
        if session.get("payment_link") not in liens or not session.get("subscription"):
            continue
        sid = (session.get("client_reference_id") or "").strip()
        if not UUID.match(sid) or sid not in structures:
            print(f"Paiement {session['id']} sans structure reconnue (client_reference_id « {sid} ») : à rattacher à la main.")
            continue
        par_abonnement[session["subscription"]] = sid

    # 2. tous les abonnements Fil Roug'Anim : fin de période, centres payés, tarif fondateur
    vus = 0
    for abo in tout("subscriptions", cle_stripe, status="all", **{"expand[]": "data.items"}):
        if (abo.get("metadata") or {}).get("site") != "filrouganim":
            continue
        sid = par_abonnement.get(abo["id"]) or (abo.get("metadata") or {}).get("structure_id")
        if not sid or sid not in structures:
            continue
        vus += 1
        nouveau = etat(abo)
        ancien = {k: structures[sid].get(k) for k in nouveau}
        if nouveau == ancien:
            continue
        # une structure qui a plusieurs abonnements (un ancien arrêté, un nouveau) : on garde celui qui finit le plus tard
        if ancien.get("abonnement_id") and ancien["abonnement_id"] != abo["id"] and ancien.get("abonnement_fin") \
                and (nouveau["abonnement_fin"] or "") < ancien["abonnement_fin"]:
            continue
        print(f"{structures[sid]['nom']} : {ancien} -> {nouveau}")
        if not essai:
            supabase("PATCH", f"structures?id=eq.{sid}", cle_sb, nouveau)
        structures[sid].update(nouveau)
    print(f"{vus} abonnement(s) Fil Roug'Anim relevé(s).")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        sys.exit(f"Erreur {e.code} : {e.read().decode('utf-8', 'replace')[:300]}")
