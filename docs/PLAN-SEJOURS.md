# Plan détaillé : « Trouver un séjour » sur Fil Roug'Anim

*Version 2, du 17 novembre 2026. Le document de référence pour construire la partie « séjours » : décisions, parcours, écrans, données, règles, e-mails, aspects légaux, calendrier et tests. Chaque partie peut se construire et se vérifier séparément.*

---

## Sommaire

0. Les décisions prises
1. Objectifs et chiffres à atteindre
2. Ce qu'on appelle un « séjour » (les 4 types d'offres)
3. Le parcours des familles, écran par écran
4. La demande de réservation (le cœur du modèle) et le blocage après 2 demandes
5. Les alertes pour les parents
6. Les pages publiques et leurs adresses
7. La fiche d'un séjour, bloc par bloc
8. La nouvelle page structure
9. L'accueil, le menu et le pied de page
10. L'espace structure : « Mes séjours » et « Demandes des familles »
11. L'administration
12. La base de données (tables, règles d'accès, fonctions)
13. La génération du site (build.py) et les fichiers
14. Les scripts du navigateur
15. Les e-mails
16. Le modèle économique, au détail près
17. Légal, données personnelles et sécurité des mineurs
18. Les contenus à écrire
19. Faire venir les structures, puis les familles
20. Le calendrier, semaine par semaine, avec les critères de fin
21. Les tests
22. Les risques et leurs parades
23. Ce qui reste à décider plus tard

---

## 0. Les décisions prises

| Question | Décision |
|---|---|
| Nom de l'entrée | **Trouver un séjour** |
| Séjours à l'étranger | **Dès le début** (avec la mention « pas de Pass Colo » quand c'est le cas) |
| Ce qui est gratuit pour une structure | Publier ses séjours, et **recevoir 2 demandes de familles complètes**. À partir de la 3e, la demande arrive mais **les coordonnées de la famille sont masquées** tant que la structure n'a pas l'abonnement (ou le Pass recrutement) |
| Quelles offres | **Les séjours avec nuitées et les accueils de loisirs à la journée** (vacances et mercredis) |
| Alertes aux parents | **Oui** (avec double confirmation de l'adresse et désinscription en un clic) |
| Ce qui existe déjà | **On ne remplace rien, on ajoute.** Les onglets de l'accueil gardent leur ordre, les pages structures gardent tout leur contenu, les menus gardent leurs entrées : les séjours viennent en plus, à côté |

**Ce que change la décision n° 3** : le bouton de la fiche n'envoie plus chez l'organisateur, il ouvre une **demande sur Fil Roug'Anim**. C'est ce qui rend le blocage possible : si la famille partait directement sur le site de la structure, on ne pourrait rien lui faire payer. Le lien vers le site de la structure reste visible, plus discret, sur la page de la structure.

---

## 1. Objectifs et chiffres à atteindre

| Échéance | Offre (structures) | Demande (familles) | Argent |
|---|---|---|---|
| Fin janvier 2027 | 30 séjours ou accueils publiés, 10 structures | Pages en ligne, référencées par Google | 0 (on remplit) |
| Fin mars 2027 | 100 séjours, 30 structures | 50 demandes de familles | 5 structures payantes |
| Fin mai 2027 | 200 séjours, 60 structures | 300 demandes | 20 structures payantes |
| Fin août 2027 | Bilan de la saison | 600 demandes | 30 structures payantes, et des renouvellements à la rentrée |

Tout se suit dans l'admin, page « Séjours » (partie 11).

---

## 2. Ce qu'on appelle un « séjour » (les 4 types d'offres)

| Type | Définition | Exemples | Champs propres |
|---|---|---|---|
| **Séjour** | Au moins 4 nuits, hébergement collectif | Colo à la mer, séjour linguistique, ski | hébergement, transport, encadrement de nuit |
| **Mini-séjour** | 1 à 3 nuits, souvent lié à un accueil de loisirs | Mini-camp nature, nuit sous tente | hébergement, rattachement à un accueil |
| **Accueil de loisirs (vacances)** | À la journée, pendant les vacances | Centre de loisirs de la ville, été | horaires, repas, ramassage, tarif à la journée ou au quotient |
| **Accueil de loisirs (mercredis)** | À la journée, les mercredis de l'année | Mercredis loisirs | horaires, période scolaire, inscription à l'année ou au trimestre |

Chaque offre a **une ou plusieurs dates** (sessions) : un même séjour peut partir 3 fois dans l'été, et un accueil de loisirs peut avoir les semaines de juillet et d'août.

---

## 3. Le parcours des familles, écran par écran

### 3.1 Entrée
- **Accueil** : un onglet **« Trouver un séjour »** ajouté **à la fin** des onglets de la grande recherche. Les onglets actuels gardent leur ordre et leur onglet par défaut ; rien ne bascule selon la saison.
- **Menu du haut** : une rubrique **« Séjours »** ajoutée après les rubriques actuelles (qui ne bougent pas), avec un volet comme les autres :
  - à gauche, le grand cadre « Trouver un séjour » ;
  - à droite, les entrées par âge, par période, les aides et le lien « Vous organisez des séjours ? ».
- **Pages de sessions BAFA** : un petit encart « Vos enfants partent cet été ? » (sur les pages de ville et de département), pour croiser les publics.

### 3.2 La recherche, en 3 questions et en gros boutons (`/sejours/`)
1. **Pour qui ?** 3-5 ans · 6-8 ans · 9-11 ans · 12-14 ans · 15-17 ans (plusieurs choix possibles : une fratrie).
2. **Quand ?** Hiver · Printemps · Juillet · Août · Toussaint · Noël · Les mercredis. Puis, en option, des dates précises.
3. **Quel genre ?** Séjour avec nuits · À la journée près de chez moi. Puis **Il ou elle aime…** : Nature et animaux · Mer et plage · Montagne · Sports · Équitation · Sports nautiques · Arts, cirque et spectacle · Sciences et numérique · Langues et étranger · Itinérance et aventure · Découverte (un peu de tout).
4. **Où ?** Pour la journée : la ville (même case « Où ? » que pour le BAFA, avec les villes proposées). Pour un séjour : « Départ près de chez moi » (ville de départ) et/ou « Destination » (France, une région, l'étranger).
5. **En option** : budget max, « Éligible au Pass Colo », « Accepte les aides VACAF », « Places disponibles seulement ».

**Le résultat s'affiche sans recharger la page**, comme pour les sessions BAFA. Chaque réponse se garde dans l'adresse (`?age=9-11&quand=juillet&genre=sejour&envie=mer`), donc on peut la partager.

### 3.3 Les résultats
- **Des cartes visuelles**, 3 par ligne sur ordinateur et 1 sur téléphone :
  - une grande photo, avec le pictogramme du thème en médaillon ;
  - le titre (60 caractères au plus), les âges et le type (« Séjour 7 jours », « À la journée ») ;
  - les prochaines dates, le lieu ou la destination, et le départ s'il y en a un ;
  - le prix (« dès 540 € », ou « dès 12 € la journée ») et, quand c'est connu, « **dès 190 € avec le Pass Colo** » ;
  - des étiquettes : Pass Colo · VACAF · Plus que 3 places · Complet · Partenaire (les structures abonnées, toujours signalées) ;
  - le nom de la structure, avec la mention « Vérifiée ».
- **Le tri** : d'abord les dates qui conviennent, puis les séjours « à la une » des structures abonnées (signalés), puis par date de départ. On peut aussi trier par prix.
- **Si rien ne correspond** : « Aucun séjour pour ces critères. Élargissez l'âge ou la période, ou recevez une alerte dès qu'un séjour correspond », avec le formulaire d'alerte (partie 5).
- **Une carte en option** : voir les séjours et les accueils sur une carte de France, comme pour les sessions.

### 3.4 La fiche du séjour
Voir la partie 7. Le bouton principal est **« Demander une place »** (partie 4).

### 3.5 Après la demande
- Un écran de confirmation : « C'est envoyé à [Structure]. Elle vous répond en général sous 48 heures. Vous recevez aussi une copie par e-mail. »
- Puis : « D'autres séjours qui pourraient lui plaire », et « Recevoir les nouveaux séjours de ce genre » (alerte).

---

## 4. La demande de réservation (le cœur du modèle)

### 4.1 Le formulaire, sur la fiche, sans créer de compte
| Champ | Obligatoire | Remarque |
|---|---|---|
| Date choisie (si plusieurs) | oui | liste des dates avec leurs places |
| Prénom de l'enfant | non | seulement le prénom ; on peut écrire « mon fils » |
| Âge de l'enfant à la date du séjour | oui | une liste de 3 à 17 ans ; on vérifie qu'il est dans la tranche du séjour |
| Nombre d'enfants | oui | 1 par défaut (fratrie possible) |
| Nom du parent | oui | |
| E-mail du parent | oui | |
| Téléphone | non | conseillé |
| Ville | non | aide la structure (transport) |
| Message | non | 1 000 caractères au plus |
| Aides envisagées | non | cases : Pass Colo · VACAF · Comité d'entreprise · Mairie · Chèques-vacances |
| Consentement | oui | « J'accepte que ma demande et mes coordonnées soient transmises à [Structure] pour ce séjour » + lien vers la politique de confidentialité |

**Contre les abus** : 5 demandes au plus par adresse e-mail et par jour, un champ piège invisible pour les robots, et une adresse e-mail à confirmer **seulement si** la même adresse a déjà envoyé 3 demandes dans la journée.

### 4.2 Ce que reçoit la structure
- Un e-mail « **Nouvelle demande pour [Séjour]** », puis la demande dans « Mon espace », onglet **Demandes des familles**.
- **Ses 2 premières demandes** (au total, depuis la création du compte) arrivent **complètes** : nom, e-mail, téléphone, message.
- **À partir de la 3e**, sans abonnement ni Pass :
  - elle voit **qu'il y a une demande** : séjour, date, âge, nombre d'enfants, ville, aides et un extrait du message ;
  - les **coordonnées sont masquées** (« M\*\*\* D\*\*\*, e-mail et téléphone avec l'abonnement ») ;
  - un bouton « **Débloquer : abonnement dès 39,50 €/an, ou Pass recrutement 15 €/mois** » ;
  - **dès qu'elle paie, toutes ses demandes s'affichent en entier**, y compris les anciennes.
- **La famille n'est jamais pénalisée** : elle reçoit un accusé de réception. Si la structure n'a pas répondu (ou pas débloqué) sous **5 jours**, la famille reçoit un e-mail « Pas encore de réponse ? Voici d'autres séjours aux mêmes dates », avec 3 suggestions.
- **Les compteurs** sont écrits dans la base (`demandes_gratuites_utilisees`). Le masquage se fait **dans la base** (fonction de lecture), jamais seulement à l'écran : une structure qui n'a pas payé ne peut techniquement pas lire les coordonnées.

### 4.3 Les états d'une demande
`nouvelle` → `vue` → `en_cours` (la structure a répondu) → `acceptee` (place confirmée) ou `refusee`, ou `sans_suite`.
- La structure change l'état en un clic, avec des réponses toutes prêtes (comme pour les candidatures) : « Place disponible : voici comment s'inscrire », « Liste d'attente », « Complet, désolé ».
- La famille ne voit pas ces états en version 1 (pas de compte famille). Elle reçoit seulement les e-mails de la structure.

### 4.4 Pourquoi ce modèle est solide
- La structure voit **la valeur avant de payer** : 2 demandes réelles, puis le nombre exact des demandes qui l'attendent.
- Le coût pour elle reste faible (39,50 à 79 € par an, ou 15 € par mois), à rapporter à un séjour vendu 400 à 900 € par enfant.
- **Aucune commission** sur les inscriptions : c'est l'argument face aux plateformes qui prennent un pourcentage.

---

## 5. Les alertes pour les parents

- **Où** : sur la page de résultats (« Prévenez-moi des nouveaux séjours de ce genre »), sur une fiche complète, et après une demande.
- **Ce qu'on enregistre** : l'e-mail, les critères (âges, période, genre, envies, ville ou rayon, budget) et la date. Rien d'autre : pas de nom.
- **Double confirmation** : un e-mail avec un lien « Confirmer mon alerte ». Sans clic, rien n'est envoyé, et l'alerte est effacée au bout de 7 jours.
- **Fréquence** : un e-mail par semaine au plus (le jeudi), et seulement s'il y a du nouveau. 6 séjours au plus par e-mail.
- **Désinscription** en un clic dans chaque e-mail, avec un jeton (comme les alertes du lundi des animateurs). Les alertes sans clic pendant 12 mois sont effacées.
- **Pour les structures** : « Votre séjour a été envoyé à 37 familles cette semaine » apparaît dans leurs statistiques.

---

## 6. Les pages publiques et leurs adresses

Toutes ces pages sont générées à chaque publication, comme les pages de sessions BAFA. Une page n'est **montrée à Google** (indexée) que si elle contient **au moins 3 offres** ; sinon, elle existe pour les liens mais reste hors de Google.

| Page | Adresse | Titre (balise title) | Contenu |
|---|---|---|---|
| Catalogue | `/sejours/` | Séjours de vacances et colos pour enfants et ados · Fil Roug'Anim | La recherche, les séjours à venir, les aides |
| Par période | `/sejours/ete-2027/`, `/sejours/hiver-2027/`, `/sejours/printemps-2027/`, `/sejours/toussaint-2026/`, `/sejours/noel-2026/` | Colonies de vacances été 2027 : séjours pour enfants et ados | Les offres de la période, par âge |
| Par âge | `/sejours/3-5-ans/` … `/sejours/15-17-ans/`, `/sejours/ados/` | Colo pour les 9-11 ans : séjours et accueils | |
| Par envie | `/sejours/mer/`, `/sejours/montagne/`, `/sejours/equitation/`, `/sejours/sports-nautiques/`, `/sejours/linguistique/`, `/sejours/etranger/`, `/sejours/nature/`, `/sejours/arts-cirque/`, `/sejours/sciences/`, `/sejours/itinerance/` | Colo équitation : séjours pour enfants et ados | |
| Départ d'une ville | `/sejours/depart-paris/`, `/sejours/depart-lyon/`… (villes avec au moins 3 séjours au départ) | Colonies de vacances au départ de Lyon | |
| Destination | `/sejours/bretagne/`, `/sejours/alpes/`, `/sejours/espagne/`… | Colos en Bretagne | |
| À la journée | `/sejours/accueils-de-loisirs/[departement]/[ville]/` | Accueils de loisirs à Créteil : vacances et mercredis | Les accueils de la ville et autour |
| Croisements utiles | `/sejours/ete-2027/ados/`, `/sejours/ete-2027/mer/` (seulement s'il y a au moins 5 offres) | | |
| Fiche | `/sejours/[structure]/[sejour]/` | Le titre du séjour, l'âge et la ville · Fil Roug'Anim | Partie 7 |
| Aides | `/sejours/aides/` | Pass Colo, VACAF, CAF : les aides pour partir en colo | Guide (partie 18) |
| Exemple | `/sejours/exemple/` | Exemple de fiche séjour | Fiche fictive, non indexée |
| Pour les structures | `/recruter/sejours/` | Publiez vos séjours sur Fil Roug'Anim | Arguments, prix, bouton « Publier mes séjours » |

**Pour chaque page** :
- un fil d'Ariane (Accueil › Séjours › Été 2027) ;
- une description de 150 caractères ;
- des liens vers les pages voisines (autres âges, autres envies, villes de départ proches) ;
- les données structurées des offres ;
- l'ajout au plan du site et au bloc « Recherches fréquentes » du pied de page (nouvel onglet « Séjours »).

---

## 7. La fiche d'un séjour, bloc par bloc

1. **Le haut**
   - Galerie de 3 à 8 photos : une grande et des vignettes, en plein écran au clic.
   - Le titre, une accroche (« Tu vas surfer tous les matins et dormir face à l'océan »), puis les âges, la durée, le lieu ou la destination et le type.
   - Les badges : Vérifiée · Séjour déclaré · Pass Colo · VACAF · Partenaire.
2. **Le cadre « Réserver »**, qui reste visible au défilement sur ordinateur et devient une barre en bas d'écran sur téléphone :
   - les dates, avec leurs places (« Plus que 3 places », « Complet ») ;
   - le prix ;
   - le bouton **« Demander une place »** et un lien « Poser une question » (même formulaire, sans date).
3. **En bref** : 6 pictogrammes. Hébergement · Nombre d'enfants · 1 animateur pour X enfants · Transport · Repas · Niveau requis (pour le sport).
4. **Au programme** : jour par jour, ou les activités en points. Un « Une journée type » pour les accueils de loisirs.
5. **La vie sur place** : hébergement, chambres, repas et régimes, téléphone et nouvelles des enfants (blog du séjour, appels).
6. **L'encadrement** : directeur·rice (BAFD ou équivalent), nombre d'animateurs (BAFA), assistant sanitaire, surveillant de baignade et moniteurs diplômés pour les activités à risque. C'est un lien naturel avec le reste du site.
7. **Les infos pratiques** :
   - départs (villes, train ou car, prix du transport) ;
   - trousseau ;
   - documents (fiche sanitaire, test d'aisance aquatique, autorisation de sortie du territoire et pièce d'identité pour l'étranger).
8. **Le prix et les aides**
   - Le prix total et ce qui est inclus ou non.
   - Les aides acceptées.
   - Le **calculateur de reste à charge** : le parent indique l'année de naissance de l'enfant. Le calculateur dit s'il peut avoir droit au Pass Colo (règles de l'année, gardées dans un fichier de données mis à jour chaque année), demande le quotient familial et d'autres aides en euros, et affiche le **reste à charge estimé**, avec la mention « Estimation : le montant exact est sur votre compte CAF ».
9. **La structure** : logo, nom, « Vérifiée par Fil Roug'Anim », quelques mots, et le lien vers sa page et ses autres séjours.
10. **Confiance**
    - Le numéro de déclaration de l'accueil.
    - L'assurance.
    - « Les informations de cette page sont écrites par la structure, sous sa responsabilité. »
    - Un lien « Signaler un problème ».
11. **Des séjours proches** : 4 cartes (même âge, même période, autre structure).
12. **Pour Google** : les données structurées (`Event`, avec `offers` qui portent le prix et la disponibilité, `location` et `organizer`).

**Le ton** : les accroches s'adressent à l'enfant (« Tu »), le reste aux parents (« Vous »). Des phrases courtes, de grandes images, des pictogrammes. Tout doit se lire sur un téléphone.

---

## 8. La page structure : des séjours en plus

**Règle : la page structure actuelle reste telle quelle** (en-tête, présentation, accueils, offres d'emploi, contact). Rien n'est retiré ni réordonné. Quand la structure a publié au moins un séjour, on **ajoute** :
- un badge « Séjours » et un bouton « Voir nos séjours » à côté des boutons existants ;
- une **section « Nos séjours »** insérée sous la présentation, avec ce qui suit ;
- une photo de bannière **facultative** : si la structure n'en met pas, l'en-tête reste exactement celui d'aujourd'hui.

Ce qui suit décrit le contenu de cette section ajoutée (les « onglets » ci-dessous sont des onglets **internes à la section séjours**, pas une refonte de la page).


**Le haut, plus visuel :**
- une bannière photo pleine largeur (la photo choisie par la structure), avec dessus le logo, le nom, et 3 chiffres (« 12 séjours · 6 à 17 ans · depuis 1998 ») ;
- les badges : Vérifiée · Séjours déclarés · VACAF · Pass Colo · Partenaire ;
- deux boutons : « **Voir nos séjours** » (principal) et « Nous écrire ».

**Des onglets sous la bannière :**
1. **Nos séjours**, ouvert en premier dans la section :
   - des **pastilles de filtre** (âge, période, envie, type) ;
   - des **cartes**, comme dans les résultats ;
   - une **frise de la saison** : les semaines de juillet et d'août, avec les séjours placés dessus, pour voir d'un coup d'œil ce qui tombe pendant les congés des parents ;
   - s'il n'y a qu'un séjour, on va directement à sa fiche résumée.
2. **Nos accueils** (s'ils existent) : les accueils de loisirs, avec horaires, tarifs (au quotient si c'est le cas) et inscriptions.
3. **Qui sommes-nous** : projet éducatif, valeurs, l'équipe, les lieux (carte), photos, « Ce que disent les familles » (version 2, avis modérés).
4. **On recrute** : rien à faire, les offres d'emploi restent où elles sont aujourd'hui sur la page.

**Sur téléphone**, les onglets deviennent une barre qui défile horizontalement, et le bouton « Voir nos séjours » reste en bas de l'écran.

---

## 9. L'accueil, le menu et le pied de page

- **Accueil** :
  - l'onglet « Trouver un séjour » ajouté en dernier (voir 3.1) ;
  - une nouvelle bande « **Les séjours de l'été** », **ajoutée sous les blocs actuels** (aucun bloc n'est retiré ni déplacé), avec 6 cartes à la une (structures abonnées d'abord, signalées) et le lien « Tous les séjours » ;
  - un bloc « Les aides pour partir » (Pass Colo, VACAF) ;
  - le bloc chiffres garde ses chiffres ; « séjours publiés » s'y ajoute seulement quand il y en a au moins 50.
- **Menu** : la rubrique « Séjours » (voir 3.1).
- **Pied de page** : les colonnes actuelles restent ; on ajoute une colonne « Séjours » (par âge, par période, les aides, Vous organisez des séjours ?) et un onglet « Séjours » dans « Trouver sa formation près de chez soi ».
- **La page Recruter** garde tout son contenu et gagne un bloc en plus : « Vous organisez des séjours ? Publiez-les gratuitement, recevez les demandes des familles. »

---

## 10. L'espace structure

Les onglets actuels de l'espace (tableau de bord, fiche, offres, candidats, outils, abonnement…) restent à leur place ; « Mes séjours » et « Demandes des familles » **s'ajoutent** à la barre latérale, après eux.

### 10.1 Onglet « Mes séjours »
**Une liste en cartes** : chaque offre avec ses dates, ses places, son état (brouillon, en ligne, complet, terminé), et ses chiffres sur 30 jours (vues, demandes).

**Un assistant de création, pas à pas**, avec l'aperçu de la fiche à droite (comme la fiche structure). Les étapes :
1. **Le type** : Séjour · Mini-séjour · Accueil de loisirs vacances · Accueil de loisirs mercredis.
2. **L'essentiel** : titre (60 caractères), accroche (140), envies (jusqu'à 3), âges (de… à…), nombre d'enfants, taux d'encadrement.
3. **Les dates** : une ou plusieurs sessions (début, fin, places totales). Pour les accueils : période et jours d'ouverture.
4. **Le lieu** : ville et département (case guidée), ou pays et région pour l'étranger. Hébergement. Pour la journée : adresse de l'accueil, horaires, ramassage.
5. **Le transport** (séjours) : villes de départ, mode, prix par ville.
6. **Le programme** : jour par jour, ou en points, avec des modèles proposés.
7. **L'encadrement** : direction, animateurs, assistant sanitaire, moniteurs d'activité.
8. **Les photos** : 3 à 8, réduites dans le navigateur (comme les photos de structure). La première sert de vignette.
9. **Le prix et les aides** : prix (par séjour, par jour ou au quotient), ce qui est inclus, aides acceptées, Pass Colo oui/non, numéro de déclaration.
10. **Relire et publier.**

**Les raccourcis** :
- **Dupliquer** (le même séjour pour la saison suivante, ou la même colo en août) ;
- **Places restantes** (+ / −, ou « Complet ») directement sur la carte ;
- **Mettre en pause**.

### 10.2 Onglet « Demandes des familles »
- **Une boîte de réception**, comme le QG demandes de l'admin, avec des filtres : nouvelles · en cours · acceptées · refusées.
- **Chaque demande** affiche : séjour, date, âge, nombre d'enfants, ville, aides et message, puis les coordonnées (ou masquées, partie 4.2).
- **Les réponses toutes prêtes**, qui s'ouvrent dans la messagerie, avec l'état mis à jour : Place disponible · Liste d'attente · Complet · Demander des précisions.
- **Le compteur** : « 2 demandes gratuites utilisées sur 2 » et, sans abonnement, « 5 demandes vous attendent : débloquez-les ».

### 10.3 Le tableau de bord
De nouvelles tuiles : demandes en attente, séjours qui se remplissent (places), séjours sans photo (« À compléter »). Plus « Votre séjour a été envoyé à X familles » (alertes).

### 10.4 L'abonnement
Le texte de l'onglet ajoute : « **Toutes les demandes des familles, sans limite** », « Vos séjours à la une » et « Séjours illimités ».

---

## 11. L'administration

Une nouvelle page **« Séjours »** (rubrique Contenu) :
- **Les chiffres** : offres en ligne, structures qui en publient, demandes (7 et 30 jours), demandes bloquées (le levier de vente), alertes actives.
- **À vérifier** : les séjours sans numéro de déclaration, et les séjours signalés par des familles.
- **Par structure** : offres, demandes reçues, demandes bloquées, abonnée ou non. C'est la liste à démarcher : « Elle a 6 demandes bloquées » se vend tout seul. Le bouton « ✉ Lui écrire » prépare le message.
- **Les demandes sans réponse depuis 5 jours** (pour relancer la structure).

**À ajouter aussi** :
- la **Vue d'ensemble** gagne une tuile « Demandes de familles » ;
- les **Ventes** gagnent l'entonnoir « demandes bloquées → abonnements » ;
- la **Prospection** gagne un 4e type de contact, « Organisateurs de séjours », avec ses 3 messages.

---

## 12. La base de données

### 12.1 Tables

**`sejours`**
| Colonne | Type | Règle |
|---|---|---|
| id | bigint, identité | |
| structure_id | uuid → structures | |
| type | text | `sejour`, `mini_sejour`, `accueil_vacances`, `accueil_mercredis` |
| slug | text | unique par structure |
| titre | text | 5 à 60 caractères |
| accroche | text | 140 au plus |
| description, programme, vie_sur_place, encadrement_texte, infos_pratiques | text | 3 000 au plus chacun |
| envies | text[] | parmi la liste fixe (partie 3.2) |
| age_min, age_max | smallint | 3 à 17, avec min ≤ max |
| capacite | smallint | |
| taux_encadrement | text | « 1 pour 8 » |
| pays | text | « FR » par défaut |
| region_dest | text | |
| ville, departement | text | lieu du séjour ou de l'accueil |
| hebergement | text | `centre`, `camping`, `gite`, `famille`, `auberge`, `aucun` |
| transport | jsonb | [{ville, mode, prix}] |
| horaires | text | accueils |
| prix_min | numeric | |
| prix_unite | text | `sejour`, `jour`, `semaine`, `quotient` |
| prix_texte | text | détail, tarifs au quotient |
| inclus | text | |
| aides | text[] | `pass_colo`, `vacaf`, `ce`, `mairie`, `cheques_vacances` |
| pass_colo | boolean | |
| numero_declaration | text | |
| photos | text[] | chemins dans le stockage « sejours » |
| statut | text | `brouillon`, `publie`, `pause` |
| a_la_une | boolean | calculé : structure abonnée |
| cree_le, maj_le | timestamptz | |

**`sejours_dates`** : id, sejour_id, debut, fin, places, places_restantes, complet, jours (pour les accueils).

**`demandes_sejour`** : id, sejour_id, date_id, structure_id, parent_nom, parent_email, parent_telephone, ville, enfant_prenom, enfant_age, nb_enfants, aides text[], message, consentement (timestamp), statut, ouverte (booléen : coordonnées visibles par la structure), cree_le, relance_famille_le.

**`alertes_sejour`** : id, email, criteres jsonb, jeton, confirme_le, dernier_envoi, cree_le.

**`stats_sejours`** : jour, sejour_id, type (`vue`, `demande`, `partage`), n.

**`structures`** gagne `demandes_gratuites_utilisees` (smallint, 0 par défaut) et `banniere` (photo).

### 12.2 Règles d'accès
- **Lecture publique des séjours** : statut `publie` et structure vérifiée (comme les offres).
- **Écriture** : la structure, sur ses séjours. Pas de limite de nombre (le blocage porte sur les demandes, pas sur les séjours).
- **`demandes_sejour`** :
  - **personne ne lit la table directement**. Les familles écrivent par la fonction `demander_place()` ;
  - la structure lit par `mes_demandes_sejour()`, qui **masque** les coordonnées tant que `ouverte` est faux ;
  - l'admin lit tout.
- **`alertes_sejour`** : écriture par `creer_alerte()`, désinscription par `desinscrire_alerte(jeton)`, lecture par le robot d'envoi seulement.

### 12.3 Fonctions (dans la base)
- `demander_place(d jsonb)` : vérifie l'âge, la date et les places, limite à 5 demandes par e-mail et par jour, enregistre la demande. Si la structure est abonnée, ou si `demandes_gratuites_utilisees < 2`, la demande est ouverte (et le compteur augmente) ; sinon elle reste fermée. La fonction note l'événement pour l'e-mail.
- `mes_demandes_sejour()` : les demandes de la structure, coordonnées masquées si `ouverte = false`.
- `ouvrir_demandes()` : appelée au paiement (relevé Stripe) ; ouvre toutes les demandes fermées de la structure.
- `repondre_demande(id, statut)`.
- `creer_alerte(criteres, email)`, `confirmer_alerte(jeton)`, `desinscrire_alerte(jeton)`.
- `compter_sejour(id, type)` (comme `compter_organisme`).

### 12.4 Stockage
Un dossier « sejours » pour les photos : lecture publique, et écriture par la structure dans son propre dossier (même principe que les photos des structures).

---

## 13. La génération du site (build.py)

- `sejours_en_ligne()` : lit les séjours et leurs dates (lecture publique), et ignore les séjours terminés.
- `pages_sejours()` : catalogue, périodes, âges, envies, départs, destinations, accueils par ville, fiches, exemple. Elle applique la règle « indexée si au moins 3 offres ».
- `sejours.json` : les données de la recherche (comme `sessions.json`), avec des clés courtes pour rester léger.
- `aides.yml` (nouveau fichier de données) : les règles du Pass Colo de l'année (années de naissance, plafond de quotient, montants), relues chaque année.
- Le plan du site, le pied de page, l'accueil (bande « séjours de l'été »), les liens croisés depuis les pages BAFA.
- Les données structurées des fiches.

---

## 14. Les scripts du navigateur

- `sejours.js` : la recherche en gros boutons, les cartes, la carte de France (en option), le formulaire d'alerte.
- `sejour-fiche.js` : galerie, choix de la date, formulaire « Demander une place », calculateur de reste à charge, partage (lien, WhatsApp, « envoyer à mes parents »).
- `compte.js` : les onglets « Mes séjours » (assistant, duplication, places) et « Demandes des familles ».
- `admin-pro.js` : la page « Séjours ».

---

## 15. Les e-mails (envoyés par Brevo, comme aujourd'hui)

| E-mail | À qui | Quand | Contenu |
|---|---|---|---|
| Accusé de réception | Famille | Demande envoyée | Récapitulatif, délai de réponse habituel, lien vers le séjour |
| Nouvelle demande | Structure | Demande reçue | Séjour, date, âge, nombre d'enfants. Coordonnées si ouverte, sinon « débloquez-la » |
| Demandes en attente | Structure non abonnée | Chaque lundi, s'il y en a | « 4 demandes vous attendent » + bouton |
| Pas encore de réponse ? | Famille | 5 jours sans réponse | 3 séjours proches aux mêmes dates |
| Confirmez votre alerte | Famille | Alerte créée | Lien de confirmation |
| Nouveaux séjours | Famille abonnée à une alerte | Jeudi, s'il y a du nouveau | 6 séjours au plus, désinscription en un clic |
| Nouvelle demande (admin) | Toi | Avec les autres nouveautés | Résumé |

Chaque e-mail :
- part de l'adresse des alertes ;
- porte la mention « Vous recevez cet e-mail parce que… » ;
- a un lien de désinscription pour les e-mails répétés ;
- n'affiche jamais les coordonnées d'une famille dans un e-mail adressé à une structure qui n'a pas débloqué.

---

## 16. Le modèle économique, au détail près

| Pour la structure | Gratuit | Abonnement (79 €/an, 39,50 € fondateur) | Pass recrutement (15 €/mois, 1 à 5 mois) |
|---|---|---|---|
| Publier des séjours et accueils | ✔ sans limite | ✔ | ✔ |
| Demandes de familles complètes | **2 au total** | **illimitées** | **illimitées pendant le Pass** |
| Demandes suivantes | reçues, coordonnées masquées | — | — |
| Séjours « à la une » et étiquette Partenaire | — | ✔ | ✔ |
| Statistiques détaillées par séjour | vues seulement | ✔ | ✔ |
| Réponses toutes prêtes aux familles | — | ✔ | ✔ |
| Recrutement (déjà en place) | page + 1 offre | tout | tout |

- **Le paiement** passe par les liens Stripe actuels. Le relevé des paiements appelle `ouvrir_demandes()`.
- **À la fin du Pass**, les demandes déjà ouvertes le restent, et les nouvelles redeviennent masquées.
- **Version 2 (après l'été)** : la mise en avant payante d'une page (« Colos au départ de Lyon ») au même principe que les départements des organismes, si le trafic le justifie.

---

## 17. Légal, données personnelles et sécurité des mineurs

- **Les données des familles** (nom, e-mail, téléphone, prénom et âge de l'enfant) :
  - but : transmettre la demande à la structure choisie ;
  - base légale : le consentement, recueilli par la case du formulaire ;
  - conservation : 18 mois après la demande, puis effacement automatique (une tâche planifiée) ;
  - jamais revendues ni transmises à une autre structure.
- **Le minimum de données sur l'enfant** : un prénom (facultatif) et un âge. Ni nom de famille, ni date de naissance complète, ni santé. La fiche sanitaire se remplit chez la structure, jamais sur Fil Roug'Anim.
- **Pas de compte enfant, pas de messagerie avec un mineur.** Les 15-17 ans peuvent consulter et partager à leurs parents ; la demande est faite par un parent (une case « Je suis le parent ou le responsable légal »).
- **Les pages à mettre à jour** :
  - Confidentialité : nouvelle section « Familles » ;
  - Conditions d'utilisation : rôle de Fil Roug'Anim, simple intermédiaire, sans contrat de vente du séjour ;
  - Conditions de vente : la règle des 2 demandes gratuites, le déblocage.
- **La transparence sur le classement** : une phrase sur `/sejours/` explique l'ordre des résultats (dates, puis séjours à la une des structures abonnées, signalés, puis date de départ). C'est une obligation pour les plateformes qui classent des offres.
- **La vérification** :
  - seules les structures vérifiées publient ;
  - le numéro de déclaration de l'accueil est demandé pour les séjours, et la mention « Séjour déclaré » ne s'affiche que s'il est renseigné ;
  - un séjour signalé par une famille est mis en pause, en attendant que tu le vérifies.
- **Les photos** : la structure atteste avoir l'autorisation des personnes photographiées. Elle est invitée à ne pas montrer de visage d'enfant reconnaissable.

---

## 18. Les contenus à écrire

1. **Pass Colo, VACAF, CAF : les aides pour partir en colo** (`/sejours/aides/`), mis à jour chaque année.
2. **Première colo : comment savoir s'il est prêt** (6-8 ans).
3. **La valise de colo : la liste à cocher** (imprimable).
4. **Colo ou accueil de loisirs : que choisir ?**
5. **Séjour à l'étranger : les papiers pour un mineur** (autorisation de sortie du territoire, carte d'identité, carte européenne d'assurance maladie).
6. **Comment choisir une colo sûre** (déclaration, encadrement, questions à poser).
7. Pour les structures : **Remplir ses séjours : 7 conseils** (photos, titre, prix clair, répondre vite).
8. Une **fiche séjour d'exemple** (`/sejours/exemple/`), comme les autres fiches d'exemple.

---

## 19. Faire venir les structures, puis les familles

**Les structures (décembre à février)**
- **La cible** : les organisateurs de séjours de chaque région (associations nationales et locales, comités d'entreprise qui organisent, mairies avec séjours municipaux), et les accueils de loisirs des villes.
- **Les sources** : les sites des grandes associations d'éducation populaire, les listes des partenaires VACAF par département, et les structures déjà inscrites sur le site.
- **Le message** : « Publiez vos séjours gratuitement ; les familles vous écrivent ; aucune commission. » Trois messages prêts dans la Prospection, avec relances à 7 et 14 jours.
- **L'objectif** : 30 offres en ligne avant fin janvier.

**Les familles (février à juin)**
- **Google** : les pages par période, âge, envie et départ, plus les guides.
- **Réseaux sociaux** : les idées de posts de l'admin gagnent des posts « séjours » (« 12 colos mer pour les 9-11 ans cet été, dont 4 avec le Pass Colo »).
- **Les parents du site** : les animateurs ont souvent des enfants ou des proches. Une ligne dans leurs e-mails du lundi au printemps.
- **Les structures elles-mêmes** : un bouton « Partager ce séjour » et un badge « Nos séjours sont sur Fil Roug'Anim » à mettre sur leur site.

---

## 20. Le calendrier, semaine par semaine

| Semaine | À faire | C'est fini quand… |
|---|---|---|
| **1** | Tables, règles d'accès, fonctions (`demander_place`, `mes_demandes_sejour`, `ouvrir_demandes`), stockage des photos. Fichier `aides.yml`. | Les tests de la base passent : une 3e demande est masquée, puis ouverte au paiement. |
| **2** | Espace structure, onglet « Mes séjours » : liste, assistant en 10 étapes, aperçu, duplication, places. | Une structure crée un séjour avec 2 dates et 5 photos, et le voit en aperçu. |
| **3** | Fiche séjour publique, calculateur, formulaire « Demander une place », e-mails famille et structure. Fiche d'exemple. | Une demande de test arrive à la structure, la famille reçoit l'accusé de réception. |
| **4** | Catalogue `/sejours/` et recherche en gros boutons (`sejours.js`), cartes, tri, aucune réponse → alerte. | La recherche « 9-11 ans, juillet, mer » filtre sans recharger, et l'adresse se partage. |
| **5** | Section « Nos séjours » ajoutée à la page structure existante (bannière facultative, cartes, frise de l'été). | La page d'une structure sans séjour est identique à aujourd'hui ; avec 6 séjours, la section s'ajoute proprement, sur téléphone aussi. |
| **6** | Onglet « Demandes des familles » (boîte de réception, réponses toutes prêtes, blocage et déblocage). Relevé Stripe → `ouvrir_demandes()`. | Payer le Pass ouvre toutes les demandes masquées. |
| **7** | Pages Google (périodes, âges, envies, départs, destinations, accueils par ville), plan du site, pied de page, accueil (onglet + bande), menu. | Les pages se génèrent ; seules celles qui ont au moins 3 offres sont indexées. |
| **8** | Alertes parents (création, double confirmation, envoi du jeudi, désinscription), e-mails de relance, admin « Séjours », Prospection « Organisateurs de séjours ». Guides. Textes légaux. | Une alerte confirmée reçoit l'e-mail du jeudi ; la désinscription marche en un clic. |
| **9-10** | Démarchage des organisateurs (avec toi), corrections, puis mise en ligne publique. | 30 offres publiées. |

---

## 21. Les tests

**La base (en transactions annulées, comme pour les organismes)** :
- âge hors tranche refusé ;
- 6e demande du jour refusée ;
- 3e demande d'une structure gratuite masquée ;
- paiement → toutes ouvertes ;
- une structure ne lit pas les demandes d'une autre ;
- un visiteur ne lit aucune demande.

**Le navigateur (Playwright, base simulée)** :
- recherche (chaque bouton, l'adresse partagée, aucune réponse) ;
- fiche (galerie, dates, calculateur, formulaire, confirmation) ;
- espace structure (assistant complet, duplication, places, boîte de réception, blocage) ;
- admin ;
- **téléphone** (390 px, rien ne dépasse) ;
- **accessibilité** (tout au clavier, textes alternatifs des photos, contrastes).

**En vrai, après la mise en ligne** : une demande de test de bout en bout avec une structure de test, puis effacée.

---

## 22. Les risques et leurs parades

| Risque | Parade |
|---|---|
| Pas assez de séjours au lancement | Démarchage avant toute communication aux familles ; publication gratuite et sans limite ; on n'ouvre les pages à Google qu'à partir de 3 offres |
| Des structures qui contournent (lien de leur site dans la description) | Pas de lien ni de coordonnées dans les textes des séjours (filtre à l'enregistrement) ; le lien du site reste sur la page structure seulement |
| Des familles déçues par des structures qui ne répondent pas | Relance de la structure à 3 jours, e-mail « autres séjours » à la famille à 5 jours, et le taux de réponse visible dans l'admin |
| Un séjour douteux | Structures vérifiées seulement, numéro de déclaration, bouton « Signaler », mise en pause automatique au signalement |
| Les données des familles | Le minimum, le masquage dans la base, l'effacement à 18 mois, rien dans les e-mails non débloqués |
| Le site devient confus (deux publics) | Une entrée claire par public, la rubrique « Séjours » à part, et des couleurs propres aux séjours (bleu océan et vert, en plus du rouge du fil) |
| La concurrence des sites de colos installés | Pas de commission, structures vérifiées, aides calculées, et le lien avec le BAFA (l'encadrement mis en avant) |

---

## 23. Ce qui reste à décider plus tard (pas bloquant)

1. Les **avis des familles** sur les séjours (version 2 : seulement après une demande acceptée, et modérés).
2. Un **compte famille** pour suivre ses demandes (version 2).
3. La **mise en avant payante d'une page** de recherche (version 2, si le trafic suit).
4. Les **couleurs** exactes de la partie séjours : je propose des maquettes avant la semaine 4.

---

*Sources pour les aides : [Pass Colo et aide aux vacances enfants, CAF (2026)](https://www.caf.fr/allocataires/caf-de-l-aude/offre-de-service/vie-personnelle/vacances-et-loisirs/l-aide-aux-vacances-enfants-ave-et-le-pass-colo-pour-2026) ; [guide partenaires Pass Colo 2026](https://www.caf.fr/sites/default/files/medias/511/Partenaires/Aide_aux_temps_libre/2026-Guide_partenaires_PASS_COLO.pdf). Les montants et conditions changent chaque année : ils seront gardés dans `donnees/aides.yml` et revérifiés en janvier.*
