---
court: Confidentialité
titre: Confidentialité
url: /confidentialite/
description: "Fil Roug'Anim ne demande aucun compte, ne dépose aucun cookie et ne collecte aucune donnée personnelle."
---

**En bref : pas de compte, pas de cookie, pas de publicité.** Vous consultez le site sans rien nous donner{% if site.inscription_animateurs %}, sauf si vous vous inscrivez aux offres (voir plus bas){% endif %}.

## Ce que le site ne fait pas

- Il ne demande **aucun compte**.{% if not site.inscription_animateurs %} Il ne contient **aucun formulaire**.{% endif %}
- Il ne dépose **aucun cookie**, ni publicitaire ni de mesure d'audience.
- Les filtres de recherche fonctionnent **dans votre navigateur** : vos choix ne sont envoyés à personne. Ils s'affichent seulement dans l'adresse de la page, pour que vous puissiez la partager.

## Ce qui peut être enregistré malgré tout

- **L'hébergeur** ({{ site.hebergeur.nom }}) enregistre des journaux techniques, dont l'adresse IP, pour la sécurité et le bon fonctionnement du service. Voir sa [déclaration de confidentialité](https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement).
{% if site.goatcounter %}- **La mesure d'audience** utilise GoatCounter, un outil **sans cookie** qui compte les visites de façon agrégée, sans suivre les personnes d'un site à l'autre.
{% endif %}- **Google Search Console** nous montre comment le site apparaît dans les résultats de Google (nombre de clics, recherches tapées), de façon agrégée. Ces données viennent de Google, pas du site.

{% if offres %}## Les offres de stages et de jobs

Les offres sont publiées par les structures qui recrutent. L'adresse de candidature affichée est celle que la structure a choisie (de préférence une adresse générique). Le site ne reçoit aucune candidature et ne publie aucun CV.

{% endif %}{% if site.inscription_animateurs %}## L'inscription des animateurs aux offres

Si vous vous inscrivez sur la page Trouver un poste, nous gardons votre adresse e-mail, votre département et votre profil, pour vous envoyer les offres de votre département, rien d'autre. Ces données sont hébergées par Brevo, prestataire français d'envoi d'e-mails, qui envoie les e-mails pour nous. Elles ne sont jamais montrées aux structures ni vendues. Un lien de désinscription figure dans chaque e-mail ; les données sont supprimées à la désinscription, ou après 2 ans sans ouverture d'e-mail.

{% endif %}## Liens vers d'autres sites

Les boutons « Voir chez… » mènent aux sites des organismes, qui ont leurs propres règles de confidentialité.

## Vos droits

Pour toute question : {{ site.email }}. Vous pouvez aussi saisir la [CNIL](https://www.cnil.fr/fr/plaintes).
