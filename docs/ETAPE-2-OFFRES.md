# Étape 2 : les offres de stages pratiques et de jobs

État au 25 octobre 2026 : **tout est prêt techniquement, rien n'est en vente, aucune offre n'est publiée.**

## Ce qui existe déjà sur le site

- `donnees/offres.yml` : le format d'une offre (champs expliqués en tête du fichier). Liste vide.
- Dès qu'une offre est ajoutée :
  - elle apparaît en haut de `/stages-et-jobs/` (date, structure, ville, public, salaire) ;
  - elle a sa page `/stages-et-jobs/offres/<id>/`, avec un bouton « Candidater auprès de la structure »
    (e-mail ou lien de la structure : le site ne reçoit aucune candidature) ;
  - la page porte les données structurées **JobPosting** : l'offre peut apparaître dans
    **Google pour l'emploi**, ce qui est le meilleur levier de visites gratuit pour cette étape ;
  - elle disparaît toute seule après sa date `expire_le`.
- `/stages-et-jobs/recruteurs/` : la page pour les structures (ce qui arrive, ce qu'il faut envoyer).

Testé le 25/10/2026 avec une offre fictive, retirée ensuite : page, bouton de candidature et
données JobPosting valides.

## Comment une offre arrive sur le site (sans compte, sans formulaire)

1. La structure écrit à l'adresse de contact avec les informations de la liste ci-dessous.
2. Relecture (5 minutes) : règles de la section « Ce qu'une offre ne peut pas contenir ».
3. L'offre est ajoutée dans `donnees/offres.yml` (par Pufu2 ou par Claude), puis publiée.
4. Quand le poste est pourvu, la structure prévient : l'offre est retirée.

Ce qu'il faut demander à la structure : nom et type de la structure, ville, intitulé du poste,
contrat (CEE, CDD…), dates, public accueilli, rémunération, logé ou non, diplômes demandés,
un texte de présentation en français, l'adresse ou le lien pour candidater, et jusqu'à quand
l'offre doit rester en ligne.

## Le cadre légal (à faire valider par un juriste avant d'encaisser le premier euro)

Articles lus le 25/10/2026 sur code.travail.gouv.fr :

- **L5321-3** : aucune rétribution ne peut être exigée des personnes qui cherchent un emploi.
  → Les candidats ne paient jamais, sous aucune forme.
- **L5331-1** : il est interdit de **vendre** des offres d'emploi ; cela « ne fait pas obstacle à
  l'insertion, à titre onéreux, d'offres […] dans une publication ou un autre moyen de
  communication payant ». → Le pass payé par la structure est une insertion payante : c'est la
  formule qui semble permise, mais **la lecture exacte de cet article doit être confirmée**.
- **L5331-2** : pas de **limite d'âge supérieure** dans une offre (sauf condition légale).
  → Refuser « 18-25 ans » ; « 17 ans minimum » est possible si c'est une exigence réelle et légale.
- **L5331-3** : pas d'allégation fausse ou trompeuse sur le poste, la rémunération ou le lieu.
- **L5331-4** : l'offre est rédigée en français.
- **L5331-5** : pas d'allégation trompeuse sur le service lui-même, notamment sur sa gratuité.
- Non-discrimination (code du travail, L1132-1) : pas de critère de sexe, d'origine, etc.

Données personnelles : l'adresse pour candidater doit être une adresse **générique** de la
structure (recrutement@…), ou celle d'une personne qui a donné son accord. Le site ne publie
**jamais de profils ni de CV** : beaucoup d'animateurs ont 16 ou 17 ans.

## Le modèle économique : proposition (à décider par Pufu2)

**Constat important** : Jobanim affiche « Recruteur : publier une offre **gratuitement** »
(vu sur jobanim.com le 25/10/2026). Faire payer dès le départ face à un concurrent gratuit et
connu sera difficile.

Proposition :

1. **Saison de lancement gratuite** (hiver-printemps 2027) : publier gratuitement les offres de
   stages pratiques et de jobs d'été, pour avoir des offres à montrer et des premières visites
   depuis Google pour l'emploi.
2. **Ensuite, un pass simple** :
   - **pass saison** : publication illimitée pendant une saison (été, ou mercredis et petites vacances) ;
   - **pass année** : toute l'année, avec la mise en avant de l'offre sur les pages de sessions
     du même département (là où les futurs stagiaires cherchent leur BAFA : c'est l'argument
     que Jobanim n'a pas).
   Prix à fixer après la saison de lancement, au vu du nombre de candidatures que reçoivent les
   structures.
3. Paiement : lien de paiement Stripe, comme pour Jeuphorie, **seulement après la déclaration de
   la micro-entreprise** et la mise à jour des mentions légales et des conditions de vente.

Rappel AAH : chaque euro gagné compte environ pour moitié ; à vérifier avec la CAF au moment de
la déclaration.

## Ce qu'il reste à faire, dans l'ordre

1. Décider : saison de lancement gratuite ou non.
2. Faire valider la lecture de l'article L5331-1 (juriste, ou service juridique d'un réseau
   d'éducation populaire).
3. Écrire aux structures qu'on connaît (centres de loisirs, organisateurs de séjours) pour les
   premières offres de stages pratiques BAFA de l'été 2027 (elles recrutent dès l'hiver).
4. Ajouter à la page Confidentialité une phrase sur les adresses de candidature des structures.
