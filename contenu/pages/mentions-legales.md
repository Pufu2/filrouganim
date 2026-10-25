---
court: Mentions légales
titre: Mentions légales
url: /mentions-legales/
description: "Éditeur, hébergeur et informations légales du site Fil Roug'Anim."
---

## Éditeur du site

{% if site.editeur_ok %}
{{ site.nom }} ({{ site.url }}) est édité par **{{ site.editeur.nom }}**, {{ site.editeur.statut }}.

- Adresse : {{ site.editeur.adresse }}
- SIREN : {{ site.editeur.siren }}
- Contact : {{ site.email }}
- Directeur de la publication : {{ site.editeur.nom }}
{% else %}
{{ site.nom }} ({{ site.url }}) est édité **à titre non professionnel** par Rafaël, directeur adjoint d'accueil de loisirs et créateur de [Jeuphorie](https://jeuphorie.fr). Comme la loi le permet à un éditeur non professionnel, les éléments permettant de l'identifier sont détenus par l'hébergeur. Ces mentions seront complétées (nom, adresse, SIREN) dès que le site aura une activité commerciale.

- Contact : {{ site.email }}
- Directeur de la publication : Rafaël
{% endif %}

## Hébergeur

{{ site.hebergeur.nom }}, {{ site.hebergeur.adresse }}. Téléphone : {{ site.hebergeur.telephone }}. Site : {{ site.hebergeur.site }}.

## Contenus et sources

Les textes, guides et la présentation du site sont la propriété de l'éditeur. Les informations sur les sessions (dates, lieu, formule, prix) sont des **faits** relevés sur les pages publiques des organismes de formation, avec un lien vers chacune d'elles. Les noms des organismes et leurs marques appartiennent à leurs titulaires. Le site n'est lié à aucun organisme de formation ni au ministère chargé de la jeunesse.

Un organisme qui souhaite corriger une information ou ne plus apparaître peut écrire à {{ site.email }} : la demande est traitée sous 7 jours.

## Responsabilité

Les informations sont données à titre indicatif et peuvent changer à tout moment chez l'organisme. Elles ne remplacent pas la page de l'organisme ni les textes officiels. Voir les [conditions d'utilisation](/conditions-utilisation/).
