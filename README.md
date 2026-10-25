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

## Pages fabriquées : 3 grandes parties, un sujet par page

| Partie | Pages |
|---|---|
| Accueil `/` | les 3 parties enfilées sur le fil rouge, chacune avec ses sous-parties |
| **Se former** `/se-former/` | recherche de sessions, fiches BAFA, BAFD, PSC1, surveillant de baignade, BPJEPS, DEJEPS (`contenu/formations/`), guides « étapes » et « financer » (`partie: se-former`), questions fréquentes ; les sessions : `/se-former/sessions/` puis département, ville, vacances, étape, BAFD, organismes |
| **Animateurs** `/animateurs/` | inscription gratuite aux offres (formulaire Brevo, `inscription_animateurs` dans config.yml), les offres (`donnees/offres.yml`, une page par offre), guides « stage pratique » et « contrat » (`partie: animateurs`) |
| **Recruteurs** `/recruteurs/` | offre fondateurs (`fondateurs` dans config.yml), ce qui est inclus, comment publier |
| Le site (pied de page) | à propos, contact, classement des sessions, pages légales (`contenu/pages/`) |

Les adresses des versions précédentes (`/bafa/…`, `/sessions/…`, `/formations/…`, `/guides/…`, `/stages-et-jobs/…`) redirigent vers les nouvelles (`ajouter_redirections` dans build.py).
`sitemap.xml`, `robots.txt`, données structurées schema.org (Course, JobPosting, FAQPage, WebSite, fil d'Ariane).

Les prix cités dans les textes (« de 300 à 435 € ») sont recalculés à chaque fabrication à partir des
sessions : `{{ stats.fg_ext.min }}` dans un fichier Markdown ou dans faq.yml.

## Documents

- `docs/PUBLIER.md` : mettre le site en ligne (dépôt, GitHub Pages, domaine OVHcloud, Search Console).
- `docs/METTRE-A-JOUR-LES-SESSIONS.md` : la vérification de chaque semaine.
- `docs/ETAPE-2-OFFRES.md` : les offres de stages et de jobs (format, cadre légal, modèle économique).
- `docs/NOMS.md`, `docs/POSITIONNEMENT.md` : le choix du nom et de ce qui distingue le site.
