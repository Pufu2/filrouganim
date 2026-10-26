# Mettre à jour les sessions, chaque semaine

Objectif : que chaque session du site ait été **vérifiée sur la page de l'organisme il y a moins
de 8 jours**, en tenant dans **1 heure par semaine** au plus.

## Les règles (à respecter à chaque relevé)

1. **Des faits seulement** : dates, ville, département, formule, prix, thème, « complet ».
   Jamais les textes de présentation des organismes, jamais leurs photos ni leurs logos.
2. **Toujours à la source** : la page de l'organisme lui-même. Jamais depuis le portail du
   ministère, formation-animation.com, Animyjob ou un autre comparateur (ce sont leurs bases de données).
3. **Pas l'essentiel d'une base** : on relève une **sélection** (France métropolitaine et Corse,
   les 10 prochains mois), avec un lien vers chaque page : par organisme, une session par
   département, par vacances scolaires (ou par mois hors vacances), par diplôme et par étape.
   On ne recopie jamais tout le catalogue d'un organisme.
4. **robots.txt** : l'outil le lit à chaque page, et **ne lit jamais un site qui ferme sa porte aux
   robots d'IA** (ClaudeBot, anthropic-ai…). C'est le cas de bafaidf.com (FSCF) et de cemea-idf.org
   (CEMEA) au 25/10/2026 : leurs sessions ne seront ajoutées qu'avec leur accord écrit.
   Avant d'ajouter un organisme, ouvrir `https://son-site/robots.txt` et vérifier
   que ses pages de sessions ne sont pas interdites (`Disallow`). Si elles le sont : pas de relevé
   automatique, seulement un lien vers sa page.
5. **Pas de données personnelles** : jamais le nom d'un formateur ou d'un contact, seulement
   l'organisme (personne morale).
6. **Retrait sur demande** : un organisme qui demande à corriger ou à retirer ses sessions est
   servi sous 7 jours (`en_ligne: false` dans organismes.yml et suppression de ses sessions).

## La routine de la semaine (environ 15 minutes)

L'outil `outils/relever.py` fait le relevé pour (au 26/10/2026) :

| Organisme | Ce qui est lu | Où |
|---|---|---|
| AFOCAL | BAFA, BAFD | les listes de chaque région, puis chaque fiche |
| IFAC | BAFA, BAFD, CQP, CPJEPS, BPJEPS, DEJEPS, DESJEPS | la liste nationale (une page), puis la fiche des sessions retenues |
| UFCV | BAFA, BAFD | la liste de chaque département, puis la fiche des sessions retenues |
| Ligue de l'enseignement Île-de-France | BAFA, BAFD | sa boutique en ligne |
| Protection civile | PSC1 | la liste nationale écrite dans la page de la formation |

Un organisme dont la page a changé de forme ne bloque pas les autres : ses sessions déjà relevées
sont gardées telles quelles (sans nouvelle date de vérification), et le résumé le signale.

```
pip install -r requirements.txt
python3 outils/relever.py --essai   # affiche ce qui changerait, sans rien écrire
python3 outils/relever.py           # réécrit donnees/sessions.yml
```

Il lit robots.txt, parcourt les listes, applique la sélection (la première session non complète,
par date puis par prix), relit la fiche des sessions retenues (tarifs, places), garde la date du
premier relevé et met `verifie_le` à la date du jour. Il affiche : sessions par organisme et par
diplôme, départements couverts, confirmées, modifiées, ajoutées, retirées. Durée : de 30 à
60 minutes (une pause de 0,6 seconde entre deux pages, pour ne pas charger les sites).

Puis, à la main :

1. Relire le résumé : un nombre de sessions qui s'effondre (0 retenue, par exemple) veut dire
   qu'un site a changé de forme. Dans ce cas, ne pas enregistrer : ouvrir la page et corriger l'outil.
2. Ouvrir 2 ou 3 sessions au hasard sur le site de l'organisme et comparer (dates, prix).
3. Une fois par an (au printemps) : ajouter les vacances de l'année scolaire suivante dans
   `donnees/territoire.yml`, **zone par zone** (A, B, C ; dates officielles sur l'Onisep), et
   remplacer la fin provisoire de l'été (31 août) par la date de la rentrée.
   Une fois par mois : un organisme de la liste « À trouver »
   (en bas de organismes.yml). Un nouvel organisme demande d'ajouter sa lecture dans l'outil ;
   en attendant, ses sessions peuvent être saisies à la main dans sessions.yml (même format).

Les sessions terminées disparaissent toutes seules du site (il est refabriqué chaque matin).

## Contrôler, puis publier

```
python3 build.py --apercu      # aucune erreur ? ouvrir _site/index.html
```

Le message d'enregistrement (commit) : `Sessions : vérification du JJ/MM/AAAA`.
La publication part toute seule une fois la modification sur la branche `main`.


## Les diplômes professionnels (CPJEPS, BPJEPS, DEJEPS, DESJEPS) : automatique depuis le 26/10/2026

`outils/relever_pro.py` lit des sources nationales, **toutes écoles confondues** (CREPS, associations,
organismes privés, CFA…), et écrit `donnees/sessions-pro.yml` (ne pas modifier à la main) :

1. **Catalogue national des formations en apprentissage** (Réseau des Carif-Oref, API ouverte :
   https://catalogue-apprentissage.intercariforef.org/api/docs/ ; présenté sur data.gouv.fr,
   « Catalogue Apprentissage »). C'est l'offre reprise par La bonne alternance et Parcoursup.
   Le bouton « Voir » ouvre la fiche de la formation sur La bonne alternance (contact de l'école).
   En apprentissage, la formation est gratuite pour l'apprenti (Code du travail, art. L6211-1) :
   le site affiche « Gratuit, en apprentissage ».
2. **API Offre Info** (Réseau des Carif-Oref) : toute l'offre de formation (pas seulement
   l'apprentissage), avec les prix. Il faut un jeton gratuit, à demander par e-mail (voir plus bas).
   Une fois reçu, le coller dans GitHub : Settings > Secrets and variables > Actions >
   New repository secret, nom `RCO_OFFREINFO_TOKEN`. L'outil s'en sert tout seul au relevé suivant.
   Conditions du RCO : citer la source avec son logo, ne jamais vendre ces données, ne pas
   transmettre le jeton.

Le site intercariforef.org lui-même (pages de recherche) n'est **pas** recopié : ses conditions
d'utilisation demandent une autorisation pour toute reproduction.

Les spécialités (ASEC, LTP, APT, AF, AAN, équitation…) sont dans `donnees/specialites.yml`, avec
leurs codes Certif Info. Une session dont le code est inconnu est rattachée par les mots de son
intitulé ; si une nouvelle mention apparaît, l'ajouter dans ce fichier.

### Le relevé automatique (GitHub Actions, `.github/workflows/relever.yml`)

- **Chaque nuit** (3 h 41 UTC) : diplômes professionnels.
- **Le lundi et le jeudi** : en plus, BAFA, BAFD et PSC1 (`outils/relever.py`).
- Le site est refabriqué pour contrôle ; si les données ont changé, elles sont enregistrées sur
  `main` (commit « Sessions : relevé du JJ/MM/AAAA », signé Pufu2) et le site les publie à la
  fabrication horaire suivante.
- Une source en panne ne vide pas le site : ses sessions actuelles sont gardées.
- Bouton « Run workflow » (onglet Actions > « Relever les sessions ») pour tout relever à la demande.

### Demander le jeton Offre Info (Pufu2, 2 minutes)

Depuis l'adresse de contact du site (config.yml, champ `email`), à api-offreinfo@intercariforef.org :

> Objet : Demande d'accès à l'API Offre Info – Fil Roug'Anim
>
> Bonjour,
>
> J'édite Fil Roug'Anim (https://filrouganim.fr), un site gratuit qui aide les jeunes et les
> animateurs à trouver une formation dans l'animation (BAFA, BAFD, CPJEPS, BPJEPS, DEJEPS, DESJEPS)
> partout en France.
>
> Je souhaiterais obtenir un jeton d'accès à l'API Offre Info pour afficher les sessions des
> formations CPJEPS, BPJEPS, DEJEPS et DESJEPS (dates, lieu, organisme, prix), avec un lien vers
> la fiche de chaque formation. Les données seraient lues une fois par jour au plus, affichées
> gratuitement, jamais revendues, avec la mention de la source et le logo du Réseau des Carif-Oref.
>
> Je reste à votre disposition pour toute précision ou pour signer le contrat d'interface.
>
> Bien cordialement,
> L'équipe Fil Roug'Anim

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
