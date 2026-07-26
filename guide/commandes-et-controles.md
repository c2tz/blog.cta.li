# Commandes et contrôles

Toutes les commandes documentées ici se lancent depuis la racine du dépôt. Elles sont définies dans
la section `scripts` de `package.json` et s'exécutent avec pnpm :

```sh
pnpm <nom-de-la-commande>
```

Une commande qui se termine avec le code `0` a réussi. Un autre code signifie qu'elle a détecté une
erreur ou n'a pas pu s'exécuter.

## Le choix simple

Si vous débutez, retenez d'abord ces commandes :

| Commande                | Quand l'utiliser                                              |
| ----------------------- | ------------------------------------------------------------- |
| `pnpm dev`              | Pendant l'écriture ou une modification visuelle               |
| `pnpm new:post "Titre"` | Pour créer un brouillon sans risque d'écraser un article      |
| `pnpm build`            | Avant de proposer une modification de contenu                 |
| `pnpm preview`          | Pour voir le résultat exact du dernier build                  |
| `pnpm verify`           | Avant une livraison importante ou pour reproduire toute la CI |

Les autres commandes sont des briques spécialisées. Il n'est pas nécessaire de toutes les lancer à
la main à chaque article.

## Développement et prévisualisation

### `pnpm dev`

Synchronise d'abord les types de contenu Astro, puis démarre le serveur de développement. Le site
est normalement disponible sur <http://localhost:4321/> et se recharge après une modification.

### `pnpm dev:local`

Variante explicite qui écoute sur le réseau local et impose le port 4321. Elle peut rendre le site
accessible depuis un autre appareil du même réseau si le pare-feu l'autorise. N'exposez pas ce
serveur directement sur Internet.

### `pnpm preview`

Sert le dossier `dist` produit par le dernier build. Contrairement à `dev`, cette commande ne
reconstruit pas le site automatiquement.

### `pnpm preview:local`

Variante utilisée par les tests, sur `127.0.0.1:4322`. Le port distinct évite une collision avec le
serveur de développement.

## Construction du site

### `pnpm build`

Effectue, dans cet ordre :

1. vérification de la cohérence des manifestes Konachan ;
2. build statique Astro ;
3. génération de l'index de recherche Pagefind pour les articles listés ;
4. contrôle du HTML, des routes, ancres, ressources et surfaces de découverte ;
5. minification des fichiers HTML.
6. contrôle des budgets JavaScript/CSS et de la charge initiale de l'accueil.

Le résultat final est écrit dans `dist`. Si cette commande réussit, le contenu peut être servi par
un hébergeur statique, sous réserve de sa configuration d'en-têtes et de domaine.

### `pnpm build:debug`

Construit et contrôle le site sans minifier le HTML. Le résultat est plus facile à lire pour
diagnostiquer une erreur, mais ce n'est pas la commande de production normale.

### `pnpm build:vercel`

Commande demandée par `vercel.json`. Elle vérifie d'abord la présence de l'historique Git, lance
`pnpm build`, puis vérifie les en-têtes de sécurité Vercel. Elle est spécifique au déploiement de ce
dépôt sur Vercel.

## Contrôles du code

### `pnpm check`

Lance `astro check`. Il vérifie notamment les fichiers Astro, TypeScript, les imports et les types.
Il peut détecter un code incohérent même si la page semble fonctionner dans un navigateur.

### `pnpm lint`

Lance ESLint sur le dépôt avec zéro avertissement autorisé. ESLint contrôle des règles de code, des
erreurs JavaScript/TypeScript probables et certaines règles d'accessibilité JSX/Astro.

### `pnpm lint:fix`

Demande à ESLint de corriger automatiquement ce qu'il sait corriger. Relisez toujours le diff après
cette commande : les problèmes nécessitant une décision humaine restent signalés.

### `pnpm format:check`

Vérifie avec Prettier uniquement les fichiers modifiés par rapport à la base Git calculée par le
script du projet. En local, cette base est `origin/develop` (ou `FORMAT_BASE` si vous le définissez) ;
dans GitHub Actions, elle est le commit de base de la pull request ou le commit précédent du push.
Cette commande ne modifie aucun fichier.

### `pnpm format`

Formate avec Prettier les fichiers modifiés sélectionnés par le même script. Relisez ensuite le diff.

### `pnpm format:all:check` et `pnpm format:all`

Contrôlent ou réécrivent tout le dépôt. Ils sont utiles pour une opération globale de maintenance,
mais excessifs pour la rédaction normale d'un article.

### `pnpm check:knip`

Knip recherche les fichiers, exports et dépendances qui semblent inutilisés. Un résultat Knip doit
être interprété : un usage dynamique ou connu uniquement d'un hébergeur peut nécessiter une entrée
explicite dans `knip.json` plutôt qu'une suppression immédiate.

### `pnpm check:bundles`

Mesure en brut, gzip et Brotli le HTML et les ressources initiales de l'accueil, d'un article, de la
page cookies et de la 404. Il borne aussi chaque fichier JavaScript et image AVIF 404, les totaux
JavaScript/CSS, Pagefind et les graphes différés de recherche, d'aperçu d'image et de Konachan. Les
entrées générées sont retrouvées par leur nom stable plutôt que par leur hash, afin qu'un nouveau
build ne fausse pas le contrôle. Les graphes différés constituent une garde de poids déterministe :
ils peuvent partager des chunks et ne représentent pas une trace réseau incrémentale. Cette
vérification s'exécute à la fin de `pnpm build`.

## Tests

### `pnpm test` et `pnpm test:unit`

`test` est actuellement un alias de `test:unit`. Les tests unitaires utilisent le test runner natif
de Node.js pour vérifier de petites fonctions et les scripts du dépôt. Ils sont rapides et ne
lancent pas de navigateur.

### `pnpm test:e2e`

Playwright construit le site, le sert sur le port 4322 et pilote de vrais moteurs de navigateur. La
configuration normale couvre plusieurs tailles d'écran, les thèmes clair/sombre, Chromium et des
parcours ciblés WebKit. Les captures et traces sont conservées lors d'un échec.

La matrice Chromium évite le produit cartésien complet : le profil bureau clair exécute toutes les
specs non nocturnes, le bureau sombre conserve les specs qui vérifient explicitement les thèmes, le
mobile clair conserve les parcours responsive, tactiles ou critiques sur téléphone, et le mobile
sombre couvre l'accueil thématique et le rendu. Les neuf specs WebKit ciblées restent exécutées dans
les quatre combinaisons bureau/mobile et clair/sombre. `site-resilience.spec.ts` appartient
exclusivement à la matrice nocturne Firefox/WebKit.

Ces tests vérifient des interactions : recherche, consentement, commentaires, aperçu d'image,
navigation, contenu et résilience. Ils sont plus lents que les tests unitaires.

### `pnpm test:lighthouse`

Nettoie les anciens rapports, puis exécute Lighthouse en mobile et en bureau. Chaque profil est
mesuré trois fois. Les seuils actuels sont :

- performance : au moins 95 ;
- accessibilité : 100 ;
- bonnes pratiques : 100.

La catégorie SEO n'est pas évaluée par cette configuration. Un score Lighthouse varie avec la
machine et ne prouve pas l'absence de bug fonctionnel.

### `pnpm test:lighthouse:mobile` et `pnpm test:lighthouse:desktop`

Permettent d'exécuter un seul des deux profils. Les rapports sont écrits dans
`lighthouse-reports/mobile` ou `lighthouse-reports/desktop`.

## Sécurité et contenu produit

### `pnpm audit:dependencies`

Interroge l'audit pnpm et échoue à partir d'une vulnérabilité de niveau faible. Une alerte doit être
analysée selon la version, le chemin de dépendance et l'exposition réelle ; ne supprimez pas une
bibliothèque au hasard pour faire disparaître le message.

### `pnpm check:content`

Analyse le site déjà construit. Il contrôle notamment :

- les routes, ancres et ressources internes ;
- les URL JavaScript dangereuses ;
- le H1 et l'URL canonique de chaque page ;
- la cohérence des articles listés avec RSS, sitemap et Pagefind ;
- l'absence de styles inline inattendus ;
- la présence de feuilles CSS Astro versionnées.

`pnpm build` l'exécute déjà. On ne le lance seul que pour diagnostiquer un dossier `dist` existant.

### `pnpm sync:headers`

Lit le HTML construit, calcule les hachages des scripts inline autorisés par la CSP et met à jour
`vercel.json`. Cette commande modifie un fichier suivi par Git. Utilisez-la après `pnpm build` quand
un changement de HTML inline rend les hachages obsolètes.

### `pnpm check:headers`

Vérifie que les en-têtes et hachages de `vercel.json` correspondent au résultat de production. Il ne
contacte pas Vercel et ne prouve donc pas à lui seul que le déploiement distant utilise ces en-têtes.

## Thème, icônes, arrière-plans et recherche

### `pnpm theme:check`

Recalcule en mémoire les couleurs Material 3 et vérifie que le fichier généré commité est à jour.

### `pnpm theme:generate`

Régénère `src/assets/css/base/material-theme.generated.scss`. Cette commande est nécessaire après
une modification volontaire de la couleur source ou du générateur de thème.

### `pnpm check:material-symbols`

Vérifie que la police locale réduite contient tous les Material Symbols utilisés par le site.

### `pnpm update:material-symbol-map`

Reconstruit la table des points de code depuis le paquet source Material Symbols.

### `pnpm update:material-symbols`

Met à jour la police locale réduite et ses fichiers générés. Committez ensemble les fichiers
modifiés après vérification visuelle.

### `pnpm check:konachan-runtime`

Vérifie le manifeste compact injecté pour le navigateur ainsi que chaque WebP déclaré. `pnpm
build` prépare d'abord les assets puis exécute déjà ce contrôle.

### `pnpm prepare:landing-assets`

Prépare transactionnellement les arrière-plans. Les builds Vercel fiables de `main` et `develop`
lisent le dépôt privé avec une clé de déploiement en lecture seule. En local, le script utilise
automatiquement le dossier `public/` d'un checkout voisin nommé `ct-blog-landing-img`. Il conserve
les fixtures abstraites sans contenu sensible si ce checkout est absent. Pour utiliser un autre
emplacement local, définissez `LANDING_ASSETS_SOURCE_DIR` vers son dossier `public/`.

Les validations automatisées appellent `pnpm build:test`, qui force les trois fixtures abstraites
pour rester déterministe même si le checkout privé voisin est présent. `pnpm dev` et `pnpm build`
gardent les images privées locales, tandis que `pnpm build:vercel` laisse `main` et `develop`
récupérer le dépôt privé avec leur clé de déploiement autorisée.

### `pnpm index:search`

Nettoie l'ancien index Pagefind, indexe uniquement `dist/posts/**/index.html`, puis prépare le
chargeur utilisé en développement. `pnpm build` l'exécute déjà.

### `pnpm minify:html`

Réduit la taille des fichiers HTML dans `dist`. Cette opération ne modifie pas les sources.

## Articles

### `pnpm new:post "Titre"`

Crée un fichier Markdown non listé. Les options sont :

```sh
pnpm new:post "Titre" --description "Résumé" --publish
pnpm new:post --help
```

Consultez [Publier un article](publier-un-article.md) pour les règles du frontmatter.

## Git et messages de commit

### `pnpm lint:commit`

Valide un message reçu sur l'entrée standard avec Commitlint.

### `pnpm check:commits`

Valide les commits situés entre `origin/develop` et la branche actuelle. Exécutez d'abord un
`git fetch` si votre référence distante est ancienne.

### `pnpm prepare`

Installe les hooks Husky après l'installation des dépendances. Ce script est normalement lancé
automatiquement par pnpm ; il n'est pas une vérification quotidienne.

### `pnpm astro`

Expose directement la ligne de commande Astro. Utilisez les scripts documentés du projet quand ils
existent, car ils ajoutent les contrôles nécessaires autour d'Astro.

## Commandes agrégées

### `pnpm verify:quality`

Exécute en série : tests unitaires, thème, Astro/TypeScript, ESLint, audit de dépendances, police
d'icônes, Knip, Prettier, build, en-têtes de sécurité et tests Playwright. GitHub Actions utilise
cette commande dans son job principal.

### `pnpm verify:project`

Exécute `verify:quality`, puis Lighthouse mobile et bureau.

### `pnpm verify`

Alias exact de `verify:project`. C'est le contrôle local le plus complet et donc le plus lent.

## Quel contrôle selon le changement ?

| Changement               | Minimum local raisonnable                               | Contrôle complet conseillé                   |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------- |
| Texte d'un article       | `pnpm build`                                            | GitHub Actions                               |
| Nouvelle image d'article | `pnpm build` et vérification visuelle                   | GitHub Actions                               |
| CSS ou mise en page      | `pnpm check`, `pnpm lint`, `pnpm build`                 | `pnpm verify:quality` et appareil réel       |
| Interaction JavaScript   | tests unitaires ciblés, `pnpm check`, `pnpm lint`       | `pnpm verify:quality`                        |
| Dépendance               | `pnpm verify:quality`                                   | `pnpm verify` et examen des notes de version |
| Script inline ou CSP     | `pnpm build && pnpm sync:headers && pnpm check:headers` | GitHub Actions                               |
| Workflow GitHub          | validation YAML et relecture                            | exécution réelle du workflow                 |

Cette table est un minimum proportionné, pas une interdiction de lancer davantage de contrôles.
