# Les comptes (candidats et structures) avec Supabase

Choix du 25/10/2026 : chacun crée son compte et publie lui-même son annonce ou son profil.
Connexion par **lien magique** (un lien reçu par e-mail, pas de mot de passe).

## Ce qui est prévu

- **Candidats** (stagiaires BAFA, animateurs, BPJEPS, DEJEPS…) : compte gratuit, profil
  (département, diplômes, disponibilités, courte présentation). Le profil n'est visible que par
  les **structures inscrites et vérifiées**, jamais par le public ni par Google. 16 ans minimum.
- **Structures** : compte, fiche de la structure, offres créées et modifiées par elles-mêmes.
  Une structure est **vérifiée à la main** avant de voir les profils (SIRET ou n° de déclaration).
- Les **offres** sont publiques ; une copie statique est fabriquée chaque jour sur le site
  (données JobPosting pour Google pour l'emploi).
- Paiement des structures (Stripe) : **plus tard**, après la déclaration de la micro-entreprise.

## Étape 1 : créer le projet (Pufu2, 10 minutes)

1. Aller sur https://supabase.com, « Start your project », se connecter avec le compte GitHub
   Pufu2 (pas de Gmail visible sur le site).
2. « New project » : nom `filrouganim`, mot de passe de base de données **généré** (le garder
   dans un gestionnaire de mots de passe, ne jamais l'envoyer), région **Europe (Paris)**
   ou à défaut Frankfurt, offre **Free**.
3. Authentication → Sign In / Providers : garder **Email** activé ; désactiver
   « Allow new users to sign up » n'est pas nécessaire.
4. Authentication → URL Configuration :
   - Site URL : `https://filrouganim.fr`
   - Redirect URLs : `https://filrouganim.fr/**` et `http://localhost:8765/**` (pour les tests)
5. Project Settings → API Keys : copier l'**URL du projet** (`https://xxxx.supabase.co`) et la
   **clé publishable** (`sb_publishable_…`, ou « anon public » sur les anciens projets).
   **Ne jamais copier ni envoyer la clé secrète** (`sb_secret_…` / « service_role »).
6. M'envoyer ces deux valeurs (l'URL et la clé publishable sont faites pour être publiques :
   la sécurité vient des règles de la base, que j'écris).

## Étape 2 : les e-mails de connexion

Le service d'e-mail fourni par Supabase est limité à quelques e-mails par heure : bien pour
tester, pas pour ouvrir au public. Avant l'ouverture : Authentication → Emails → SMTP Settings,
avec le SMTP de **Brevo** (déjà utilisé pour Jeuphorie). Je donnerai les étapes à ce moment-là.

## Ce que je fais ensuite (Claude)

- Les tables `profils`, `structures`, `offres` et leurs règles d'accès (RLS) dans un fichier
  `supabase/schema.sql` que vous collez dans SQL Editor (je ne peux pas me connecter à votre
  compte).
- Les pages `/compte/` (connexion), `/compte/profil/`, `/compte/structure/`, `/compte/offres/`.
- La mise à jour des pages Confidentialité, Conditions d'utilisation et Trouver un poste.

## Données personnelles (à respecter)

- Supabase est le **sous-traitant** : le nommer dans la page Confidentialité, avec la région.
- Chacun peut modifier ou **supprimer son compte** lui-même.
- Compte candidat supprimé après 2 ans sans connexion (e-mail de rappel avant).
- Pas de photo, pas de date de naissance complète (une case « j'ai 16 ans ou plus »),
  pas de numéro de téléphone dans les profils ; pas de données de santé.
