# Les chiffres publics (accueil et /chiffres/)

Le bloc « Tous les chiffres du site sont publics » montre la visibilité du site, pour donner envie de
s'inscrire : visiteurs, apparitions et clics dans Google, comptes créés. Les chiffres sont relevés chaque
nuit par `outils/audience.py` (étape « Chiffres de visibilité » de `.github/workflows/relever.yml`) et
écrits dans `donnees/audience.yml`.

Tant qu'il y a moins de deux chiffres disponibles, le bloc n'apparaît pas sur l'accueil, et la page
/chiffres/ annonce que les premiers chiffres arrivent (elle n'est pas proposée à Google).

## 1. Les comptes créés (déjà prêt)

Le secret `SUPABASE_SECRET_KEY` (celui des alertes du lundi) suffit. On publie : le nombre d'animateurs,
de structures, d'offres en ligne et de candidatures, et pour les cinq dernières inscriptions seulement
le profil (animateur ou structure), le département et le mois.

## 2. Les visiteurs (GoatCounter, sans cookie)

1. Créer un compte gratuit sur https://www.goatcounter.com/ avec le code `filrouganim`
   (l'adresse du compteur sera https://filrouganim.goatcounter.com).
2. Mettre ce code dans `config.yml` : `goatcounter: "filrouganim"`. Le compteur s'ajoute alors à toutes
   les pages (il est déjà prévu dans `gabarits/base.html`).
3. Dans GoatCounter : Settings > API > New token, cocher « Read statistics ». Copier le jeton.
4. GitHub, dépôt filrouganim : Settings > Secrets and variables > Actions > New repository secret,
   nom `GOATCOUNTER_TOKEN`, valeur : le jeton.

## 3. Les apparitions et les clics dans Google (Search Console)

1. https://console.cloud.google.com/ : créer un projet « filrouganim », puis APIs & Services > Library,
   activer « Google Search Console API ».
2. IAM & Admin > Service accounts > Create service account (nom : `chiffres`). Dans le compte créé :
   Keys > Add key > Create new key > JSON. Le fichier se télécharge.
3. Search Console, propriété `filrouganim.fr` : Paramètres > Utilisateurs et autorisations > Ajouter un
   utilisateur, avec l'adresse du compte de service (`chiffres@….iam.gserviceaccount.com`),
   autorisation « Restreinte » (lecture seule).
4. GitHub : nouveau secret `GSC_SERVICE_ACCOUNT`, valeur : tout le contenu du fichier JSON.

## Vérifier

GitHub > Actions > « Relever les sessions » > Run workflow. Dans le journal de l'étape « Chiffres de
visibilité », chaque source écrit ce qu'elle a trouvé (ou pourquoi elle a été sautée). Le site se
republie ensuite tout seul avec les chiffres.
