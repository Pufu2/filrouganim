# Charte graphique de Fil Roug'Anim

C'est la référence pour toute page nouvelle ou refaite. On ne réinvente rien page par page : on choisit un des
**modèles** ci-dessous et on assemble les **composants** existants. Les styles sont dans `statique/css/da.css`
(qui corrige `site.css`) ; les anciens styles (`.bande`, `.cadre.texte`, `.cartes-liens`, `.lc-bloc`…) ne servent
plus pour du neuf.

## 1. Les fondations

| Jeton | Valeur | Usage |
|---|---|---|
| Nuit | `#17191d` | haut des pages, barre du menu, pied, carte d'action |
| Fond | `#f4f4f2` | fond de toutes les pages refaites (`.fs`) |
| Carte | `#fff`, bord `1px rgba(23,25,29,.09)` (`--fs-t`), rayon **16px** | tout bloc de contenu |
| Texte | `#17191d` (`--fs-e`) ; secondaire `#6c7077` (`--fs-d`) ; corps de texte long `#2a2d33` | |
| Rouge | `#d61f35` (boutons, surtitres, puces) ; foncé `#a8162a` (liens, « Lire → ») | seulement ce qu'il faut voir |
| Couleur d'une structure | `--theme` / `--theme-fonce` (classes `theme-*`) | touches sur les fiches, jamais en aplat |
| Police | Inter ; 400 texte, 500 accent, 600 titres (le 600 a le dessin du 500 : rester fin) | |
| Rayons | cartes 16px, ruban 18px, boutons 9-10px, pastilles 6px, puces 99px | |
| Ombre | une seule, sous le ruban et au survol des cartes : `0 14px 30px -20px rgba(23,25,29,.35)` | |

Typographie :
- **Surtitre** `.fs-sur` : 0.74rem, 600, capitales, interlettrage .12em, rouge. Toujours au-dessus d'un titre de section.
- **Titre de section** `.fs-tt h2` : 1.75rem, 600, -0.02em.
- **H1 du haut** : blanc, 600, `clamp(2rem, 4.2vw, 3.05rem)` en lecture, plus grand sur les fiches.
- **Texte long** : 1.04rem, interligne 1.75 ; le premier paragraphe sert de chapeau (1.17rem, filet dessous).

Ton : vouvoiement chaleureux sur le site ; pas de décor enfantin (ni écriture manuscrite, ni fil qui serpente, ni
ronds de couleur). Pas d'emoji dans l'interface.

## 2. Les composants

| Composant | Classes | Rôle |
|---|---|---|
| Haut foncé | `.fs-haut` > `.fs-haut-fond` + `.cadre.fs-haut-in` | fil d'Ariane `.fs-ariane`, puces `.fs-puces` (la 1re `.fs-puce-fort` = la rubrique), `h1`, accroche `.fs-accroche` |
| Ruban | `.fs-ruban` (liens avec icône `.fs-k`) ou `.fs-ruban.sjf-ruban` (liste `small` / `b` / `em`) | 3 à 5 repères chiffrés, à cheval sur le haut (marge négative) |
| Barre des sections | `.fs-sections` > `.fs-sections-liens` + `.fs-sections-boutons` | collée sous le menu, sur les fiches longues |
| Section | `.fs-s` > `.fs-tt` (`.fs-sur` + `h2` + `p`) | chaque bloc de page |
| Carte | `.fs-carte` | fond blanc, bord fin, rayon 16 |
| Rangée | `.fs-rang` (`b` + `small` à gauche, `.fs-lp` à droite) | listes dans une carte, séparées par un filet |
| Pastille d'état | `.fs-etat`, `.fs-jaune` | « Complet », « Nouveau »… |
| Boutons | `.fs-btn.fs-btn-r` (rouge, action principale), `.fs-btn.fs-btn-b` (blanc bordé), `.fs-btn-large` | un seul bouton rouge par zone |
| Questions | `.le-faq` (lecture) ou `.fs-faq` (fiches) | repliées, signe + qui tourne |
| Carte d'action | macro `m.le_action(...)` → `.le-action` | carte foncée de la colonne de côté : surtitre, titre, phrase, bouton rouge, lien secondaire |
| Cartes « à lire » | macro `m.le_cartes(...)` → `.le-cartes` | 3 par ligne (2 en tablette, 1 en téléphone) : surtitre rouge, titre, résumé, « Lire → » |
| Coup de pouce | macro `m.le_pouce(site)` → `.le-pouce` | bandeau fin Jeuphorie, en bas des pages de lecture |
| Verrous | `.vr-*` | ce qui est réservé aux abonnés, avec cadenas rouge |
| Formulaires | `.fm-*` | blocs de réglages titrés (espaces connectés) |

## 3. Les modèles de page

1. **Fiche** (`structure.html`, `sejour.html`, `exemple-profil.html`) : haut photo ou couleur, ruban, barre des
   sections, sections `.fs-s` ; grille `.sjf-grille` (contenu + carte collante à droite) quand il y a une action.
2. **Lecture** (`lecture.html`, dont héritent `guide`, `article`, `formation`, `page`, `faq`, `lexique`) : haut
   foncé à halos, ruban facultatif (`le_ruban`), texte dans une carte `.le-texte`, colonne de côté collante
   (`.le-cote` : sommaire automatique à partir des `##` du Markdown dès 3 parties, puis carte d'action), « Pour
   aller plus loin » en cartes, coup de pouce. Le Markdown est habillé par le filtre `habiller` : tableaux encadrés
   (`.le-table`, un tableau sans en-tête devient une liste clé / valeur `.le-cles`), lignes « Source : » en petit.
   Blocs à remplir : `le_puces`, `le_chapo`, `le_ruban`, `le_texte` (ou `le_texte_fin`), `le_cote`, `le_suite`.
3. **Liste / local** (`liste.html`, `local.html`, `ecoles.html`) : haut foncé, ruban de chiffres, recherche ou
   filtres, résultats en cartes ou rangées dans des `.fs-carte`, voisins en puces.
4. **Portail** (pages `hub`, `/recruter/`, `/enfants/`, l'annuaire `/recruter/structures/`) : haut foncé, recherche ou
   ruban, barre des sections qui suit (`.fs-sections`, surlignée par `lecture.js`), blocs `.fs-s`, questions, dernier
   appel `.rc2-fin`. Un annuaire a sa propre page (pour ceux qui cherchent), séparée de la page qui présente le service
   (pour ceux qui s'inscrivent).
5. **Espace connecté** (`compte.html`) : tableau de bord `.tb2-*`, formulaires `.fm-*`, verrous `.vr-*`, visite
   guidée `visite.js`.

## 4. Les règles

- Une page = un modèle. Si rien ne colle, on étend un modèle (un bloc de plus), on n'en crée pas un à part.
- Toujours un surtitre rouge + un titre pour une section ; jamais deux boutons rouges côte à côte.
- Une page lourde se **range** (sommaire, sections, cartes, tableaux, replis), elle ne se cache pas.
- Responsive : 980px (une colonne, la colonne de côté passe sous le texte, sommaire replié en haut) et 700px
  (cartes sur une colonne, marges 16-20px). Aucune largeur fixe qui déborde ; vérifier `scrollWidth = 390`.
- Vérifier chaque modèle modifié en capture (1440 et 390) avant de le dire fini.

## 5. L'harmonie des anciennes pages

Les pages pas encore refaites (sessions, écoles, accueil, blog, outils, chiffres…) gardent leur HTML, mais une couche
« HARMONIE » à la fin de `da.css` leur donne le langage de la charte : haut foncé avec rubrique en pastille, fond
#f4f4f2, titres de section à la taille de `.fs-tt`, textes dans des cartes blanches, listes de liens en cartes, questions
comme `.le-faq`, étapes comme `.rc2-etapes`, encart Jeuphorie comme `.le-pouce`. Une page qu'on refait passe sur un modèle
(§ 3) ; la couche reste pour les autres.

## 6. Les illustrations

On ne dessine pas nos propres illustrations : on prend des illustrations existantes sous licence libre, d'une seule
collection pour garder une unité. Collection retenue : **unDraw** (undraw.co, usage libre même commercial, sans
attribution), recolorée dans la teinte de la partie (`#6c63ff` remplacé par `--theme`, gris clairs en crème). Fichiers
dans `statique/illus/`. Usage : la carte claire à droite du haut (`.en3-illus`) et le haut des cartes (`.en3-vignette`),
sur la partie parents seulement.

Où on en met (une seule par page, jamais sur les pages de liste) :
- **le haut des pages d'entrée**, fondue dans le fond foncé (`m.ill_haut("nom")` → `statique/illus/<nom>-nuit.svg`, recolorée
  pour le noir : gris clairs en ombres, traits en crème, accent dans la couleur de la partie) : se former, offres,
  structures, annuaire, aides, demande, blog, organismes partenaires ; « Inscrire mon enfant » a sa scène à elle ;
- **les vignettes des cartes d'orientation** (version claire `<nom>.svg` sur fond crème) : les 4 usages de l'accueil,
  les 3 types d'accueil de « Inscrire mon enfant » ;
- **les messages « rien trouvé »** (`.aucune`) : `vide.svg`.
Pour en ajouter une : la prendre sur undraw.co, la passer dans le script de recoloration (fond clair et fond foncé,
accent `#d61f35` ou `#ee8a2f` pour la partie parents).


## 7. Le téléphone

Sous 700px, le site se comporte comme une application. Tout est dans `statique/css/telephone.css`, chargée seulement
sous 700px (`media="(max-width: 700px)"` dans `base.html`) : l'ordinateur et la tablette ne peuvent pas bouger. Le
comportement est dans `statique/js/telephone.js` (et les replis de listes dans `menu.js`).

- **Le haut** : une barre fine et sombre pleine largeur (logo, rond « Mon espace »), sans menu ni chiffres. Le fil d'Ariane
  devient un seul « ‹ page parente ». Les pastilles du haut défilent sur une ligne.
- **La barre d'onglets du bas** (`.tel-onglets`, dans `base.html`) : Se former, Offres, le logo au milieu (Accueil, gris quand on
  est ailleurs, en couleur quand on y est), Enfants, Menu. Une page qui a sa propre barre d'action en bas (fiche séjour) la cache.
- **Le menu** s'ouvre en feuille depuis le bas (titre, croix, les 4 parties, le compte, les pages du pied, les mentions).
- **Le pied de page** est caché : ses pages sont dans le menu, ses liens restent dans la page.
- **En lisant**, le haut et la barre du bas s'effacent quand on descend et reviennent dès qu'on remonte.
- **Les familles de cartes** (atouts, aides, étapes) défilent de côté, la suivante dépasse. Les cartes « à lire » et les longues
  listes de liens deviennent des lignes ; les listes « par ville », « par vacances »… se replient derrière leur titre.
- **Boutons** : 48px de haut, rayon 12px ; cartes : rayon 18px.
- **Mon espace** : la barre du bas remplace celle du haut ; le logo au milieu ouvre le tableau de bord, de part et d'autre les
  3 rubriques suivantes du menu de l'espace, et « Menu » pour le reste.
