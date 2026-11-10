# Les comptes (candidats et structures) avec Supabase

Choix du 25/10/2026 : chacun crée son compte et publie lui-même son annonce ou son profil.
Connexion avec **Google**, avec un **e-mail et un mot de passe**, ou par **lien magique** (depuis la version 4).

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

## Version 2 (25/10/2026, soir) : relancer le fichier

`supabase/schema.sql` a été complété : **candidatures** (un candidat postule avec son profil, la
structure répond vue / retenue / non retenue), **favoris** des structures, profils plus complets
(poste recherché, ville, dates de disponibilité, expériences, activités, permis B), offres plus
précises (type d'accueil, nombre de postes, âge des enfants), et purge mensuelle des comptes
inactifs. Le relancer (SQL Editor > coller > Run) : les données déjà saisies sont gardées.
Testé sur une copie locale : mise à jour depuis la version 1 avec des données, puis les règles
(un candidat ne peut pas changer le statut de sa candidature, ni postuler à une offre d'une
structure non vérifiée ; une structure non vérifiée ne voit ni candidature ni profil).

## Version 3 (26/10/2026) : relancer encore le fichier

Ajouts : les pages publiques des structures (adresse, accroche, couleur, publics, activités,
lieux, projet, ce qui est offert à l'équipe), toute la France (et plus seulement l'Île-de-France),
les alertes du lundi et leur lien de désabonnement. Même manipulation : SQL Editor > coller > Run.

## Les alertes du lundi (quand Brevo sera prêt)

`outils/alertes.py` envoie chaque lundi, à chaque candidat qui l'a demandé, les nouvelles offres de
son secteur (`.github/workflows/alertes.yml`). Sans les deux secrets ci-dessous, il ne fait rien.
1. Brevo : créer une clé d'API (SMTP & API > Clés API) et valider l'adresse d'envoi
   `alertes@filrouganim.fr` (domaine filrouganim.fr à authentifier dans Brevo : enregistrements DNS
   à ajouter chez OVHcloud).
2. GitHub, dépôt filrouganim : Settings > Secrets and variables > Actions > New repository secret :
   `BREVO_API_KEY` (la clé Brevo) et `SUPABASE_SECRET_KEY` (Supabase > Project Settings > API Keys >
   la clé secrète). Ces clés ne doivent être collées que là, jamais dans une conversation ni un fichier.
3. Tester : onglet Actions > « Alertes du lundi » > Run workflow.

## Vérifier une structure (à chaque nouvelle structure)

1. **Table Editor**, table `structures` : la nouvelle ligne a `verifiee` à `false`.
2. Contrôler le SIRET sur https://annuaire-entreprises.data.gouv.fr (ou le RNA d'une association),
   et que l'e-mail de recrutement correspond bien à la structure.
3. Si c'est bon : passer `verifiee` à `true` (et `fondatrice` à `true` tant qu'il reste des places
   fondateurs ; augmenter alors `fondateurs.reservees` dans config.yml).
4. Ses offres arrivent sur le site dans l'heure (le site se refabrique toutes les heures).

## Les e-mails de connexion (en place le 26/10/2026)

Envoyés par Brevo (SMTP, expéditeur `connexion@filrouganim.fr`), en français, 30 par heure au plus.
Réglés par `outils/configurer_emails.py` (onglet Actions > « Configurer les e-mails de connexion »),
avec les secrets `SUPABASE_ACCESS_TOKEN` (jeton de 7 jours : Project Settings et Auth en écriture,
projet filrouganim seulement), `BREVO_SMTP_LOGIN` et `BREVO_SMTP_KEY`. Les textes sont dans
`supabase/emails/`. Pour les changer : modifier les fichiers, créer un nouveau jeton, le mettre
dans le secret, relancer l'action.

## Ouverture des comptes au public (`comptes_ouverts: true`, le 26/10/2026)

1. ~~Envoi des e-mails par Brevo et textes en français~~ : fait le 26/10/2026.
3. Mentions légales : éditeur non professionnel (identité détenue par l'hébergeur, LCEN art. 6) ;
   à compléter (nom, adresse, SIREN) avant tout paiement. Confidentialité : Brevo ajouté pour les
   e-mails de connexion.
4. Vérifier que la purge des comptes inactifs (2 ans) est programmée : SQL Editor,
   `select jobname, schedule from cron.job;` doit montrer `purger-comptes-inactifs`. Sinon :
   Database > Extensions > activer **pg_cron**, puis relancer `supabase/schema.sql`.
5. Tester soi-même : un compte structure, une offre, un compte candidat.

Restent à faire par Pufu2 : les points 4 et 5. Pour refermer : `comptes_ouverts: false`.

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
- Compte supprimé après 2 ans sans connexion (fonction `purger_comptes_inactifs`, chaque mois).
- Pas de photo, pas de date de naissance complète (une case « j'ai 16 ans ou plus »),
  pas de numéro de téléphone dans les profils ; pas de données de santé.

## Version 4 (10/11/2026) : Google, mot de passe, CV, photos

La création de compte se fait sur le site, comme sur jasonmarinho.com : on choisit son profil
(animateur, directeur, structure), puis **« Continuer avec Google »** ou une adresse e-mail et un
**mot de passe**. Le lien de connexion par e-mail reste possible (« Recevoir plutôt un lien »).
Ensuite, le profil ou la fiche se remplit **étape par étape**, avec l'aperçu de la carte à droite.

Nouveau dans la base (fin de `supabase/schema.sql`, « version 4 ») : la colonne `cv_nom` des
profils, `logo` et `photos` des structures, et deux espaces de stockage :
- `cv` (privé) : `<identifiant>/cv.pdf`, 2 Mo au plus, lisible par le candidat, par les structures
  vérifiées (si le profil est visible) et par celles à qui il a postulé ;
- `structures` (public) : logo et 5 photos au plus, en JPEG (réduits dans le navigateur).

### Activer « Continuer avec Google » (Pufu2, 10 minutes)

1. https://console.cloud.google.com, le projet déjà utilisé pour la Search Console.
2. « API et services » → « Écran de consentement OAuth » : type **Externe**, nom
   « Fil Roug'Anim », e-mail d'assistance, logo facultatif, domaine autorisé `filrouganim.fr`
   (et `supabase.co`). Champs d'application : seulement `email`, `profile`, `openid`.
   Puis « Publier l'application » (sinon seuls les comptes de test peuvent se connecter).
3. « Identifiants » → « Créer des identifiants » → « ID client OAuth » → « Application Web » :
   - Origines JavaScript autorisées : `https://filrouganim.fr`
   - URI de redirection autorisés : `https://abjimkhwbuhsfdnhweyy.supabase.co/auth/v1/callback`
4. Copier l'**ID client** et le **code secret** **directement** dans Supabase → Authentication →
   Sign In / Providers → **Google** → activer, coller, enregistrer. (Ne jamais les envoyer par
   message.)
5. Supabase → Authentication → Emails → modèle « Reset Password » : objet
   « Votre nouveau mot de passe Fil Roug'Anim », contenu = `supabase/emails/nouveau-mot-de-passe.html`.

Tant que Google n'est pas activé, le bouton affiche « La connexion avec Google arrive bientôt » :
l'e-mail et le mot de passe marchent déjà.

## Version 5 (10/11/2026) : l'abonnement des structures et les centres

- **Prix** : 79 €/an, chaque centre en plus 39,50 € ; fondateurs (10 premières) 39,50 € et 19,75 €, à vie.
  Un tarif dégressif par formule dans Stripe (compte « Fil Roug'Anim », séparé de Jeuphorie), produit « Fil Roug'Anim · Espace
  structure » ; la quantité payée = le nombre de centres. Liens de paiement dans `config.yml` (`abonnement`) ;
  le lien fondateur se ferme tout seul après 10 paiements.
- **En ligne** = structure vérifiée ET abonnement en cours (`abonnement_fin`). Les fonctions `est_verifiee`,
  `structure_verifiee` et `offre_en_ligne` en tiennent compte : sans abonnement, ni page, ni offres, ni profils.
- **Relevé** : `outils/abonnements.py`, toutes les 15 minutes (`.github/workflows/abonnements.yml`). Il lit Stripe
  et écrit `abonnement_fin`, `abonnement_id`, `centres_payes`, `fondatrice` avec la clé serveur.

### À faire une fois (Pufu2)

1. Dans le compte Stripe **Fil Roug'Anim** : Développeurs → Clés API → **Créer une clé restreinte** « Fil Roug'Anim abonnements » :
   *Checkout Sessions* en lecture, *Subscriptions* en lecture, rien d'autre. La coller directement dans GitHub →
   dépôt filrouganim → Settings → Secrets → Actions → `STRIPE_ABONNEMENTS_KEY`.
2. Stripe → Paramètres → Facturation → **Portail client** : autoriser « Mettre à jour les quantités » et
   « Annuler l'abonnement » pour le produit « Fil Roug'Anim · Espace structure ».
3. Stripe → Paramètres → Facturation → Abonnements et e-mails : activer **« Envoyer un rappel avant le renouvellement »**
   (au moins 30 jours avant), comme le promettent les conditions de vente.

### Payer sur facture (mairie, association)

La structure demande une facture par e-mail (bouton dans « Mon espace », avec la référence de son compte).
Dans Stripe : Abonnements → Créer un abonnement → client (avec son adresse et son SIRET), prix « Fil Roug'Anim »
(standard ou fondateur), quantité = nombre de centres, **Envoyer une facture** (paiement sous 30 jours), et dans
les métadonnées : `site` = `filrouganim`, `structure_id` = la référence du compte, `formule` = `standard` ou
`fondateur`. Le relevé fait le reste.

### Vérifier une structure

Table Editor → structures → `verifiee` = true, après avoir contrôlé le SIRET, le RNA ou le n° de déclaration.
