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
   dans un gestionnaire de mots de passe, ne jamais l'envoyer), région **West EU (Paris)**,
   offre **Free** (lien « Need a specific region? » pour choisir Paris).
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

## Étape 3 : créer les tables (Pufu2, 2 minutes)

1. Dans Supabase, menu de gauche : **SQL Editor**, puis **New query**.
2. Ouvrir le fichier `supabase/schema.sql` du dépôt (sur GitHub : bouton « Copy raw file »),
   coller tout le contenu, puis **Run**. Le message attendu : « Success. No rows returned ».
   Supabase peut prévenir que la requête contient des opérations « destructives » (les
   `drop policy` qui remplacent les règles) : c'est normal, confirmer.
3. Le fichier peut être relancé sans danger après une mise à jour : les données restent.

Ce que les règles garantissent (testé sur une copie locale de la base le 25/10/2026) :
- le public et Google voient les offres en ligne des structures vérifiées, rien d'autre ;
- une structure ne peut pas se vérifier elle-même, ni écrire une offre au nom d'une autre ;
- un profil de candidat n'est lisible que par son auteur et par les structures vérifiées ;
- un compte est soit candidat, soit structure ;
- « Supprimer mon compte » efface le compte et toutes ses données.

## Vérifier une structure (à chaque nouvelle structure)

1. **Table Editor**, table `structures` : la nouvelle ligne a `verifiee` à `false`.
2. Contrôler le SIRET sur https://annuaire-entreprises.data.gouv.fr (ou le RNA d'une association),
   et que l'e-mail de recrutement correspond bien à la structure.
3. Si c'est bon : passer `verifiee` à `true` (et `fondatrice` à `true` tant qu'il reste des places
   fondateurs ; augmenter alors `fondateurs.reservees` dans config.yml).
4. Ses offres arrivent sur le site dans l'heure (le site se refabrique toutes les heures).

## Avant d'ouvrir les comptes au public (`comptes_ouverts: true` dans config.yml)

1. Envoi des e-mails par **Brevo** (SMTP) : Authentication > Emails > SMTP Settings.
2. Modèle de l'e-mail « Magic Link » en français (Authentication > Emails > Templates).
3. Mentions légales complètes (éditeur), et relecture des pages Confidentialité et Conditions.
4. Suppression des comptes sans connexion depuis 2 ans (promise dans la page Confidentialité) :
   une tâche mensuelle à mettre en place.
5. Tester soi-même : un compte structure, une offre, un compte candidat.

Jusque-là, la page `/compte/` existe pour les essais, mais le site n'y renvoie pas.

## Ce qui est en place (25/10/2026)

- Projet Supabase `filrouganim`, région Paris (eu-west-3), offre gratuite ; URL et clé publishable
  dans config.yml.
- `supabase/schema.sql` : les tables `structures`, `profils`, `offres` et leurs règles d'accès.
- La page `/compte/` (gabarit `compte.html`, script `statique/js/compte.js`, bibliothèque
  supabase-js 2.117.3 servie par le site lui-même) : connexion par lien, choix candidat ou
  structure, profil, fiche de structure, offres, liste des candidats pour les structures
  vérifiées, déconnexion, suppression du compte.
- `build.py` lit les offres en ligne (lecture publique) et fabrique une page par offre, avec les
  données JobPosting. Le texte écrit par les structures est affiché sans HTML.
- Pages Trouver un poste, Recruter, accueil, Confidentialité et Conditions mises à jour.

## Données personnelles (à respecter)

- Supabase est le **sous-traitant** : le nommer dans la page Confidentialité, avec la région.
- Chacun peut modifier ou **supprimer son compte** lui-même.
- Compte candidat supprimé après 2 ans sans connexion (e-mail de rappel avant).
- Pas de photo, pas de date de naissance complète (une case « j'ai 16 ans ou plus »),
  pas de numéro de téléphone dans les profils ; pas de données de santé.
