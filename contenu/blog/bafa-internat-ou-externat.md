---
titre: "BAFA en internat, en demi-pension ou en externat : que choisir ?"
court: Internat ou externat ?
description: "Internat, demi-pension, externat : ce que change la formule d'une session BAFA, pour le prix, l'ambiance et l'organisation, avec les prix médians de chaque formule."
resume: "Ce que change la formule pour le prix, l'ambiance et l'organisation."
categorie: Se former
date: 2026-11-02
---

Sur chaque session BAFA, vous verrez une **formule** : internat, demi-pension ou externat. Elle change le prix, mais aussi la façon dont vous vivez la formation.

## Les trois formules

- **Internat** : vous dormez et mangez sur place pendant toute la session. C'est le plus proche de la vie en colo.
- **Demi-pension** : vous déjeunez sur place et rentrez chez vous le soir.
- **Externat** : vous venez pour la journée, repas à prévoir selon l'organisme.

## Ce que ça change pour le prix

Pour la formation générale, sur les sessions dont la formule est indiquée :

| Formule | Prix médian | Sessions |
|---|---|---|
{% for f, x in c.formules.items() if x.n %}| {{ f | majuscule }} | {{ x.med | euros }} | {{ x.n }} |
{% endfor %}

## Ce que ça change pour la formation

**L'internat** est souvent le meilleur souvenir des stagiaires : les veillées, la vie en groupe, les repas ensemble font partie de l'apprentissage. Si vous visez les colos, c'est un bon entraînement.

**L'externat** convient si vous avez des contraintes (travail, famille, budget) ou si la session est près de chez vous. On apprend autant, mais on vit moins le collectif.

**La demi-pension** est un entre-deux : le repas de midi partagé, sans les nuits.

## Comment choisir

1. Regardez d'abord **les dates** : la bonne session est celle que vous pouvez suivre en entier, sans absence.
2. Puis **la distance** : une session en externat à une heure de transport chaque jour fatigue vite.
3. Enfin **le budget**, aides comprises : [Combien coûte le BAFA ?](/blog/combien-coute-le-bafa/)

[Chercher une session près de chez vous](/se-former/sessions/)
