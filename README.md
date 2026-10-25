# Fil Roug'Anim

Le site de l'animation : les sessions BAFA, BAFD, PSC1 et des diplômes professionnels partout
en France (dates, lieu, formule, prix, lien vers chaque organisme), un profil gratuit pour les
candidats, les offres et les pages des structures qui recrutent, et des outils gratuits.
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
| Régions, départements, vacances scolaires par zone, diplômes | `donnees/territoire.yml` |
| Les exemples fictifs (page structure, profil) | `donnees/exemples.yml` |
| La base des comptes (tables, règles d'accès) | `supabase/schema.sql` (à relancer dans Supabase après chaque modification) |
| Les guides | `contenu/guides/*.md` |
| Les pages légales | `contenu/pages/*.md` et `config.yml` (éditeur, SIREN, e-mail) |
| L'apparence | `statique/css/site.css`, `gabarits/` |

## Pages fabriquées : 3 grandes parties, un sujet par page

| Partie | Pages |
|---|---|
| Accueil `/` | les 3 parties enfilées sur le fil rouge, et Bobine, le chat à la pelote (`mascotte` dans morceaux.html) |
| **Se former** `/se-former/` | recherche de sessions, fiches BAFA, BAFD, PSC1, surveillant de baignade, BPJEPS, DEJEPS (`contenu/formations/`), guides « étapes » et « financer » (`partie: se-former`), questions fréquentes ; les sessions : `/se-former/sessions/` (recherche : les 30 plus proches dans la page, toutes les autres dans `sessions.json`), puis région, département, ville, vacances, étape, diplôme, organismes |
| **Trouver un poste** `/trouver-un-poste/` | profil gratuit des candidats et offres publiées depuis les comptes (Supabase, voir docs/COMPTES-SUPABASE.md), une page par offre, liste des offres avec filtres, pages des structures vérifiées `/trouver-un-poste/structures/…`, exemple de profil, guides (stage pratique, contrat, entretien, projet pédagogique, valise de colo ; `partie: trouver-un-poste`) |
| **Outils** `/outils/` | taux d'encadrement, contrat d'engagement éducatif, dates limites du BAFA (`gabarits/outil.html`, `statique/js/outils.js`) |
| **Recruter** `/recruter/` | offre fondateurs (`fondateurs` dans config.yml), ce qui est inclus, comment ça marche |
| **Mon compte** `/compte/` | comptes candidats et structures (Supabase), non indexé ; liens sur le site quand `comptes_ouverts: true` |
| Le site (pied de page) | à propos, contact, classement des sessions, pages légales (`contenu/pages/`) |

Les adresses des versions précédentes (`/bafa/…`, `/sessions/…`, `/formations/…`, `/guides/…`, `/stages-et-jobs/…`) redirigent vers les nouvelles (`ajouter_redirections` dans build.py).
`sitemap.xml`, `robots.txt`, données structurées schema.org (Course, JobPosting, FAQPage, WebSite, fil d'Ariane).

Les prix cités dans les textes (« de 300 à 435 € ») sont recalculés à chaque fabrication à partir des
sessions : `{{ stats.fg_ext.min }}` dans un fichier Markdown ou dans faq.yml.

## Documents

- `docs/PUBLIER.md` : mettre le site en ligne (dépôt, GitHub Pages, domaine OVHcloud, Search Console).
- `docs/METTRE-A-JOUR-LES-SESSIONS.md` : la vérification de chaque semaine.
- `docs/ETAPE-2-OFFRES.md` : les offres de stages et de jobs (format, cadre légal, modèle économique).
- `docs/COMPTES-SUPABASE.md` : les comptes, les vérifications de structures, les alertes du lundi (`outils/alertes.py`).
- `docs/ANALYSE-JOBANIM.md` : la comparaison avec Jobanim et la feuille de route.
- `docs/NOMS.md`, `docs/POSITIONNEMENT.md` : le choix du nom et de ce qui distingue le site.
