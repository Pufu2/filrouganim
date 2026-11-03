# Jobanim et Fil Roug'Anim : analyse et feuille de route

Analyse du 25/10/2026, à partir des captures envoyées par Pufu2 (espace candidat, espace
recruteur, dépôt d'offre, planning, taux d'encadrement) et des pages publiques
jobanim.com/page-formations.html et jobanim.net (lues le 25/10/2026, robots.txt respectés).
But : s'inspirer de ce qui marche, ne rien copier (ni textes, ni mise en page, ni nom de
fonction), et faire mieux là où Fil Roug'Anim a un avantage réel.

## 1. Ce que fait Jobanim

**Côté candidat** (page « Déposer un CV »)
- Photo **obligatoire**, poste recherché, prénom, téléphone, **sexe**, **date de naissance**,
  code postal, ville, pays, un « mood » obligatoire (badge de style d'animation).
- Activités et langues en étiquettes, diplômes BAFA, BAFD, BPJEPS, CPJEPS, DEJEPS, DESJEPS
  (3 au plus), autres diplômes, permis B, séjours handicap, animation d'événements, SIRET.
- Disponibilités (dates + période). Une case d'accord : le profil peut être envoyé par e-mail à
  des structures, **même sans compte chez Jobanim**.

**Côté recruteur** (espace recruteur)
- Recherche de candidats (« CVthèque »), favoris, mes offres, publier une offre.
- **3 contacts candidats offerts**, puis des « Pass » payants pour en avoir plus (jusqu'à 20 par
  jour) ; l'offre gratuite diffuse les informations essentielles, le Pass ajoute logo,
  description et modalités de candidature.
- Compteurs de candidatures reçues (7 jours, 3 jours, 24 h).
- Outils annexes : planning des équipes (bêta), formation des équipes (livre + parcours
  numérique, payant, « accès temporairement fermé »), ressources, calculateur de taux
  d'encadrement.
- Dépôt d'offre très long : logo, nombre de postes, dates, code postal, distance, type
  d'accueil, internat, hébergement, thème, âges du public, spécificité, contrat, heures, salaire
  brut ou net, devise, période, comment postuler, description.

**jobanim.net** : un second site de ressources (jeux connectés, outils de jeu, jeux de plateau,
« AnimPedia », un livre de réglementation).

## 2. Leurs faiblesses (nos occasions)

| Jobanim | Risque ou défaut | Fil Roug'Anim |
|---|---|---|
| Photo, sexe, date de naissance obligatoires | Collecte excessive pour des mineurs (RGPD, minimisation) ; critères qu'un recruteur n'a pas le droit d'utiliser (code du travail, L1132-1) | Ni photo, ni sexe, ni date de naissance : une case « 16 ans ou plus ». Un profil sans biais. |
| Profil envoyé par e-mail à des structures « même sans compte » | Le jeune ne sait pas qui a ses données | Profil visible **uniquement** des structures **vérifiées à la main** (SIRET), et des structures à qui il a postulé. Il le cache ou le supprime en un clic. |
| Contacts limités puis payants | Le recruteur paie pour joindre un jeune ; frustrant | Prix simple pour la structure (pass saison ou année, moitié prix à vie pour les fondateurs), sans compteur de contacts. |
| Deux sites, beaucoup de rubriques | On se perd | Un seul fil : se former, trouver un poste, recruter. |
| Formulaires très longs | Abandon en cours de route | Formulaires courts ; seuls les champs utiles au recrutement. |
| Pas d'annuaire des sessions de formation (vu le 25/10/2026) | Le jeune doit chercher son BAFA ailleurs | **131 sessions** BAFA, BAFD, CPJEPS, BPJEPS, DEJEPS en Île-de-France, vérifiées chaque semaine : c'est là que le jeune arrive en premier. |
| Outils sans sources visibles | On ne sait pas si c'est à jour | Chaque outil cite l'article du code et la date de lecture. |

## 3. Ce qui est fait aujourd'hui (25/10/2026)

**Comptes** (Supabase, en essai, `comptes_ouverts: false`)
- Candidat : profil enrichi (poste recherché, ville facultative, dates de disponibilité,
  expériences : moins de 6 ans, ados, handicap, séjours, itinérance, étranger, périscolaire,
  direction, baignade ; activités et talents ; permis B).
- **Postuler en un clic** avec son profil, plus un message ; **suivi** de chaque candidature
  (envoyée, vue, retenue, non retenue) ; possibilité de la retirer.
- **Les offres pour toi** : les offres en ligne de son département et des départements où il
  peut travailler, directement dans son espace.
- Structure : **tableau de bord** (offres en ligne, candidatures dont nouvelles, favoris),
  **candidatures reçues** avec le profil complet et un statut à choisir (le candidat le voit),
  **favoris**, filtres des candidats (département, diplôme, recherche, favoris).
- Offres plus précises : type d'accueil, nombre de postes, âge des enfants.
- Page d'offre : bouton « Postuler avec mon profil » (quand les comptes seront ouverts).

**Outils gratuits, sans compte** (`/outils/`), utiles aux deux publics et bons pour Google :
- **Taux d'encadrement** : séjour, extrascolaire, périscolaire (5 h ou moins / plus), PEDT,
  mini-camp ; nombre d'animateurs, de diplômés, de non-diplômés possibles, adjoints au-delà de
  100 mineurs. Source : CASF R227-1, R227-12 à R227-20 (édition du 23/10/2026).
- **Contrat d'engagement éducatif** : minimum 4,30 × Smic horaire = 52,93 € brut par jour,
  plafond de 80 jours sur 12 mois, repos. Sources : CASF L432-4 à L432-6, D432-2 à D432-4 ;
  Service-Public (Smic 12,31 €/h).
- **Mon parcours BAFA** : dates limites (stage pratique dans les 18 mois, BAFA en 30 mois), avec
  un lien vers les approfondissements. C'est le pont entre « se former » et « trouver un poste »,
  que Jobanim n'a pas.

## 4. Propositions pour la suite (à valider par Pufu2)

Classées par intérêt pour les visites et pour les revenus.

1. **Alertes par e-mail** (quand Brevo sera branché) : « 3 nouvelles offres dans le 94 », une
   fois par semaine, désactivables. C'est ce qui fait revenir les candidats.
2. **Offres sur les pages de sessions BAFA** : sous les formations générales du Val-de-Marne,
   « 4 structures du 94 cherchent des stagiaires BAFA cet été ». L'argument de vente principal
   aux structures, que Jobanim ne peut pas offrir.
3. **Page publique de chaque structure vérifiée** (nom, ville, type, offres en cours) : rassure
   les candidats, et chaque page est une entrée sur Google.
4. **Liste des offres avec filtres** (`/trouver-un-poste/offres/`), comme celle des sessions,
   dès qu'il y aura une dizaine d'offres.
5. **Badge « structure fondatrice »** sur les offres des premières structures (déjà prévu dans
   la base : colonne `fondatrice`).
6. **Fiches pratiques pour le premier poste** (dans « Trouver un poste ») : préparer son
   entretien d'animateur, ce que contient un projet pédagogique, la valise de colo. Du contenu
   original, sourcé, qui attire des visites.
7. **Outils de plus** : calculateur de la **veille de baignade** (taux et diplômes selon
   l'arrêté du 25 avril 2012, à lire avant), **générateur de planning de séjour** simple et
   imprimable, **convertisseur heures / jours CEE**. Uniquement des outils dont la règle se cite.
8. **Lien Jeuphorie** dans l'espace candidat retenu : « Ton premier séjour ? 3 grands jeux
   offerts ». Discret, utile, et il fait connaître le premier site.
9. **Ce qu'on ne fera pas** : photo ou date de naissance demandées, vente de contacts à l'unité,
   envoi des profils sans compte, notation des candidats, jeux en ligne (hors sujet, et c'est le
   métier de Jeuphorie).

## 5. Avant d'ouvrir au public

Voir `docs/COMPTES-SUPABASE.md` : relancer le fichier de la base (version 2), envoi des e-mails
par Brevo, mentions légales complètes, test de bout en bout, puis `comptes_ouverts: true`.
