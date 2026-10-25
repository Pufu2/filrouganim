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
| Les sessions | `donnees/sessions.yml`, réécrit par `outils/relever.py` (voir `docs/METTRE-A-JOUR-LES-SESSIONS.md`) |
| Les organismes | `donnees/organismes.yml` |
| Départements, vacances scolaires | `donnees/territoire.yml` |
| Les guides | `contenu/guides/*.md` |
| Les pages légales | `contenu/pages/*.md` et `config.yml` (éditeur, SIREN, e-mail) |
| L'apparence | `statique/css/site.css`, `gabarits/` |

## Pages fabriquées

- l'accueil (page de garde) : recherche en cases (où, quand, étape, budget, mot-clé), les 4 portes
  d'entrée du site, les prochaines sessions, les étapes, les questions fréquentes ;
- `/sessions/` : toutes les sessions, filtres en direct dans le navigateur, « Voir plus » par 10 ;
- une page par département, par vacances, par département et vacances, par étape, pour le BAFD,
  et par organisme ;
- `/formations/` : BAFA, BAFD, surveillant de baignade, PSC1, BPJEPS, DEJEPS (`contenu/formations/`) ;
- `/guides/` (`contenu/guides/`), `/questions-frequentes/` (`donnees/faq.yml`) ;
- `/stages-et-jobs/`, `/structures/`, `/a-propos/`, `/contact/` et les pages légales (`contenu/pages/`) ;
- `sitemap.xml`, `robots.txt`, données structurées schema.org (Course, FAQPage, WebSite, fil d'Ariane).

Les prix cités dans les textes (« de 300 à 435 € ») sont recalculés à chaque fabrication à partir des
sessions : `{{ stats.fg_ext.min }}` dans un fichier Markdown ou dans faq.yml.

## Documents

- `docs/PUBLIER.md` : mettre le site en ligne (dépôt, GitHub Pages, domaine OVHcloud, Search Console).
- `docs/METTRE-A-JOUR-LES-SESSIONS.md` : la vérification de chaque semaine.
- `docs/NOMS.md`, `docs/POSITIONNEMENT.md` : le choix du nom et de ce qui distingue le site.
