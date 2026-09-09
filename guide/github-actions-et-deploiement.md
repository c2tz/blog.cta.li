# GitHub Actions et déploiement

GitHub Actions est le service qui exécute les fichiers `.github/workflows/*.yml`. Il installe le
projet sur une machine temporaire, lance des commandes et affiche un résultat vert ou rouge dans la
pull request.

GitHub Actions ne remplace pas l'hébergeur : un contrôle vert signifie que le code testé respecte
les règles prévues. Il ne prouve pas à lui seul que Vercel, le DNS ou un NAS sert correctement la
dernière version.

## Ce qui se passe sur une pull request

Les workflows importants sont :

| Workflow                                | Déclenchement                                 | Rôle                                                               |
| --------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `Verify Astro and Material Web project` | Pull requests et pushes vers `develop`/`main` | Validation légère, éditoriale ou complète selon les changements    |
| `Validate security header hashes`       | Pull requests et pushes vers `develop`/`main` | Recalcule la CSP pour les lanes qui construisent le site           |
| `Commit message standards`              | Pull requests et pushes protégés              | Valide le titre de PR ou tous les messages introduits par le push  |
| `CodeQL`                                | Pull requests, pushes et planning             | Analyse JavaScript/TypeScript pour la lane complète et le planning |
| `Smoke Vercel preview deployment`       | Déploiement Vercel ou lancement manuel        | Vérifie le site réellement déployé et ses en-têtes                 |

Le workflow principal publie deux verdicts requis. Le premier agrège des jobs internes de qualité et
de navigation ; le second exécute Lighthouse.

### Check Astro, Material Web, and security headers

Dans la lane complète, un job exécute les contrôles statiques et le build pendant que huit runners
Playwright indépendants construisent le même commit et se partagent la collection avec
`--shard=1/8` à `--shard=8/8`. Chaque runner conserve un seul worker afin d'éviter la contention entre
navigateurs sur une même machine. `fullyParallel: true` permet à Playwright de répartir les tests
individuels sans retirer de projet Chromium ou WebKit.

Les builds destinés aux navigateurs activent `SITE_TEST_FIXTURES=1` pour inclure les archives de
test. Cette option est aussi active dans la matrice nocturne ; les builds de déploiement et
Lighthouse conservent les seules routes du site.

`fail-fast: false` laisse les huit shards terminer même si l'un échoue. Chaque shard publie un
rapport blob au nom unique ; les traces et captures d'un shard rouge sont conservées pendant 14 jours.
Un job séparé exige exactement huit blobs, les fusionne et publie le rapport HTML.

Le job portant le nom requis `Check Astro, Material Web, and security headers` ne duplique aucun test :
il utilise `needs` avec `always()` et vérifie le résultat exact attendu pour la lane. Une
classification absente, un contrôle statique rouge, un shard échoué ou annulé, un rapport manquant et
toute combinaison inattendue font échouer ce verdict unique. Les rulesets restent donc attachés au
même nom sans considérer un shard isolé comme une validation complète.

### Lighthouse 95+ performance (mobile and desktop, no SEO)

Dans la lane complète, il construit le site, lance trois mesures mobiles et trois mesures bureau,
puis impose au moins 95 en performance et 100 en accessibilité et bonnes pratiques. Pour une lane
légère, le job reste présent et explique pourquoi la mesure ne s'applique pas. Les rapports produits
sont conservés comme artefacts même si le job échoue.

Les noms exacts des jobs peuvent être référencés par les rulesets de branches. Ne les renommez pas
sans modifier les rulesets correspondants dans `.github/rulesets`.

### Validation adaptée aux fichiers modifiés

Chaque pull request est classée dans une lane `docs`, `content` ou `full`. Un push de merge peut
utiliser `post-merge` uniquement si Git et l’API GitHub prouvent la PR et ses cinq checks verts. Les
cinq jobs requis restent toujours présents : leurs étapes internes ou les dépendances acceptées par
leur verdict changent selon la lane.

- `docs` vérifie les documents modifiés sans build, navigateur, Lighthouse ni analyse CodeQL réelle ;
- `content` vérifie le formatage et les tests unitaires, construit le site et Pagefind, valide le
  contenu et la CSP, puis exécute un smoke Chromium ciblé ;
- `post-merge` republie rapidement les cinq statuts sans répéter les contrôles déjà réussis ;
- `full` conserve tous les contrôles, navigateurs, Lighthouse et CodeQL.

Tout chemin inconnu, SHA incomplet ou historique indisponible utilise `full`. Les pushes directs,
forcés, multiples ou non prouvables restent également complets, même si le message du commit
ressemble à un merge. La taxonomie, les priorités et la preuve API sont détaillées dans
[Validation CI adaptée aux changements](ci-path-aware.md).

Dans la lane `content`, le job de qualité n'installe que Chromium et exécute le sous-ensemble
éditorial après le build. Dans la lane `docs`, il limite le contrôle au diff et au formatage des
documents modifiés. Les huit shards et leur fusion sont alors explicitement `skipped`, ce que le
verdict final exige au lieu de les traiter comme des résultats manquants.

## Workflows planifiés ou manuels

### Nightly cross-browser QA

Chaque nuit, une matrice supplémentaire teste Firefox et WebKit, puis répète les parcours WebKit
fragiles. Ce workflow cherche des problèmes qui peuvent ne pas apparaître dans la validation rapide
d'une pull request.

La lane `full` d'une pull request inclut aussi les parcours WebKit ciblés en thèmes clair et sombre,
sur bureau et mobile. La matrice nocturne reste plus large et répète les parcours fragiles.

### QA sur appareil physique

Avant de demander la fusion d'une modification visuelle, renseignez la section dédiée du modèle de
pull request. Elle demande le résultat de la passe sur appareil réel, ou une justification explicite
si elle ne s'applique pas ou ne peut pas être effectuée. Suivez la liste de
[vérification sur appareils physiques](physical-device-qa.md) ; les tests WebKit automatisés la
complètent mais ne remplacent pas Safari sur un vrai appareil.

### Mises à jour Dependabot

Dependabot ouvre automatiquement ses propositions vers `develop`, mais elles restent toujours à
décider par `c2tz` : elles lui sont assignées, demandent sa revue de propriétaire du code et ne
sont jamais fusionnées automatiquement.

### Refresh Konachan backgrounds

Le dépôt privé `c2tz/ct-blog-landing-img` renouvelle automatiquement les fonds le premier jour du
mois à 20:17 UTC. Il récupère une sélection, construit les variantes, puis exécute les vérifications
des images, manifestes et tailles.

Si et seulement si ces vérifications réussissent, le workflow crée ou met à jour une proposition
technique dédiée. Il vérifie que son diff ne contient que les manifestes et images Konachan attendus,
la fusionne automatiquement, puis appelle le workflow réutilisable qui déclenche le hook de
déploiement Vercel. Aucun secret `BOT_TOKEN` permanent n’est nécessaire : le workflow utilise son
jeton GitHub éphémère.

Un lancement manuel en mode _dry run_ valide la chaîne sans créer de proposition, fusionner de
changement ni déclencher Vercel.

## Lire un échec GitHub Actions

1. Ouvrez l'onglet **Checks** de la pull request.
2. Ouvrez le job rouge, puis l'étape rouge.
3. Remontez jusqu'à la première vraie erreur. Les lignes suivantes sont souvent des conséquences.
4. Reproduisez la commande indiquée localement si possible.
5. Corrigez la cause, commitez et poussez. GitHub relancera les contrôles.

Exemples :

- `Run pnpm lint` échoue : ouvrez la première erreur ESLint avec son fichier et sa ligne ;
- `Build static output` échoue : lancez `pnpm build` localement ;
- hachages CSP obsolètes : lancez `pnpm build && pnpm sync:headers && pnpm check:headers`, puis
  commitez `vercel.json` ;
- Playwright échoue : ouvrez le shard rouge, puis téléchargez son artefact de traces ou le rapport
  HTML fusionné ;
- Lighthouse échoue : consultez le rapport de la catégorie et vérifiez si la baisse se reproduit.

Un job `Cancelled` n'est pas un succès. La règle `cancel-in-progress: true` annule normalement une
ancienne exécution lorsqu'un nouveau commit arrive sur la même branche ; attendez le résultat du
dernier commit.

## Déploiement Vercel

`vercel.json` demande à Vercel d'exécuter :

```sh
pnpm build:vercel
```

Cette commande :

1. vérifie que l'historique Git est suffisant pour calculer les dates ;
2. génère le site statique dans `dist` ;
3. vérifie les en-têtes de sécurité.

`vercel.json` définit aussi la CSP, HSTS, les politiques du navigateur et les règles de cache. Les
ressources versionnées comme `/_astro/*` peuvent être conservées longtemps, alors que les documents
HTML restent actualisables.

Le workflow de smoke test Vercel vérifie une URL publique. Son exécution automatique n'est active que
si la variable de dépôt `VERCEL_PREVIEW_SMOKE_ENABLED` vaut exactement `true`. Si Vercel Deployment
Protection redirige les visiteurs anonymes vers une connexion, laissez cette variable désactivée ou
lancez un contrôle adapté avec une URL réellement accessible.

## Déploiement sur un NAS Synology

Le site est statique, donc il peut être copié sur un NAS sans exécuter Astro ou Node.js en continu.

Sur la machine de build :

```sh
pnpm install --frozen-lockfile
pnpm build
```

Copiez ensuite **le contenu** de `dist` dans la racine web configurée sur le NAS. Le serveur doit :

- servir `index.html` pour les routes générées ;
- conserver les bons types MIME pour CSS, JavaScript, JSON, XML, WebP et WOFF2 ;
- utiliser HTTPS ;
- servir la vraie page `404.html` avec un statut HTTP 404 ;
- reproduire les en-têtes de sécurité et de cache utiles de `vercel.json` dans sa propre
  configuration.

La dernière condition est importante : copier `dist` ne copie pas automatiquement les en-têtes
Vercel. Si Synology utilise Nginx en interne, sa configuration se maintient sur le NAS et non dans ce
dépôt. C'est à cet endroit qu'un analyseur Nginx comme Gixy pourrait éventuellement avoir du sens.

Pour automatiser le couplage avec GitHub, utilisez de préférence un déploiement à sens unique :

1. GitHub reste la source de vérité ;
2. un workflow ou un service du NAS récupère un commit validé ;
3. il construit le site dans un espace temporaire ;
4. il remplace la version servie seulement si le build réussit.

Évitez de modifier directement les fichiers servis sur le NAS : ces changements disparaîtraient au
prochain déploiement et ne seraient pas enregistrés par Git.

## GitHub Pages

Le dossier `dist` est compatible avec un hébergement statique, mais ce dépôt n'inclut pas actuellement
de workflow de déploiement GitHub Pages. Il faudrait en ajouter un qui construit le site et publie
`dist`.

GitHub Pages ne lit pas `vercel.json`. Les en-têtes CSP, HSTS et cache définis pour Vercel n'y seront
donc pas reproduits de la même manière. Une URL sous un sous-chemin, par exemple
`utilisateur.github.io/depot/`, demanderait aussi de vérifier la base Astro et tous les chemins
commençant par `/`. Un domaine personnalisé servi à la racine évite une partie de ce problème.

Les possibilités de Pages pour un dépôt privé dépendent du plan GitHub et des règles du compte ;
elles doivent être confirmées dans les paramètres GitHub actuels avant de choisir cet hébergement.

## Séparer contrôle et déploiement

Un parcours fiable ressemble à ceci :

```text
modification -> pull request -> contrôles GitHub verts -> fusion -> build hébergeur -> smoke distant
```

Chaque étape répond à une question différente :

- les fichiers sont-ils cohérents ?
- le site se construit-il ?
- les interactions automatisées fonctionnent-elles ?
- l'hébergeur a-t-il déployé le bon commit ?
- l'URL publique sert-elle les bons fichiers et en-têtes ?

Ne concluez pas qu'une production est à jour uniquement à partir d'un contrôle GitHub vert.
