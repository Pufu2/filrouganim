# Mettre à jour les sessions, chaque semaine

Objectif : que chaque session du site ait été **vérifiée sur la page de l'organisme il y a moins
de 8 jours**, en tenant dans **1 heure par semaine** au plus.

## Les règles (à respecter à chaque relevé)

1. **Des faits seulement** : dates, ville, département, formule, prix, thème, « complet ».
   Jamais les textes de présentation des organismes, jamais leurs photos ni leurs logos.
2. **Toujours à la source** : la page de l'organisme lui-même. Jamais depuis le portail du
   ministère, formation-animation.com, Animyjob ou un autre comparateur (ce sont leurs bases de données).
3. **Pas l'essentiel d'une base** : on relève les sessions utiles (Île-de-France, les deux
   prochaines vacances scolaires), avec un lien vers chaque page. On ne recopie pas tout le
   catalogue national d'un organisme.
4. **robots.txt** : avant d'ajouter un organisme, ouvrir `https://son-site/robots.txt` et vérifier
   que ses pages de sessions ne sont pas interdites (`Disallow`). Si elles le sont : pas de relevé
   automatique, seulement un lien vers sa page.
5. **Pas de données personnelles** : jamais le nom d'un formateur ou d'un contact, seulement
   l'organisme (personne morale).
6. **Retrait sur demande** : un organisme qui demande à corriger ou à retirer ses sessions est
   servi sous 7 jours (`en_ligne: false` dans organismes.yml et suppression de ses sessions).

## La routine de la semaine (environ 45 minutes)

Pour chaque organisme de `donnees/organismes.yml` qui a des sessions sur le site :

1. Ouvrir sa `page_sessions`.
2. Pour chaque session de `donnees/sessions.yml` de cet organisme :
   - dates, lieu, formule, prix identiques → mettre `verifie_le` à la date du jour ;
   - quelque chose a changé → corriger, puis `verifie_le` à la date du jour ;
   - « complet » → `complet: true` ;
   - la session a disparu ou est annulée → supprimer le bloc ;
   - `source: moteur-de-recherche` → après vérification sur la page, passer à `source: page-organisme`.
3. Ajouter les nouvelles sessions des **deux prochaines vacances scolaires** (voir les périodes
   dans `donnees/territoire.yml`), avec `releve_le` et `verifie_le` à la date du jour.

Une fois par mois : ajouter un organisme de la liste « À trouver » (en bas de organismes.yml),
et ajouter la période suivante dans `territoire.yml` (vacances d'été 2027 : dates officielles
sur education.gouv.fr ou l'Onisep).

Les sessions terminées disparaissent toutes seules du site (il est refabriqué chaque matin) :
on peut supprimer leurs blocs du fichier une fois par mois pour garder le fichier court.

## Contrôler, puis publier

```
python3 build.py --apercu      # aucune erreur ? ouvrir _site/index.html
```

Le message d'enregistrement (commit) : `Sessions : vérification du JJ/MM/AAAA`.
La publication part toute seule une fois la modification sur la branche `main`.

## Avant la toute première mise en ligne

Le premier relevé (25 octobre 2026) a été fait **à partir d'un moteur de recherche**, parce que
l'espace de travail de Claude ne pouvait pas ouvrir les sites des organismes. Toutes les sessions
portent donc `verifie_le: null` et s'affichent « pas encore revérifié ». **Il faut les vérifier une
par une sur les pages des organismes avant de publier**, et compléter formule et prix manquants.

## Proposition : une tâche programmée (pas créée, en attente de l'accord de Pufu2)

- **Quand** : chaque lundi à 7 h 43 (heure de Paris).
- **Quoi** : une nouvelle session Claude, dans ce même environnement, qui suit la routine ci-dessus,
  enregistre les changements sur une branche, et laisse un résumé : sessions confirmées, modifiées,
  supprimées, ajoutées, et pages qu'elle n'a pas pu ouvrir.
- **Ce qu'elle ne fait pas** : publier sur `main`. Pufu2 relit le résumé (5 minutes) et valide.
- **Condition** : l'environnement doit pouvoir ouvrir les sites des organismes (réglage « Network
  access » de l'environnement). Sans cela, elle ne peut que signaler les pages à vérifier à la main.

Texte proposé pour la tâche :

> Dans le dépôt Pufu2/filrouganim, suis docs/METTRE-A-JOUR-LES-SESSIONS.md : revérifie chaque
> session de donnees/sessions.yml sur la page de son organisme, corrige ou supprime ce qui a changé,
> ajoute les sessions des deux prochaines vacances scolaires en Île-de-France, en respectant les
> règles du document (faits seulement, robots.txt, pas de données personnelles). Lance
> `python3 build.py --apercu` pour contrôler, enregistre sur une branche `verif-AAAA-MM-JJ`
> (commits signés « Pufu2 <Pufu2@users.noreply.github.com> »), ne publie rien sur main, et termine
> par un résumé : confirmées, modifiées, supprimées, ajoutées, pages impossibles à ouvrir.
