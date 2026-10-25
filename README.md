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

## Pages fabriquées : une rubrique, un sujet par page

| Rubrique | Pages |
|---|---|
| Accueil `/` | présentation de tout le site, recherche, prochaines sessions, questions fréquentes |
| Sessions `/sessions/` | toutes les sessions (filtres, « Voir plus ») ; par département `/sessions/paris/`, par ville `/sessions/val-de-marne/creteil/`, par vacances `/sessions/vacances-hiver-2027/`, département + vacances, par étape `/sessions/formation-generale/`, BAFD `/sessions/bafd/`, organismes `/sessions/organismes/…` |
| Formations `/formations/` | BAFA, BAFD, surveillant de baignade, PSC1, BPJEPS, DEJEPS (`contenu/formations/`) |
| Guides `/guides/` | les guides (`contenu/guides/`) et les questions fréquentes (`donnees/faq.yml`) |
| Stages et jobs `/stages-et-jobs/` | les offres (`donnees/offres.yml`, étape 2), une page par offre, la page des recruteurs |
| Le site (pied de page) | à propos, contact, classement des sessions, pages légales (`contenu/pages/`) |

Les anciennes adresses (`/bafa/…`, `/organismes/…`, `/structures/`…) redirigent vers les nouvelles.
`sitemap.xml`, `robots.txt`, données structurées schema.org (Course, JobPosting, FAQPage, WebSite, fil d'Ariane).

Les prix cités dans les textes (« de 300 à 435 € ») sont recalculés à chaque fabrication à partir des
sessions : `{{ stats.fg_ext.min }}` dans un fichier Markdown ou dans faq.yml.

## Documents

- `docs/PUBLIER.md` : mettre le site en ligne (dépôt, GitHub Pages, domaine OVHcloud, Search Console).
- `docs/METTRE-A-JOUR-LES-SESSIONS.md` : la vérification de chaque semaine.
- `docs/ETAPE-2-OFFRES.md` : les offres de stages et de jobs (format, cadre légal, modèle économique).
- `docs/NOMS.md`, `docs/POSITIONNEMENT.md` : le choix du nom et de ce qui distingue le site.
