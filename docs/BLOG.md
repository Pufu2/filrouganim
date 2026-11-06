# Le blog et le lexique

## Écrire un article

1. Créer `contenu/blog/mon-article.md` (le nom du fichier devient l'adresse : `/blog/mon-article/`).
2. Mettre en tête :

```
---
titre: "Le titre, avec le mot que les gens cherchent"
court: Titre court (fil d'Ariane)
description: "Une phrase de 140 à 160 caractères pour Google."
resume: "Une phrase pour la liste des articles."
categorie: Se former   # ou Budget, Métiers, Sur le terrain
date: 2026-12-18       # un article daté dans le futur attend son jour : il sort tout seul
---
```

3. Écrire en Markdown. Les chiffres du site peuvent s'écrire entre accolades et se recalculent chaque nuit :
   `{{ c.fg.med | euros }}` (prix médian de la formation générale), `c.appro`, `c.qualif`, `c.bafd`, `c.psc`
   (chacun avec `n`, `med`, `min`, `max`), `c.total`, `c.themes`, `c.periodes`, `c.deps_moins_chers`, `c.deps_plus_fournis`.

## Le rythme

- Les articles déjà écrits sortent un par semaine (le vendredi), selon leur `date`.
- Chaque mois, le relevé de nuit écrit `donnees/bilans/AAAA-MM.yml` (`python3 build.py --bilan`) : ce bilan devient
  automatiquement l'article « Les formations BAFA en … : prix, villes et tendances ».

## Le lexique

Un mot par entrée dans `donnees/lexique.yml` : `id` (l'adresse), `terme`, `court`, `definition`, `voir` (d'autres mots)
et `liens` (des pages du site). Chaque mot a sa page `/lexique/<id>/`.
