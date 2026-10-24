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

## La routine de la semaine (environ 15 minutes)

L'outil `outils/relever.py` fait le relevé pour AFOCAL et l'IFAC :

```
pip install -r requirements.txt
python3 outils/relever.py --essai   # affiche ce qui changerait, sans rien écrire
python3 outils/relever.py           # réécrit donnees/sessions.yml
```

Il lit robots.txt, parcourt les listes Île-de-France, lit chaque fiche (dates, lieu, thème, prix,
places), applique la sélection (une session par organisme, département, vacances et étape : la
première non complète, par date puis par prix), garde la date du premier relevé et met
`verifie_le` à la date du jour. Il affiche : confirmées, modifiées, ajoutées, retirées.

Puis, à la main :

1. Relire le résumé : un nombre de sessions qui s'effondre (0 retenue, par exemple) veut dire
   qu'un site a changé de forme. Dans ce cas, ne pas enregistrer : ouvrir la page et corriger l'outil.
2. Ouvrir 2 ou 3 sessions au hasard sur le site de l'organisme et comparer (dates, prix).
3. Une fois par mois : ajouter la période de vacances suivante dans `donnees/territoire.yml`
   (dates officielles sur education.gouv.fr ou l'Onisep), et un organisme de la liste « À trouver »
   (en bas de organismes.yml). Un nouvel organisme demande d'ajouter sa lecture dans l'outil ;
   en attendant, ses sessions peuvent être saisies à la main dans sessions.yml (même format).

Les sessions terminées disparaissent toutes seules du site (il est refabriqué chaque matin).

## Contrôler, puis publier

```
python3 build.py --apercu      # aucune erreur ? ouvrir _site/index.html
```

Le message d'enregistrement (commit) : `Sessions : vérification du JJ/MM/AAAA`.
La publication part toute seule une fois la modification sur la branche `main`.

## La tâche programmée (créée le 24 octobre 2026 avec l'accord de Pufu2)

- **Quand** : chaque lundi à 7 h 43 (heure de Paris).
- **Quoi** : une nouvelle session Claude, dans ce même environnement, qui suit la routine ci-dessus,
  enregistre les changements sur une branche, et laisse un résumé : sessions confirmées, modifiées,
  supprimées, ajoutées, et pages qu'elle n'a pas pu ouvrir.
- **Ce qu'elle ne fait pas** : publier sur `main`. Pufu2 relit le résumé (5 minutes) et valide.
- **Condition** : l'environnement doit pouvoir ouvrir les sites des organismes (réglage « Network
  access » de l'environnement). Sans cela, elle ne peut que signaler les pages à vérifier à la main.

Pour valider : relire le résumé, puis demander à Claude (ou faire soi-même) la fusion de la
branche `verif-AAAA-MM-JJ` dans `main`. La publication part alors toute seule.

Texte de la tâche :

> Vérification hebdomadaire des sessions de Fil Roug'Anim. Rattache et clone le dépôt
> Pufu2/filrouganim, lis docs/METTRE-A-JOUR-LES-SESSIONS.md, lance `python3 outils/relever.py`
> puis `python3 build.py --apercu`, contrôle 3 sessions au hasard sur le site de l'organisme,
> enregistre sur une branche `verif-AAAA-MM-JJ` (commits signés « Pufu2
> <Pufu2@users.noreply.github.com> »), ne publie rien sur main, et termine par un résumé.
