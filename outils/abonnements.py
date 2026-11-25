"""Relève les abonnements des structures dans Stripe et les recopie dans la base (Supabase).
Lancé par GitHub Actions (prévu toutes les 15 minutes, en vrai toutes les 4 à 8 heures ; les paiements arrivent aussi tout de suite par supabase/functions/stripe) (.github/workflows/abonnements.yml), sur le modèle des livraisons de Jeuphorie.

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
import collections
import datetime as dt
import html
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


def stripe_post(chemin, cle, donnees):
    """Une écriture dans Stripe (création d'une facture, d'un client…)."""
    req = urllib.request.Request(f"https://api.stripe.com/v1/{chemin}", method="POST",
                                 data=urllib.parse.urlencode(donnees, doseq=True).encode(),
                                 headers={"Authorization": "Basic " + base64.b64encode(f"{cle}:".encode()).decode(),
                                          "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


SEUIL_FACTURE = 10   # en dessous de 10 € dans le mois, rien à payer
PIC_MIN = 20         # un jour compte comme « pic anormal » au-delà de 20 clics et de 3 fois la médiane des 28 jours d'avant


def clics_du_mois(cle_sb, organisme, mois_debut, mois_fin):
    """Les clics facturables d'un organisme pour le mois, par département : {dep: (clics retenus, clics écartés, jours écartés)}.
    Un jour anormal (pic) n'est pas facturé au-delà du niveau habituel : les clics en trop sont écartés et signalés."""
    avant = (mois_debut - dt.timedelta(days=28)).isoformat()
    lignes = supabase("POST", "rpc/clics_par_jour", cle_sb, {"o": organisme, "de": avant, "a": mois_fin.isoformat()}) or []
    par_jour = {(l["departement"], l["jour"]): l["n"] for l in lignes}
    res = {}
    for (dep, jour), n in sorted(par_jour.items()):
        if jour < mois_debut.isoformat():
            continue
        j = dt.date.fromisoformat(jour)
        prec = sorted(par_jour.get((dep, (j - dt.timedelta(days=k)).isoformat()), 0) for k in range(1, 29))
        mediane = (prec[13] + prec[14]) / 2
        limite = max(PIC_MIN, round(3 * mediane))
        garde, ecarte = min(n, limite), max(0, n - limite)
        r = res.setdefault(dep, [0, 0, []])
        r[0] += garde
        r[1] += ecarte
        if ecarte:
            r[2].append(jour)
    return res


def partenariats(cle_stripe, cle_sb, essai):
    """La formule partenaire au clic : une facture par mois échu, d'après les clics facturables (comptés une fois par
    personne, par organisme et par jour, robots exclus, pics anormaux écartés), au prix du clic, plafonnée au prix annuel
    du département. Rien à payer d'avance ; en dessous de 10 € dans le mois, rien à payer du tout."""
    auj = dt.date.today()
    noms = {z["departement"]: z["nom"] for z in supabase("GET", "zones_tarifs?select=departement,nom", cle_sb) or []}
    comptes = {c["id"]: c for c in supabase("GET", "comptes_organismes?select=id,nom,email_contact,organisme_id", cle_sb) or []}
    # 1. le mois qui vient de finir
    fin_mois = auj.replace(day=1) - dt.timedelta(days=1)
    debut_mois = fin_mois.replace(day=1)
    lignes = supabase("GET", "partenariats?select=id,compte,departement,prix,prix_clic,lancement,statut,debut,fin"
                             f"&statut=in.(actif,expire)&debut=lte.{fin_mois.isoformat()}&fin=gte.{debut_mois.isoformat()}", cle_sb) or []
    deja = {(f["compte"], f["mois"]) for f in supabase("GET", f"factures_clics?select=compte,mois&mois=eq.{debut_mois.isoformat()}", cle_sb) or []}
    anciennes = supabase("GET", "factures_clics?select=compte,mois,detail&statut=in.(facture,payee,a_facturer)", cle_sb) or []
    par_compte = {}
    for l in lignes:
        par_compte.setdefault(l["compte"], []).append(l)
    for cid, ls in par_compte.items():
        c = comptes.get(cid) or {}
        if (cid, debut_mois.isoformat()) in deja or not c.get("organisme_id"):
            continue
        clics = clics_du_mois(cle_sb, c["organisme_id"], debut_mois, fin_mois)
        detail, total, n_total, n_ecartes = [], 0.0, 0, 0
        for l in ls:
            garde, ecarte, jours = clics.get(l["departement"], [0, 0, []])
            # ce qui a déjà été facturé pour ce département depuis le début de l'année en cours : le plafond ne se dépasse jamais
            debut_annee = (l.get("debut") or "0000-01-01")[:7] + "-01"
            paye = sum(float(d.get("montant", 0)) for f in anciennes if f["compte"] == cid and f["mois"] >= debut_annee
                       for d in (f.get("detail") or []) if d.get("partenariat") == l["id"])
            reste = max(0.0, l["prix"] - paye)
            montant = round(min(garde * float(l["prix_clic"]), reste), 2)
            detail.append({"partenariat": l["id"], "departement": l["departement"], "nom": noms.get(l["departement"], l["departement"]),
                           "clics": garde, "ecartes": ecarte, "jours_ecartes": jours, "prix_clic": float(l["prix_clic"]),
                           "montant": montant, "plafond": l["prix"], "deja": round(paye, 2)})
            total += montant
            n_total += garde
            n_ecartes += ecarte
        total = round(total, 2)
        statut = "a_facturer" if total >= SEUIL_FACTURE else "offerte"
        print(f"Clics de {debut_mois:%m/%Y} · {c.get('nom')} : {n_total} clics, {n_ecartes} écartés, {total:.2f} € ({statut})")
        if essai:
            continue
        ligne = supabase("POST", "factures_clics", cle_sb, {"compte": cid, "mois": debut_mois.isoformat(), "clics": n_total,
                                                            "clics_ecartes": n_ecartes, "montant": total, "detail": detail, "statut": statut})
        if n_ecartes:
            supabase("POST", "evenements_admin", cle_sb, {"type": "organisme", "resume": f"Pic de clics écarté · {c.get('nom')} · "
                     + ", ".join(f"{d['departement']} : {d['ecartes']} ({', '.join(j[8:10] + '/' + j[5:7] for j in d['jours_ecartes'])})" for d in detail if d["ecartes"])
                     + " · non facturés"})
        if statut != "a_facturer":
            continue
        fid = ligne[0]["id"]
        try:
            client = stripe_post("customers", cle_stripe, {"name": c.get("nom") or "Organisme", "email": c.get("email_contact") or "",
                                                         "metadata[site]": "filrouganim-organisme", "metadata[compte]": cid})
            facture = stripe_post("invoices", cle_stripe, {"customer": client["id"], "collection_method": "send_invoice", "days_until_due": 30,
                                                          "description": f"Fil Roug'Anim : clics de {debut_mois:%m/%Y} (formule partenaire, détail jour par jour dans votre espace)",
                                                          "metadata[site]": "filrouganim-organisme", "metadata[compte]": cid})
            for d in detail:
                if d["montant"] > 0:
                    stripe_post("invoiceitems", cle_stripe, {"customer": client["id"], "invoice": facture["id"], "currency": "eur",
                                                             "amount": round(d["montant"] * 100),
                                                             "description": f"{d['nom']} ({d['departement']}) · {d['clics']} clics à {d['prix_clic']:.2f} €".replace(".", ",")
                                                                            + (" · plafond atteint" if d["montant"] < d["clics"] * d["prix_clic"] else "")})
            facture = stripe_post(f"invoices/{facture['id']}/finalize", cle_stripe, {})
            try:
                stripe_post(f"invoices/{facture['id']}/send", cle_stripe, {})
            except Exception as e:
                print(f"  envoi de la facture par e-mail impossible ({e}) : le lien reste dans l'espace de l'organisme")
            supabase("PATCH", f"factures_clics?id=eq.{fid}", cle_sb, {"statut": "facture", "facture_id": facture["id"], "facture_url": facture.get("hosted_invoice_url")})
        except urllib.error.HTTPError as e:
            print(f"  Stripe refuse la facture ({e.code}) : {e.read().decode(errors='ignore')[:200]}")
            supabase("POST", "evenements_admin", cle_sb, {"type": "organisme", "resume": f"Facture de clics à faire à la main · {c.get('nom')} · {total:.2f} € (Stripe : {e.code}) [clics-{fid}]"})
    # 2. les factures envoyées : payée ; impayée 45 jours -> les départements sont suspendus
    for f in supabase("GET", "factures_clics?select=id,compte,facture_id,cree_le&statut=eq.facture", cle_sb) or []:
        if not f.get("facture_id"):
            continue
        s = stripe(f"invoices/{f['facture_id']}", cle_stripe)
        if s.get("status") == "paid":
            print(f"Facture de clics payée : {comptes.get(f['compte'], {}).get('nom')}")
            if not essai:
                supabase("PATCH", f"factures_clics?id=eq.{f['id']}", cle_sb, {"statut": "payee"})
                supabase("POST", "evenements_admin", cle_sb, {"type": "paiement", "resume": f"Clics payés · {comptes.get(f['compte'], {}).get('nom')}"})
        elif s.get("status") in ("void", "uncollectible"):
            if not essai:
                supabase("PATCH", f"factures_clics?id=eq.{f['id']}", cle_sb, {"statut": "annulee"})
        elif dt.date.fromisoformat(f["cree_le"][:10]) < auj - dt.timedelta(days=45):
            print(f"Facture impayée depuis 45 jours : {comptes.get(f['compte'], {}).get('nom')}, départements suspendus")
            if not essai:
                supabase("PATCH", f"partenariats?compte=eq.{f['compte']}&statut=eq.actif", cle_sb, {"statut": "annule", "fin": auj.isoformat()})
    # 3. les partenariats arrivés au bout de l'année : renouvelés d'un an, tant que l'organisme ne les a pas arrêtés
    #    (rien n'est payé d'avance : seuls les clics comptés sont facturés ; le plafond repart pour la nouvelle année)
    for l in supabase("GET", f"partenariats?select=id,compte,departement,fin&statut=eq.actif&fin=lt.{auj.isoformat()}", cle_sb) or []:
        f = dt.date.fromisoformat(l["fin"])
        nouvelle = dt.date(f.year + 1, f.month, min(f.day, 28))
        print(f"Partenariat {l['departement']} renouvelé jusqu'au {nouvelle}")
        if not essai:
            supabase("PATCH", f"partenariats?id=eq.{l['id']}", cle_sb, {"debut": (f + dt.timedelta(days=1)).isoformat(), "fin": nouvelle.isoformat()})


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

    # 1 bis. le Pass recrutement (paiement unique) : toutes les fonctions de l'abonnement pendant 1 à 3 mois (un lien Stripe par durée ; l ancien lien au mois reste reconnu),
    #        à partir d'aujourd'hui ou de la fin de ce qui est déjà payé ; et la formule partenaire d'un organisme :
    #        on prévient l'administration (l'activation se fait dans organismes.yml). Chaque paiement n'est compté
    #        qu'une fois : sa marque [fin de l'identifiant Stripe] est gardée dans evenements_admin.
    abonnement = CONFIG.get("abonnement") or {}
    lien_pass, prix_mois = abonnement.get("lien_pass_mois"), 1500
    lien_partenaire = (CONFIG.get("partenaires") or {}).get("lien_stripe")
    def deja(marque):
        return bool(supabase("GET", f"evenements_admin?select=id&resume=like.*{urllib.parse.quote(marque)}*", cle_sb))
    def plus_mois(d, n):
        a, m = d.year + (d.month - 1 + n) // 12, (d.month - 1 + n) % 12 + 1
        jours = [31, 29 if a % 4 == 0 and (a % 100 or a % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
        return dt.date(a, m, min(d.day, jours))
    for session in tout("checkout/sessions", cle_stripe, status="complete", **{"created[gte]": depuis}):
        marque = f"[{session['id'][-10:]}]"
        passes = {p["plink"]: p["mois"] for p in abonnement.get("pass") or []}
        if session.get("payment_link") in passes or (lien_pass and session.get("payment_link") == lien_pass) and session.get("payment_status") == "paid":
            if session.get("payment_status") != "paid":
                continue
            sid = (session.get("client_reference_id") or "").strip()
            if not UUID.match(sid) or sid not in structures:
                print(f"Pass {session['id']} sans structure reconnue : à rattacher à la main.")
                continue
            if deja(marque):
                continue
            mois = passes.get(session.get("payment_link")) or max(1, round((session.get("amount_total") or prix_mois) / prix_mois))
            depart = max(dt.date.today(), dt.date.fromisoformat(structures[sid]["abonnement_fin"]) if structures[sid].get("abonnement_fin") else dt.date.today())
            fin = plus_mois(depart, mois).isoformat()
            print(f"{structures[sid]['nom']} : Pass {mois} mois, jusqu'au {fin}")
            if not essai:
                supabase("PATCH", f"structures?id=eq.{sid}", cle_sb, {"abonnement_fin": fin})
                supabase("POST", "evenements_admin", cle_sb, {"type": "paiement", "resume": f"{structures[sid]['nom']} · Pass {mois} mois, jusqu'au {fin[8:10]}/{fin[5:7]}/{fin[:4]} {marque}"})
            structures[sid]["abonnement_fin"] = fin
        elif lien_partenaire and session.get("payment_link") == lien_partenaire:
            if deja(marque):
                continue
            champs = {c.get("key"): (c.get("text") or {}).get("value") for c in session.get("custom_fields") or []}
            nom = champs.get("organisme") or "organisme"
            print(f"Formule partenaire payée : {nom}")
            if not essai:
                supabase("POST", "evenements_admin", cle_sb, {"type": "organisme", "resume": f"Formule partenaire PAYÉE · {nom} · départements {champs.get('departements') or '?'} · {(session.get('customer_details') or {}).get('email') or ''} · à activer dans organismes.yml {marque}"})

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
    try:
        partenariats(cle_stripe, cle_sb, essai)
    except Exception as e:
        print(f"Partenariats des organismes : {e}")
    # les demandes de séjour masquées (au-delà des 2 gratuites) s'ouvrent dès que la structure est abonnée ou a pris le Pass
    try:
        fermees = {d["structure_id"] for d in supabase("GET", "demandes_sejour?select=structure_id&ouverte=eq.false", cle_sb) or []}
        auj = dt.date.today().isoformat()
        for sid in fermees:
            fin = (structures.get(sid) or {}).get("abonnement_fin")
            if fin and fin >= auj:
                print(f"Demandes de séjour ouvertes : {structures[sid].get('nom')}")
                if not essai:
                    supabase("POST", "rpc/ouvrir_demandes", cle_sb, {"sid": sid})
    except Exception as e:
        print(f"Demandes de séjour : {e}")


POSTES = {"animateur-stagiaire": "Stage pratique BAFA", "animateur": "Animateur ou animatrice", "directeur": "Direction ou adjoint",
          "surveillant-baignade": "Surveillance de baignade", "directeur-adjoint": "Direction adjointe", "autre": "Autre poste"}
PERIODES = {"ete": "l'été", "petites-vacances": "les petites vacances", "mercredis": "les mercredis", "periscolaire": "le périscolaire", "annee": "toute l'année"}


def demandes(cle_sb):
    """L'annuaire inversé : les demandes en attente partent chez les structures qui viennent d'arriver dans leur zone,
    puis chaque structure qui reçoit une nouvelle demande est prévenue par e-mail (une seule fois par demande)."""
    try:
        n = supabase("POST", "rpc/relayer_demandes", cle_sb, {})
        if n:
            print(f"{n} demande(s) en attente relayée(s).")
        lignes = supabase("GET", "demandes?select=id,prenom,poste,departement,ville,periodes,dispo_debut,destinataires,notifiees,partout"
                                 "&order=cree_le", cle_sb) or []
    except urllib.error.HTTPError as e:
        print(f"Demandes : non lues ({e.code})")
        return
    a_prevenir = [(d, [x for x in d["destinataires"] if x not in (d.get("notifiees") or [])]) for d in lignes]
    a_prevenir = [(d, xs) for d, xs in a_prevenir if xs]
    if not a_prevenir:
        return
    cle_brevo = os.environ.get("BREVO_API_KEY", "").strip()
    if not cle_brevo:
        print("BREVO_API_KEY absente : les structures ne sont pas prévenues par e-mail (elles voient les demandes dans leur espace).")
        return
    sys.path.insert(0, str(RACINE / "outils"))
    from alertes import envoyer
    ids = sorted({x for _, xs in a_prevenir for x in xs})
    structures = {s["id"]: s for s in supabase("GET", "structures?select=id,nom,email_contact&id=in.(" + ",".join(ids) + ")", cle_sb)}
    espace = CONFIG["url"].rstrip("/") + "/compte/"
    for d, xs in a_prevenir:
        quand = ", ".join(PERIODES.get(p, p) for p in d.get("periodes") or [])
        lieu = (d.get("ville") + ", " if d.get("ville") else "") + d["departement"] + (" · partout en France" if d.get("partout") else "")
        sujet = f"Nouvelle demande : {POSTES.get(d['poste'], d['poste'])}, {lieu}"
        for sid in xs:
            st = structures.get(sid)
            if not st or not st.get("email_contact"):
                continue
            texte = (f"Bonjour,\n\n{d['prenom']} cherche un poste près de chez vous et sa demande vous est arrivée sur Fil Roug'Anim :\n\n"
                     f"{POSTES.get(d['poste'], d['poste'])}\n{lieu}{' · ' + quand if quand else ''}\n\n"
                     f"Elle n'est envoyée qu'à 3 structures au plus. Lisez-la et répondez directement depuis votre espace : {espace}\n\n"
                     f"L'équipe Fil Roug'Anim")
            html_c = ("<p>Bonjour,</p><p><b>" + html.escape(d["prenom"]) + "</b> cherche un poste près de chez vous et sa demande vous est arrivée sur Fil Roug'Anim :</p>"
                      "<p style=\"padding:12px 16px;border-left:3px solid #d61f35;background:#fbf8f2\"><b>" + html.escape(POSTES.get(d["poste"], d["poste"])) + "</b><br>"
                      + html.escape(lieu) + (" · " + html.escape(quand) if quand else "") + "</p>"
                      "<p>Elle n'est envoyée qu'à 3 structures au plus. Lisez-la et répondez directement :</p>"
                      "<p><a href=\"" + espace + "\" style=\"display:inline-block;background:#d61f35;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold\">Voir la demande</a></p>"
                      "<p style=\"color:#6b6264;font-size:13px\">Fil Roug'Anim · filrouganim.fr</p>")
            try:
                envoyer(cle_brevo, CONFIG.get("email_alertes") or CONFIG["email"], CONFIG["nom"], st["email_contact"], sujet, texte, html_c)
                print(f"Demande {d['id']} : {st['nom']} prévenue.")
            except Exception as e:
                print(f"Demande {d['id']} : e-mail à {st['nom']} non parti ({e}).")
                continue
        supabase("PATCH", f"demandes?id=eq.{d['id']}", cle_sb, {"notifiees": d["destinataires"]})


AIDES_NOMS = {"pass_colo": "Pass Colo", "vacaf": "VACAF", "cheques_vacances": "Chèques-Vacances", "ce": "CSE", "mairie": "aide de la mairie"}
BOUTON = "display:inline-block;background:#d61f35;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold"


def periode_fr(d, f):
    if not d:
        return ""
    a, b = dt.date.fromisoformat(d), dt.date.fromisoformat(f or d)
    return f"le {a:%d/%m/%Y}" if a == b else f"du {a:%d/%m} au {b:%d/%m/%Y}"


def demandes_sejours(cle_sb):
    """« Inscrire mon enfant » : à chaque demande de place, un accusé de réception à la famille et un e-mail à la
    structure. Les coordonnées de la famille ne sont jamais dans l'e-mail d'une structure qui n'a pas débloqué la demande."""
    try:
        # gardées un an au plus (politique de confidentialité)
        supabase("DELETE", "demandes_sejour?cree_le=lt." + (dt.date.today() - dt.timedelta(days=365)).isoformat(), cle_sb)
        supabase("DELETE", "besoins_familles?cree_le=lt." + (dt.date.today() - dt.timedelta(days=365)).isoformat(), cle_sb)
        lignes = supabase("POST", "rpc/demandes_a_prevenir", cle_sb, {}) or []
    except urllib.error.HTTPError as e:
        print(f"Demandes de séjour : non lues ({e.code})")
        return
    if not lignes:
        return
    cle_brevo = os.environ.get("BREVO_API_KEY", "").strip()
    if not cle_brevo:
        print(f"{len(lignes)} demande(s) de séjour à prévenir, mais BREVO_API_KEY est absente : rien n'est envoyé.")
        return
    sys.path.insert(0, str(RACINE / "outils"))
    from alertes import envoyer
    site = CONFIG["url"].rstrip("/")
    exp = CONFIG.get("email_alertes") or CONFIG["email"]
    pied = ("<p style=\"color:#6b6264;font-size:13px\">Vous recevez cet e-mail parce qu'une demande de place a été faite sur filrouganim.fr. "
            "Fil Roug'Anim transmet la demande, sans commission ; l'inscription se fait directement avec l'organisateur.</p>")
    for d in lignes:
        quand = periode_fr(d.get("debut"), d.get("fin"))
        url_sj = f"{site}/enfants/{d['structure_slug']}/{d['sejour_slug']}/"
        enfant = (d.get("enfant_prenom") or "votre enfant") + f" ({d['enfant_age']} ans)" + (f", {d['nb_enfants']} enfants" if (d.get("nb_enfants") or 1) > 1 else "")
        maj = {}
        if d["famille"]:
            sujet = f"Votre demande pour « {d['sejour']} » est bien partie"
            texte = (f"Bonjour {d['parent_nom']},\n\nVotre demande de place est bien arrivée chez {d['structure_nom']} :\n\n{d['sejour']}{' · ' + quand if quand else ''}\n{enfant}\n\n"
                     f"L'organisateur vous répond directement, en général sous quelques jours. Le séjour : {url_sj}\n\nL'équipe Fil Roug'Anim")
            html_c = (f"<p>Bonjour {html.escape(d['parent_nom'])},</p><p>Votre demande de place est bien arrivée chez <b>{html.escape(d['structure_nom'])}</b> :</p>"
                      f"<p style=\"padding:12px 16px;border-left:3px solid #d61f35;background:#fbf8f2\"><b>{html.escape(d['sejour'])}</b>{'<br>' + html.escape(quand) if quand else ''}<br>{html.escape(enfant)}</p>"
                      f"<p>L'organisateur vous répond directement, en général sous quelques jours.</p><p><a href=\"{url_sj}\" style=\"{BOUTON}\">Revoir le séjour</a></p>" + pied)
            try:
                envoyer(cle_brevo, exp, CONFIG["nom"], d["parent_email"], sujet, texte, html_c)
                maj["famille_prevenue_le"] = dt.datetime.now(dt.timezone.utc).isoformat()
            except Exception as e:
                print(f"Demande de séjour {d['id']} : accusé non parti ({e}).")
        if d["structure"] and d.get("structure_email"):
            espace = f"{site}/compte/?onglet=familles"
            aides = ", ".join(AIDES_NOMS.get(a, a) for a in d.get("aides") or [])
            sujet = f"Nouvelle demande pour « {d['sejour']} »"
            details = [f"{d['sejour']}{' · ' + quand if quand else ''}", f"Enfant de {d['enfant_age']} ans" + (f", {d['nb_enfants']} enfants" if (d.get("nb_enfants") or 1) > 1 else ""),
                       d.get("ville") or "", ("Aides : " + aides) if aides else ""]
            details = [x for x in details if x]
            if d["ouverte"]:
                contact = [d["parent_nom"], d["parent_email"], d.get("parent_telephone") or ""]
                fin_t = "Coordonnées : " + " · ".join(x for x in contact if x) + ("\nMessage : " + d["message"] if d.get("message") else "") + f"\n\nRépondez-lui directement, et retrouvez la demande dans votre espace : {espace}"
                fin_h = ("<p><b>" + html.escape(d["parent_nom"]) + "</b> · <a href=\"mailto:" + html.escape(d["parent_email"]) + "\">" + html.escape(d["parent_email"]) + "</a>"
                         + (" · " + html.escape(d["parent_telephone"]) if d.get("parent_telephone") else "") + "</p>"
                         + ("<blockquote style=\"margin:8px 0;padding:8px 12px;border-left:3px solid #ebe3d8\">" + html.escape(d["message"]) + "</blockquote>" if d.get("message") else "")
                         + f"<p>Répondez-lui directement (des réponses toutes prêtes sont dans votre espace).</p><p><a href=\"{espace}\" style=\"{BOUTON}\">Voir la demande</a></p>")
            else:
                fin_t = ("Vos 2 demandes gratuites sont utilisées : les coordonnées de cette famille sont masquées. "
                         f"Débloquez-les avec l'abonnement ou le Pass recrutement, sans engagement : {site}/compte/?onglet=abonnement")
                fin_h = ("<p>Vos 2 demandes gratuites sont utilisées : <b>les coordonnées de cette famille sont masquées</b>. Débloquez-les, avec toutes les demandes suivantes, "
                         "grâce à l'abonnement ou au Pass recrutement (sans engagement).</p>"
                         f"<p><a href=\"{site}/compte/?onglet=abonnement\" style=\"{BOUTON}\">Débloquer les demandes</a></p>")
            texte = f"Bonjour,\n\nUne famille demande une place sur Fil Roug'Anim :\n\n" + "\n".join(details) + "\n\n" + fin_t + "\n\nL'équipe Fil Roug'Anim"
            html_c = ("<p>Bonjour,</p><p>Une famille demande une place sur Fil Roug'Anim :</p><p style=\"padding:12px 16px;border-left:3px solid #d61f35;background:#fbf8f2\">"
                      + "<br>".join(html.escape(x) for x in details) + "</p>" + fin_h
                      + "<p style=\"color:#6b6264;font-size:13px\">Vous recevez cet e-mail parce que vous publiez vos séjours sur filrouganim.fr.</p>")
            try:
                envoyer(cle_brevo, exp, CONFIG["nom"], d["structure_email"], sujet, texte, html_c)
                maj["structure_prevenue_le"] = dt.datetime.now(dt.timezone.utc).isoformat()
            except Exception as e:
                print(f"Demande de séjour {d['id']} : e-mail à la structure non parti ({e}).")
        elif d["structure"]:
            maj["structure_prevenue_le"] = dt.datetime.now(dt.timezone.utc).isoformat()
        if maj:
            supabase("PATCH", f"demandes_sejour?id=eq.{d['id']}", cle_sb, maj)
            print(f"Demande de séjour {d['id']} : " + ", ".join(k.split("_")[0] for k in maj) + " prévenue(s).")


def alertes_sejours(cle_sb):
    """Les alertes séjours des parents : l'e-mail « Confirmez votre alerte » (double confirmation) ; les alertes non
    confirmées sont effacées au bout de 7 jours. (L'envoi des nouveautés, le jeudi, viendra avec les pages Google.)"""
    il_y_a_7j = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        supabase("DELETE", f"alertes_sejour?confirme_le=is.null&cree_le=lt.{il_y_a_7j}", cle_sb)
        il_y_a_un_an = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")
        supabase("DELETE", f"alertes_sejour?confirme_le=lt.{il_y_a_un_an}&or=(vu_le.is.null,vu_le.lt.{il_y_a_un_an})", cle_sb)
        lignes = supabase("GET", "alertes_sejour?select=id,email,jeton,criteres&confirme_le=is.null&confirmation_envoyee_le=is.null&order=cree_le&limit=200", cle_sb) or []
    except urllib.error.HTTPError as e:
        print(f"Alertes séjours : non lues ({e.code})")
        return
    if not lignes:
        return
    cle_brevo = os.environ.get("BREVO_API_KEY", "").strip()
    if not cle_brevo:
        print(f"{len(lignes)} alerte(s) séjours à confirmer, mais BREVO_API_KEY est absente.")
        return
    sys.path.insert(0, str(RACINE / "outils"))
    from alertes import envoyer
    site = CONFIG["url"].rstrip("/")
    for a in lignes:
        c = a.get("criteres") or {}
        resume = []
        if c.get("age"):
            resume.append(", ".join(x + " ans" for x in c["age"]))
        if c.get("periode"):
            resume.append(", ".join(c["periode"]).replace("aout", "août").replace("noel", "Noël"))
        if c.get("type"):
            resume.append("à la journée" if c["type"] == "journee" else "séjours avec nuits")
        if c.get("departement"):
            resume.append("département " + str(c["departement"]))
        resume = " · ".join(resume) or "tous les nouveaux séjours"
        lien = f"{site}/enfants/alerte/?confirmer={a['jeton']}"
        arret = f"{site}/enfants/alerte/?arreter={a['jeton']}"
        texte = (f"Bonjour,\n\nVous avez demandé à être prévenu des nouveaux séjours sur Fil Roug'Anim ({resume}).\n\n"
                 f"Confirmez votre adresse : {lien}\n\nSans confirmation, rien ne vous sera envoyé et l'alerte sera effacée dans 7 jours. "
                 f"Ce n'était pas vous ? Ignorez cet e-mail, ou arrêtez tout de suite : {arret}\n\nL'équipe Fil Roug'Anim")
        html_c = (f"<p>Bonjour,</p><p>Vous avez demandé à être prévenu des nouveaux séjours sur Fil Roug'Anim :</p>"
                  f"<p style=\"padding:12px 16px;border-left:3px solid #d61f35;background:#fbf8f2\">{html.escape(resume)}</p>"
                  f"<p><a href=\"{lien}\" style=\"{BOUTON}\">Confirmer mon alerte</a></p>"
                  f"<p>Un e-mail le jeudi au plus, seulement s'il y a du nouveau. Sans confirmation, rien ne vous sera envoyé et l'alerte sera effacée dans 7 jours.</p>"
                  f"<p style=\"color:#6b6264;font-size:13px\">Ce n'était pas vous ? Ignorez cet e-mail, ou <a href=\"{arret}\">arrêtez cette alerte</a>.</p>")
        try:
            envoyer(cle_brevo, CONFIG.get("email_alertes") or CONFIG["email"], CONFIG["nom"], a["email"], "Confirmez votre alerte séjours", texte, html_c)
            supabase("PATCH", f"alertes_sejour?id=eq.{a['id']}", cle_sb, {"confirmation_envoyee_le": dt.datetime.now(dt.timezone.utc).isoformat()})
        except Exception as e:
            print(f"Alerte séjours {a['id']} : confirmation non partie ({e}).")
    print(f"{len(lignes)} alerte(s) séjours : confirmation envoyée.")


PERIODES_SJ = {"hiver": [("02-01", "03-15")], "printemps": [("04-01", "05-15")], "juillet": [("07-01", "07-31")], "aout": [("08-01", "08-31")],
               "toussaint": [("10-15", "11-10")], "noel": [("12-18", "12-31"), ("01-01", "01-06")]}
BANDES_SJ = {"3-5": (3, 5), "6-8": (6, 8), "9-11": (9, 11), "12-14": (12, 14), "15-17": (15, 17)}


def sejours_publies(cle_sb):
    """Les séjours en ligne (structure vérifiée), avec leurs dates à venir et leur structure."""
    auj = dt.date.today().isoformat()
    sj = supabase("GET", "sejours?select=id,slug,titre,type,age_min,age_max,envies,ville,departement,pays,region_dest,prix_min,prix_unite,aides,cree_le,"
                         "structure_id,structures(nom,slug,verifiee)&statut=eq.publie", cle_sb) or []
    sj = [x for x in sj if (x.get("structures") or {}).get("verifiee")]
    if not sj:
        return []
    ds = supabase("GET", f"sejours_dates?select=sejour_id,debut,fin,places_restantes,complet&fin=gte.{auj}&order=debut&sejour_id=in.("
                         + ",".join(str(x["id"]) for x in sj) + ")", cle_sb) or []
    for x in sj:
        x["dates"] = [d for d in ds if d["sejour_id"] == x["id"]]
        x["url"] = CONFIG["url"].rstrip("/") + f"/enfants/{x['structures']['slug']}/{x['slug']}/"
    return [x for x in sj if x["dates"]]


def sejour_convient(x, c):
    """Le même filtre que la recherche de /enfants/ (statique/js/sejours.js), côté serveur."""
    if c.get("age") and not any(x["age_min"] <= BANDES_SJ[b][1] and x["age_max"] >= BANDES_SJ[b][0] for b in c["age"] if b in BANDES_SJ):
        return False
    journee = x["type"].startswith("accueil")
    if c.get("type") == "sejour" and journee or c.get("type") == "journee" and not journee:
        return False
    if c.get("envie") and not set(c["envie"]) & set(x.get("envies") or []):
        return False
    if c.get("departement") and x.get("departement") != c["departement"]:
        return False
    per = [k for k in c.get("periode") or [] if k != "mercredis"]
    if c.get("periode"):
        if x["type"] == "accueil_mercredis":
            return "mercredis" in c["periode"]
        def dedans(d):
            a_, b_ = d["debut"][5:], d["fin"][5:]
            return any((a_ <= pl[1] and b_ >= pl[0]) or (a_ > b_ and (pl[0] <= b_ or pl[1] >= a_)) for k in per for pl in PERIODES_SJ.get(k, []))
        if not any(dedans(d) for d in x["dates"]):
            return False
    return True


def carte_mail(x):
    d = x["dates"][0]
    prix = f" · dès {x['prix_min']:g} €" if x.get("prix_min") is not None else ""
    lieu = x.get("ville") or x.get("region_dest") or x.get("pays") or ""
    ligne = f"{x['age_min']}-{x['age_max']} ans · {lieu} · {periode_fr(d['debut'], d['fin'])}{prix}"
    return (f"{x['titre']} ({x['structures']['nom']})\n{ligne}\n{x['url']}",
            f"<p style=\"margin:0 0 14px;padding:12px 16px;border:1px solid #ebe3d8;border-radius:12px\"><a href=\"{x['url']}\" style=\"color:#a8162a;font-weight:bold;font-size:16px\">{html.escape(x['titre'])}</a><br>"
            f"<span style=\"color:#6b6264\">{html.escape(x['structures']['nom'])} · {html.escape(ligne)}</span></p>")


def sejours_relances(cle_sb):
    """Lot 8 des séjours (docs/PLAN-SEJOURS.md, parties 5 et 15) :
    - le jeudi, les nouveaux séjours aux parents qui ont une alerte confirmée (6 au plus, seulement s'il y a du nouveau) ;
    - 5 jours sans réponse à une demande : la famille reçoit 3 séjours proches ;
    - le lundi, les structures sans abonnement qui ont des demandes masquées reçoivent un rappel."""
    cle_brevo = os.environ.get("BREVO_API_KEY", "").strip()
    if not cle_brevo:
        return
    sys.path.insert(0, str(RACINE / "outils"))
    from alertes import envoyer
    site = CONFIG["url"].rstrip("/")
    exp = CONFIG.get("email_alertes") or CONFIG["email"]
    maintenant = dt.datetime.now(dt.timezone.utc)
    auj = dt.date.today()
    try:
        sejours = sejours_publies(cle_sb)
    except urllib.error.HTTPError as e:
        print(f"Séjours : non lus ({e.code})")
        return
    # 1. le jeudi : les alertes des parents
    if auj.weekday() == 3 and sejours:
        il_y_a_6j = (maintenant - dt.timedelta(days=6)).strftime("%Y-%m-%dT%H:%M:%SZ")
        alertes = supabase("GET", "alertes_sejour?select=id,email,jeton,criteres,confirme_le,dernier_envoi&confirme_le=not.is.null"
                                  f"&or=(dernier_envoi.is.null,dernier_envoi.lt.{il_y_a_6j})&limit=1000", cle_sb) or []
        envois_par_sejour = collections.Counter()
        for a in alertes:
            depuis = a.get("dernier_envoi") or a["confirme_le"]
            nouveaux = [x for x in sejours if x["cree_le"] > depuis and sejour_convient(x, a.get("criteres") or {})][:6]
            if not nouveaux:
                continue
            arret = f"{site}/enfants/alerte/?arreter={a['jeton']}"
            marque = f"alerte={a['jeton']}"
            cartes = [carte_mail(x) for x in nouveaux]
            cartes = [(t.replace(x["url"], x["url"] + "?" + marque), h.replace(x["url"], x["url"] + "?" + marque)) for (t, h), x in zip(cartes, nouveaux)]
            sujet = f"{len(nouveaux)} nouveau{'x' if len(nouveaux) > 1 else ''} séjour{'s' if len(nouveaux) > 1 else ''} pour vous"
            texte = "Bonjour,\n\nDe nouveaux séjours correspondent à votre alerte :\n\n" + "\n\n".join(c[0] for c in cartes) + f"\n\nTous les séjours : {site}/enfants/?{marque}\n\nArrêter cette alerte : {arret}"
            html_c = ("<p>Bonjour,</p><p>De nouveaux séjours correspondent à votre alerte :</p>" + "".join(c[1] for c in cartes)
                      + f"<p><a href=\"{site}/enfants/?{marque}\" style=\"{BOUTON}\">Voir tous les séjours</a></p>"
                      + f"<p style=\"color:#6b6264;font-size:13px\">Vous recevez cet e-mail parce que vous avez créé et confirmé une alerte sur filrouganim.fr. <a href=\"{arret}\">Arrêter cette alerte</a> en un clic.</p>")
            try:
                envoyer(cle_brevo, exp, CONFIG["nom"], a["email"], sujet, texte, html_c)
                supabase("PATCH", f"alertes_sejour?id=eq.{a['id']}", cle_sb, {"dernier_envoi": maintenant.isoformat()})
                for x in nouveaux:
                    envois_par_sejour[x["id"]] += 1
            except Exception as e:
                print(f"Alerte séjours {a['id']} : envoi raté ({e}).")
        for sid, n in envois_par_sejour.items():
            try:
                deja = supabase("GET", f"stats_sejours?select=n&jour=eq.{auj.isoformat()}&sejour_id=eq.{sid}&type=eq.alerte", cle_sb) or []
                if deja:
                    supabase("PATCH", f"stats_sejours?jour=eq.{auj.isoformat()}&sejour_id=eq.{sid}&type=eq.alerte", cle_sb, {"n": deja[0]["n"] + n})
                else:
                    supabase("POST", "stats_sejours", cle_sb, {"jour": auj.isoformat(), "sejour_id": sid, "type": "alerte", "n": n})
            except urllib.error.HTTPError as e:
                print(f"Statistiques d'alerte du séjour {sid} : non écrites ({e.code}).")
        if envois_par_sejour:
            print(f"Alertes séjours du jeudi : {sum(envois_par_sejour.values())} séjour(s) envoyé(s).")
    # 2. 5 jours sans réponse : 3 séjours proches à la famille (une seule fois)
    il_y_a_5j = (maintenant - dt.timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    il_y_a_20j = (maintenant - dt.timedelta(days=20)).strftime("%Y-%m-%dT%H:%M:%SZ")
    attente = supabase("GET", "demandes_sejour?select=id,sejour_id,parent_nom,parent_email,enfant_age,cree_le&statut=eq.nouvelle&relance_famille_le=is.null"
                              f"&cree_le=lt.{il_y_a_5j}&cree_le=gt.{il_y_a_20j}&limit=200", cle_sb) or []
    for d in attente:
        demande = next((x for x in sejours if x["id"] == d["sejour_id"]), None)
        proches = [x for x in sejours if x["id"] != d["sejour_id"] and x["age_min"] <= d["enfant_age"] <= x["age_max"]
                   and (not demande or (x["type"].startswith("accueil") == demande["type"].startswith("accueil")))]
        if demande:
            proches.sort(key=lambda x: (x.get("departement") != demande.get("departement"), abs((dt.date.fromisoformat(x["dates"][0]["debut"]) - dt.date.fromisoformat(demande["dates"][0]["debut"])).days)))
        proches = proches[:3]
        titre = demande["titre"] if demande else "votre séjour"
        lien_age = f"{site}/enfants/?age=" + next((b for b, r in BANDES_SJ.items() if r[0] <= d["enfant_age"] <= r[1]), "")
        texte = (f"Bonjour {d['parent_nom']},\n\nVotre demande pour « {titre} » n'a pas encore reçu de réponse. L'organisateur vous répondra sûrement, "
                 "mais en attendant, voici d'autres séjours pour le même âge :\n\n" + "\n\n".join(carte_mail(x)[0] for x in proches) + f"\n\nTous les séjours pour cet âge : {lien_age}")
        html_c = (f"<p>Bonjour {html.escape(d['parent_nom'])},</p><p>Votre demande pour « <b>{html.escape(titre)}</b> » n'a pas encore reçu de réponse. "
                  "L'organisateur vous répondra sûrement ; en attendant, voici d'autres séjours pour le même âge :</p>"
                  + ("".join(carte_mail(x)[1] for x in proches) or "<p>Pas d'autre séjour pour cet âge en ce moment.</p>")
                  + f"<p><a href=\"{lien_age}\" style=\"{BOUTON}\">Voir les séjours pour cet âge</a></p>"
                  + "<p style=\"color:#6b6264;font-size:13px\">Vous recevez cet e-mail une seule fois, à la suite de votre demande de place sur filrouganim.fr.</p>")
        try:
            envoyer(cle_brevo, exp, CONFIG["nom"], d["parent_email"], f"Pas encore de réponse pour « {titre} » ?", texte, html_c)
        except Exception as e:
            print(f"Relance famille {d['id']} : non partie ({e}).")
            continue
        supabase("PATCH", f"demandes_sejour?id=eq.{d['id']}", cle_sb, {"relance_famille_le": maintenant.isoformat()})
    # 3. le lundi : les structures sans abonnement qui ont des demandes masquées
    if auj.weekday() == 0:
        fermees = supabase("GET", "demandes_sejour?select=structure_id&ouverte=eq.false", cle_sb) or []
        nb = collections.Counter(x["structure_id"] for x in fermees)
        if nb:
            sts = supabase("GET", "structures?select=id,nom,email_contact,abonnement_fin,rappel_demandes_le&id=in.(" + ",".join(nb) + ")", cle_sb) or []
            for st in sts:
                if (st.get("abonnement_fin") or "") >= auj.isoformat() or st.get("rappel_demandes_le") == auj.isoformat() or not st.get("email_contact"):
                    continue
                n = nb[st["id"]]
                lien = f"{site}/compte/?onglet=abonnement"
                sujet = f"{n} famille{'s' if n > 1 else ''} vous {'attendent' if n > 1 else 'attend'} sur Fil Roug'Anim"
                texte = (f"Bonjour,\n\n{n} demande{'s' if n > 1 else ''} de place pour vos séjours {'attendent' if n > 1 else 'attend'} votre réponse, avec les coordonnées masquées. "
                         f"Débloquez-les avec l'abonnement ou le Pass recrutement (sans engagement) : {lien}\n\nL'équipe Fil Roug'Anim")
                html_c = (f"<p>Bonjour,</p><p><b>{n} demande{'s' if n > 1 else ''} de place</b> pour vos séjours {'attendent' if n > 1 else 'attend'} votre réponse. "
                          "Les familles ne savent pas encore si vous avez de la place : leurs coordonnées sont masquées tant que les demandes ne sont pas débloquées.</p>"
                          f"<p><a href=\"{lien}\" style=\"{BOUTON}\">Débloquer les demandes</a></p>"
                          "<p>L'abonnement, ou le Pass recrutement (1 à 3 mois, sans engagement), affiche toutes les demandes, les nouvelles comme les anciennes.</p>"
                          "<p style=\"color:#6b6264;font-size:13px\">Vous recevez ce rappel le lundi, tant que des demandes vous attendent. Il s'arrête dès qu'elles sont débloquées.</p>")
                try:
                    envoyer(cle_brevo, exp, CONFIG["nom"], st["email_contact"], sujet, texte, html_c)
                    supabase("PATCH", f"structures?id=eq.{st['id']}", cle_sb, {"rappel_demandes_le": auj.isoformat()})
                    print(f"Rappel du lundi : {st['nom']} ({n} demande(s) masquée(s)).")
                except Exception as e:
                    print(f"Rappel du lundi à {st['nom']} : non parti ({e}).")


TYPES_EVT = {"profil": ("Nouvelle fiche animateur", "Nouvelles fiches animateurs"), "structure": ("Nouvelle structure", "Nouvelles structures"),
             "paiement": ("Abonnement payé", "Abonnements payés"), "demande": ("Nouvelle demande (annuaire inversé)", "Nouvelles demandes (annuaire inversé)"),
             "organisme": ("Organisme intéressé par la formule partenaire", "Organismes intéressés par la formule partenaire"),
             "sejour": ("Demande de place en séjour", "Demandes de place en séjour")}


def prevenir_admin(cle_sb):
    """Un seul e-mail à l'adresse du site quand il y a du neuf : fiches animateurs, structures, paiements, demandes
    (la base les note d'elle-même dans evenements_admin ; chaque événement n'est envoyé qu'une fois)."""
    try:
        evts = supabase("GET", "evenements_admin?select=id,type,resume,cree_le&envoye=is.false&order=cree_le", cle_sb) or []
    except urllib.error.HTTPError as e:
        print(f"Événements admin : non lus ({e.code})")
        return
    if not evts:
        return
    cle_brevo = os.environ.get("BREVO_API_KEY", "").strip()
    if not cle_brevo:
        print(f"{len(evts)} événement(s) pour l'administration, mais BREVO_API_KEY est absente : rien n'est envoyé.")
        return
    sys.path.insert(0, str(RACINE / "outils"))
    from alertes import envoyer
    groupes = {}
    for e in evts:
        groupes.setdefault(e["type"], []).append(e)
    titres = [f"{len(v)} {TYPES_EVT[k][1 if len(v) > 1 else 0].lower()}" for k, v in groupes.items()]
    sujet = "Fil Roug'Anim : " + ", ".join(titres)
    admin = CONFIG["url"].rstrip("/") + "/compte/?role=admin"
    texte, html_c = [], []
    for k in ["organisme", "paiement", "structure", "profil", "demande", "sejour"]:
        if k not in groupes:
            continue
        texte.append(TYPES_EVT[k][1 if len(groupes[k]) > 1 else 0] + " :")
        html_c.append("<h3 style=\"margin:18px 0 6px\">" + html.escape(TYPES_EVT[k][1 if len(groupes[k]) > 1 else 0]) + "</h3><ul style=\"margin:0;padding-left:18px\">")
        for e in groupes[k]:
            quand = dt.datetime.fromisoformat(e["cree_le"].replace("Z", "+00:00")).astimezone(dt.timezone(dt.timedelta(hours=1))).strftime("%d/%m à %H:%M")
            texte.append(f"- {e['resume']} ({quand})")
            html_c.append("<li>" + html.escape(e["resume"]) + " <span style=\"color:#8a7d76\">(" + quand + ")</span></li>")
        html_c.append("</ul>")
        texte.append("")
    texte.append("Tout voir dans l'espace admin : " + admin)
    html_c.append("<p style=\"margin-top:20px\"><a href=\"" + admin + "\" style=\"display:inline-block;background:#d61f35;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:bold\">Ouvrir l'espace admin</a></p>")
    try:
        envoyer(cle_brevo, CONFIG.get("email_alertes") or CONFIG["email"], CONFIG["nom"], CONFIG["email"], sujet, "\n".join(texte), "".join(html_c))
    except Exception as e:
        print(f"E-mail à l'administration non parti ({e}).")
        return
    supabase("PATCH", "evenements_admin?id=in.(" + ",".join(str(e["id"]) for e in evts) + ")", cle_sb, {"envoye": True})
    print(f"Administration prévenue : {sujet}")


if __name__ == "__main__":
    # les demandes partent même si Stripe ne répond pas (clé expirée, panne) : les relevés sont indépendants
    erreurs = []
    cle = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    def ranger_cle():
        # la clé d'envoi des e-mails, rangée dans le coffre-fort de la base : les e-mails des séjours partent alors tout de
        # suite (accusé de réception, demande à la structure, confirmation d'alerte) au lieu d'attendre ce relevé
        k = os.environ.get("BREVO_API_KEY", "").strip()
        if k and cle and "--essai" not in sys.argv:
            supabase("POST", "rpc/ranger_cle_envoi", cle, {"k": k})
        # la clé de lecture Stripe, au même endroit : le relais supabase/functions/stripe relit chaque paiement que Stripe
        # lui signale et l'applique tout de suite (sans attendre ce relevé, que GitHub ne lance que toutes les 4 à 8 heures)
        ks = os.environ.get("STRIPE_ABONNEMENTS_KEY", "").strip()
        if ks and cle and "--essai" not in sys.argv:
            try:
                supabase("POST", "rpc/ranger_cle_stripe", cle, {"k": ks})
            except urllib.error.HTTPError as e:
                print(f"Clé Stripe non rangée ({e.code}) : les paiements attendent ce relevé.")
    for etape in (ranger_cle, main, lambda: None if "--essai" in sys.argv or not cle else demandes(cle),
                  lambda: None if "--essai" in sys.argv or not cle else demandes_sejours(cle),
                  lambda: None if "--essai" in sys.argv or not cle else alertes_sejours(cle),
                  lambda: None if "--essai" in sys.argv or not cle else sejours_relances(cle),
                  lambda: None if "--essai" in sys.argv or not cle else prevenir_admin(cle)):
        try:
            etape()
        except urllib.error.HTTPError as e:
            erreurs.append(f"Erreur {e.code} : {e.read().decode('utf-8', 'replace')[:300]}")
            print(erreurs[-1])
    if erreurs:
        sys.exit("\n".join(erreurs))
