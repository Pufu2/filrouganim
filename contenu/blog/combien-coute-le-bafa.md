---
titre: "Combien coûte le BAFA ? Les vrais prix, session par session"
court: Combien coûte le BAFA ?
description: "Le prix du BAFA calculé sur toutes les sessions relevées : formation générale, approfondissement, internat ou externat, et ce qui reste à payer après l'aide de la CAF."
resume: "Les prix médians de la formation générale et de l'approfondissement, recalculés chaque nuit."
categorie: Budget
date: 2026-11-06
---

Le BAFA n'a pas de prix unique : chaque organisme fixe le sien, et il change avec la formule. Plutôt que des fourchettes au hasard, voici les prix **calculés sur les sessions relevées sur Fil Roug'Anim** ({{ c.total }} sessions à venir aujourd'hui).

## Les deux sessions payantes

Le BAFA compte deux sessions payantes : la **formation générale** et l'**approfondissement** (ou la qualification). Le stage pratique, au milieu, ne coûte rien et il est souvent payé.

| Session | Prix médian | Du moins cher au plus cher | Sessions relevées |
|---|---|---|---|
| Formation générale | {{ c.fg.med | euros }} | {{ c.fg.min | euros }} à {{ c.fg.max | euros }} | {{ c.fg.n }} |
| Approfondissement | {{ c.appro.med | euros }} | {{ c.appro.min | euros }} à {{ c.appro.max | euros }} | {{ c.appro.n }} |
| Qualification (surveillant de baignade…) | {{ c.qualif.med | euros }} | {{ c.qualif.min | euros }} à {{ c.qualif.max | euros }} | {{ c.qualif.n }} |

Le **prix médian** coupe les sessions en deux : la moitié coûte moins, l'autre moitié plus. Il est plus juste qu'une moyenne, que quelques sessions très chères tirent vers le haut.

## Le calcul complet

Avec les prix médians d'aujourd'hui :

- formation générale : {{ c.fg.med | euros }} ;
- approfondissement : {{ c.appro.med | euros }} ;
- aide nationale de la CAF : − 200 € ;
- **reste à payer : {{ ((c.fg.med or 0) + (c.appro.med or 0) - 200) | euros }}** environ.

L'aide de la CAF (200 €, sans condition de ressources) se demande **après la dernière session**, dans les 3 mois. Votre mairie, votre département ou un futur employeur peuvent aider en plus : tout est dans [Financer son BAFA](/se-former/financer-son-bafa/).

## Pourquoi un tel écart de prix ?

- **La formule** : l'internat (logé, nourri) coûte plus cher que l'externat. [Internat ou externat ?](/blog/bafa-internat-ou-externat/)
- **L'organisme** : associations nationales, mouvements d'éducation populaire, organismes régionaux n'ont pas les mêmes tarifs.
- **Le lieu et la saison** : une session à la montagne en février ne coûte pas comme un externat en ville en novembre.

## Payer moins cher

1. Comparez les sessions **de votre département et des départements voisins** : on peut suivre chaque session où l'on veut.
2. Regardez l'**externat** si vous pouvez rentrer le soir.
3. Demandez les **aides locales** avant de vous inscrire : certaines doivent être demandées avant la formation.

[Comparer les sessions et leurs prix](/se-former/sessions/bafa/)
