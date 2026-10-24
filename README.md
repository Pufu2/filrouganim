# Fil Roug'Anim

Comparateur gratuit des sessions BAFA et BAFD, en Île-de-France pour commencer :
dates, lieu, formule et prix, avec le lien vers chaque organisme.
« Ne perds pas le fil de ton anim. »

Site statique fabriqué par `build.py` (repris de Jeuphorie : Markdown + Jinja2 + YAML),
publié sur GitHub Pages à l'adresse https://filrouganim.fr.

## Fabriquer le site

```
pip install -r requirements.txt
python3 build.py --apercu     # pour regarder : ouvrir _site/index.html
python3 build.py              # version en ligne (avec sitemap.xml et robots.txt)
```

## Où modifier quoi

| Quoi | Où |
|---|---|
| Les sessions | `donnees/sessions.yml` (voir `docs/METTRE-A-JOUR-LES-SESSIONS.md`) |
| Les organismes | `donnees/organismes.yml` |
| Départements, vacances scolaires | `donnees/territoire.yml` |
| Les guides | `contenu/guides/*.md` |
| Les pages légales | `contenu/pages/*.md` et `config.yml` (éditeur, SIREN, e-mail) |
| L'apparence | `statique/css/site.css`, `gabarits/` |

## Pages fabriquées

- l'accueil, avec toutes les sessions et les filtres (dans le navigateur, sans serveur) ;
- une page par département, par vacances, et par département et vacances
  (ex. `/bafa/paris/vacances-hiver-2027/`) ;
- une page par étape (formation générale, approfondissement, qualification) et une pour le BAFD ;
- une page par organisme ;
- les guides et les pages légales ;
- `sitemap.xml`, `robots.txt`, données structurées schema.org (Course, CourseInstance, fil d'Ariane).

Les sessions terminées disparaissent toutes seules : le site est refabriqué chaque matin.

## Documents

- `docs/PUBLIER.md` : mettre le site en ligne (dépôt, GitHub Pages, domaine OVHcloud, Search Console).
- `docs/METTRE-A-JOUR-LES-SESSIONS.md` : la vérification de chaque semaine.
- `docs/NOMS.md`, `docs/POSITIONNEMENT.md` : le choix du nom et de ce qui distingue le site.
