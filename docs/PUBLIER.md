# Mettre Fil Roug'Anim en ligne

**Rien n'est publié tant que ces étapes ne sont pas faites, et elles ne se font qu'avec l'accord de Pufu2.**
Avant la mise en ligne : revérifier toutes les sessions (voir METTRE-A-JOUR-LES-SESSIONS.md) et
remplir `config.yml` (adresse e-mail ; nom, adresse et SIREN dès la déclaration de la micro-entreprise).

## 1. Créer le dépôt (Pufu2, 2 minutes)

Claude ne peut pas créer de dépôt sur le compte GitHub. Sur https://github.com/new :
- Repository name : `filrouganim`
- Private (on le passera en Public au moment de publier : GitHub Pages gratuit demande un dépôt public)
- Ne rien cocher d'autre (pas de README), puis « Create repository ».

Ensuite, Claude y copie le dossier `filrouganim/` du dépôt Jeuphorie, avec son historique.

## 2. Activer GitHub Pages

Dans le dépôt : Settings → Pages → Source : **GitHub Actions**. Puis, dans
`.github/workflows/publier.yml`, retirer les « # » devant `push` et `schedule` : la publication
partira alors toute seule à chaque modification de la branche `main`, et chaque matin.
Le dépôt doit passer en **Public** (Settings → General → Danger Zone → Change visibility) :
GitHub Pages gratuit ne publie que les dépôts publics.

## 3. Relier le domaine filrouganim.fr (OVHcloud)

1. Dans GitHub : Settings → Pages → Custom domain : `filrouganim.fr`, puis cocher « Enforce HTTPS »
   quand la case devient disponible.
2. Dans OVHcloud : Web Cloud → Noms de domaine → filrouganim.fr → Zone DNS. Comme pour jeuphorie.fr :
   - supprimer les enregistrements A et AAAA existants sur `filrouganim.fr` ;
   - ajouter 4 enregistrements A vers 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 ;
   - ajouter un CNAME `www` vers `pufu2.github.io.`
   (adresses à recopier depuis la doc GitHub « Managing a custom domain for your GitHub Pages site »).
3. Attendre jusqu'à 24 h que tout se mette en place.

## 4. Google Search Console

1. https://search.google.com/search-console → Ajouter une propriété → Préfixe d'URL : `https://filrouganim.fr`.
2. Méthode « Balise HTML » : copier la valeur `content="…"` dans `google_site_verification` de `config.yml`.
3. Une fois le site republié, cliquer « Valider », puis envoyer le sitemap : `https://filrouganim.fr/sitemap.xml`.

## 5. Mesure d'audience (facultatif)

La Search Console suffit pour commencer. Pour compter les visites sans cookie : créer un compte
GoatCounter (gratuit) et mettre son code dans `goatcounter` de `config.yml`. La page Confidentialité
s'adapte toute seule.

## Règle d'arrêt

1 000 visites par mois au bout de 6 mois de mise en ligne (Search Console : clics + GoatCounter).
Sinon, on arrête d'entretenir le site.
