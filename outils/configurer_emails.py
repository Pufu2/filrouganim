#!/usr/bin/env python3
"""Règle les e-mails de connexion de Supabase : envoi par Brevo (SMTP) et textes en français.

Lancé une fois depuis GitHub (onglet Actions > « Configurer les e-mails de connexion »), avec trois secrets :
    SUPABASE_ACCESS_TOKEN  jeton personnel Supabase (Account > Access Tokens), à supprimer ensuite
    BREVO_SMTP_LOGIN       l'identifiant SMTP de Brevo (xxxx@smtp-brevo.com)
    BREVO_SMTP_KEY         une clé SMTP de Brevo (pas la clé API)
Les textes des e-mails sont dans supabase/emails/. Relancer l'outil après les avoir modifiés.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent


def main():
    config = yaml.safe_load((RACINE / "config.yml").read_text(encoding="utf-8"))
    projet = re.match(r"https://([a-z0-9]+)\.supabase\.co", config["supabase"]["url"]).group(1)
    jeton = (os.environ.get("SUPABASE_ACCESS_TOKEN") or "").strip()
    login = (os.environ.get("BREVO_SMTP_LOGIN") or "").strip()
    cle = (os.environ.get("BREVO_SMTP_KEY") or "").strip()
    manque = [n for n, v in [("SUPABASE_ACCESS_TOKEN", jeton), ("BREVO_SMTP_LOGIN", login), ("BREVO_SMTP_KEY", cle)] if not v]
    if manque:
        sys.exit(f"Secrets manquants dans GitHub : {', '.join(manque)}")
    emails = RACINE / "supabase" / "emails"
    reglages = {
        "smtp_admin_email": config["email_connexion"], "smtp_sender_name": config["nom"],
        "smtp_host": "smtp-relay.brevo.com", "smtp_port": "587", "smtp_user": login, "smtp_pass": cle,
        "smtp_max_frequency": 60,
        "rate_limit_email_sent": 30,
        "mailer_subjects_magic_link": "Ton lien de connexion à Fil Roug'Anim",
        "mailer_templates_magic_link_content": (emails / "magic-link.html").read_text(encoding="utf-8"),
        "mailer_subjects_confirmation": "Bienvenue sur Fil Roug'Anim : confirme ton adresse",
        "mailer_templates_confirmation_content": (emails / "confirmation.html").read_text(encoding="utf-8"),
    }
    req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{projet}/config/auth",
                                 data=json.dumps(reglages).encode(), method="PATCH",
                                 headers={"Authorization": f"Bearer {jeton}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            rendu = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase refuse les réglages ({e.code}) : {e.read().decode(errors='ignore')[:500]}")
    print("Réglages enregistrés :")
    for k in ["smtp_host", "smtp_port", "smtp_admin_email", "smtp_sender_name", "rate_limit_email_sent",
              "mailer_subjects_magic_link", "mailer_subjects_confirmation"]:
        print(f"  {k} = {rendu.get(k)}")


if __name__ == "__main__":
    main()
