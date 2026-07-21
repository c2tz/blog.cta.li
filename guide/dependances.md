# Dépendances

Le nombre de paquets peut sembler élevé, mais ils ne jouent pas tous le même rôle. Certains créent
le site, certains ajoutent une fonctionnalité visible et d'autres ne servent qu'à vérifier le code.

## Trois idées importantes

1. `dependencies` et `devDependencies` sont des catégories d'installation, pas une liste exacte des
   fichiers téléchargés par chaque visiteur.
2. Le build Astro retire ou regroupe une grande partie du code. Le navigateur ne reçoit que les
   ressources nécessaires aux pages et interactions concernées.
3. Les outils comme ESLint, Prettier, Playwright, Lighthouse, Commitlint et Knip ne sont pas envoyés
   aux visiteurs. Ils s'exécutent sur la machine de développement ou dans GitHub Actions.

`pnpm-lock.yaml` enregistre l'arbre exact, y compris les dépendances indirectes utilisées par les
paquets directs. Il est donc beaucoup plus long que la liste de `package.json`.

## Dépendances principales

| Paquet                               | Rôle dans ce dépôt                                                          | Arrive dans le navigateur ?                                   |
| ------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `astro`                              | Génère les pages, routes, contenus et ressources statiques                  | Le runtime Astro serveur, non ; les ressources produites, oui |
| `@astrojs/markdown-remark`           | Fournit les outils de transformation Markdown utilisés par la configuration | Non comme outil autonome                                      |
| `@astrojs/mdx`                       | Permet les articles `.mdx`                                                  | Non comme outil autonome                                      |
| `@astrojs/rss`                       | Génère le flux `/rss.xml`                                                   | Non ; seul le XML généré est servi                            |
| `@material/web`                      | Fournit les composants Material 3 utilisés par l'interface                  | Oui, seulement les modules importés et découpés par le build  |
| `@material/material-color-utilities` | Calcule les palettes Material dynamiques et le thème généré                 | Partiellement, pour les couleurs dynamiques ; aussi au build  |
| `@floating-ui/dom`                   | Positionne menus et surfaces flottantes                                     | Oui, quand la fonctionnalité correspondante est chargée       |
| `@vercel/speed-insights`             | Mesure optionnelle des performances après consentement                      | Oui, seulement après l'accord fonctionnel                     |
| `rehype-slug`                        | Ajoute des identifiants aux titres Markdown                                 | Non ; seul le HTML résultant est servi                        |
| `rehype-autolink-headings`           | Rend les titres Markdown directement liés à leur ancre                      | Non ; seul le HTML résultant est servi                        |
| `satori` et `satori-html`            | Produisent le visuel Open Graph d'un article                                | Non ; seule l'image générée est servie                        |
| `sharp`                              | Convertit et optimise des images, notamment Open Graph et Konachan          | Non                                                           |
| `fonteditor-core`                    | Lit et transforme les polices pour les icônes et images Open Graph          | Non                                                           |

## Dépendances de développement et de contrôle

| Paquet                                                 | Rôle                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `@astrojs/check`                                       | Vérification Astro et TypeScript via `pnpm check`                      |
| `typescript` et `@types/node`                          | Types du code et des API Node.js                                       |
| `tsx`                                                  | Exécution des scripts TypeScript, notamment le générateur de thème     |
| `eslint`, `@eslint/js`, `typescript-eslint`            | Analyse statique du JavaScript et TypeScript                           |
| `eslint-plugin-astro`                                  | Règles ESLint spécifiques aux fichiers Astro                           |
| `eslint-plugin-jsx-a11y`                               | Règles d'accessibilité pour le balisage de type JSX/Astro              |
| `globals`                                              | Liste contrôlée des variables globales navigateur et Node pour ESLint  |
| `prettier` et `prettier-plugin-astro`                  | Mise en forme cohérente du code, Markdown et Astro                     |
| `@playwright/test`                                     | Tests E2E dans Chromium, WebKit et la matrice nocturne                 |
| `@lhci/cli`                                            | Mesures Lighthouse CI et application des seuils                        |
| `knip`                                                 | Détection du code et des dépendances probablement inutilisés           |
| `@commitlint/cli` et `@commitlint/config-conventional` | Validation des messages de commit et titres de pull request            |
| `husky`                                                | Installation de hooks Git locaux                                       |
| `lint-staged`                                          | Contrôles ciblés sur les fichiers ajoutés à un commit                  |
| `@shikijs/transformers`                                | Options avancées de coloration des blocs de code au build              |
| `html-minifier-terser`                                 | Minification du HTML produit                                           |
| `pagefind`                                             | Création de l'index de recherche statique                              |
| `parse5`                                               | Analyse structurée du HTML dans les contrôles de contenu et de preview |
| `sass`                                                 | Compilation des fichiers `.scss` en CSS                                |
| `material-symbols`                                     | Source de la police d'icônes locale réduite                            |
| `@openai/codex`                                        | Aide facultative pour générer ou normaliser les messages de commit     |

## Pourquoi Prettier et ESLint sont tous les deux présents

Ils n'ont pas le même travail :

- Prettier décide de la présentation du texte source : espaces, retours à la ligne et indentation ;
- ESLint cherche des constructions incorrectes ou contraires aux règles du projet.

Les deux sont utilisés localement et dans `verify:quality`, donc aussi par GitHub Actions. Prettier ne
remplace pas ESLint et ESLint ne remplace pas les tests.

## Pourquoi Gixy n'est pas présent

Gixy analyse des configurations Nginx. Ce dépôt ne contient pas de configuration Nginx et son
hébergement principal est défini par `vercel.json`. Ajouter Gixy ici n'apporterait donc aucun
contrôle utile. Si le dossier `dist` est un jour servi par Nginx sur un NAS, la configuration Nginx
appartiendra à l'infrastructure du NAS et pourra être vérifiée séparément à cet endroit.

## Pourquoi certaines versions sont strictement fixées

Une version comme `"2.5.0"` est exacte. Une version comme `"^7.1.0"` autorise des mises à jour
compatibles selon les règles sémantiques de npm. Dans les deux cas, `pnpm-lock.yaml` fixe la version
réellement installée par `pnpm install --frozen-lockfile`.

Les versions exactes sont utiles pour les outils dont les résultats doivent rester très
reproductibles, comme Playwright ou Lighthouse. Une plage compatible peut réduire le travail pour
des correctifs ordinaires, tout en laissant le lockfile protéger chaque build.

## Dependabot et maintenance

Dependabot vérifie chaque semaine les paquets npm et les actions GitHub, puis ouvre au maximum cinq
pull requests de chaque catégorie vers `develop`. Il n'applique pas silencieusement une mise à jour
au site.

Pour examiner une mise à jour :

1. lire le paquet et la version modifiés ;
2. lire les changements incompatibles annoncés par le projet source ;
3. laisser GitHub Actions exécuter les contrôles ;
4. vérifier visuellement si la dépendance influence l'interface ;
5. fusionner seulement si le changement est compris et les contrôles sont verts.

Des versions majeures de TypeScript, Node/ESLint et des outils Astro sont volontairement ignorées
par certaines règles Dependabot. Elles demandent une migration examinée séparément.

## Supprimer une dépendance

Ne supprimez pas un paquet uniquement parce que son nom n'apparaît pas dans une page Astro. Il peut
être utilisé par un script, un workflow ou un chargement dynamique.

La procédure sûre est :

1. rechercher ses imports et son nom dans tout le dépôt ;
2. consulter `package.json`, `astro.config.mjs`, `knip.json` et les scripts ;
3. retirer le paquet et le code devenu inutile dans une branche séparée ;
4. exécuter `pnpm install`, `pnpm check:knip` et `pnpm verify:quality` ;
5. vérifier le site produit et le diff de `pnpm-lock.yaml`.

## Mise à jour manuelle

Utilisez une branche séparée et mettez à jour un groupe cohérent de paquets. Après modification :

```sh
pnpm install
pnpm verify:quality
```

Pour une dépendance visible dans le navigateur ou un outil de build majeur, lancez également
`pnpm verify` et examinez le résultat visuel. Ne lancez pas `pnpm update --latest` sans plan : cela
mélange de nombreuses migrations et rend une régression difficile à attribuer.
