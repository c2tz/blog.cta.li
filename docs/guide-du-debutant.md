# Guide du débutant

Ce document explique le projet sans supposer de connaissances préalables en développement web.

## Le site en termes simples

Le dépôt contient deux choses :

1. le contenu éditorial, principalement les articles Markdown ;
2. le programme qui transforme ce contenu en site web.

Cette transformation s'appelle le **build**. Astro lit les fichiers du dépôt et produit un dossier
`dist` contenant du HTML, du CSS, du JavaScript, des polices et des images. Ce dossier peut être
servi par Vercel, un NAS Synology ou un autre hébergeur statique.

Le site n'a pas de serveur applicatif ou de base de données pour les articles. Cela signifie qu'il
n'y a pas de tableau de bord de rédaction ni de mot de passe d'administration. Git est l'historique
du contenu et GitHub est l'espace de collaboration et d'automatisation.

## Petit glossaire

| Terme         | Signification dans ce projet                                                        |
| ------------- | ----------------------------------------------------------------------------------- |
| Astro         | Outil principal qui génère le site statique                                         |
| Markdown      | Texte avec une syntaxe simple pour les titres, liens, listes et images              |
| MDX           | Markdown pouvant aussi contenir des expressions ou composants avancés               |
| Frontmatter   | Bloc entre `---` au début d'un article, contenant son titre et ses options          |
| Git           | Historique local des modifications et source des dates des articles                 |
| GitHub        | Hébergement du dépôt, des pull requests et de GitHub Actions                        |
| Branche       | Ligne de travail Git ; ici `develop` pour le développement et `main` pour le stable |
| Commit        | Enregistrement nommé d'un ensemble de changements                                   |
| Pull request  | Proposition de fusion d'une branche vers une autre                                  |
| Dépendance    | Bibliothèque ou outil réutilisé par le projet                                       |
| Build         | Transformation des sources en site statique dans `dist`                             |
| CI            | Contrôles exécutés automatiquement par GitHub Actions                               |
| Lint          | Analyse de règles de code sans exécuter le site                                     |
| Test unitaire | Test rapide d'une petite fonction isolée                                            |
| Test E2E      | Test du site dans un vrai moteur de navigateur                                      |
| CSP           | Politique qui limite les scripts, images et connexions autorisés par le navigateur  |

## Prérequis

Installez :

- Git ;
- Node.js dans une version acceptée par `package.json` ;
- pnpm `11.1.3`.

La version de référence de Node.js est `22.22.3`. Les versions `24.11.1` ou toute version stable à
partir de `26.0.0` sont également acceptées par le projet. Pour obtenir un environnement identique à
la CI, utilisez de préférence Node.js `22.22.3`.

Volta est facultatif. S'il est installé, il lit automatiquement les versions indiquées dans
`package.json`.

## Première installation

```sh
git clone https://github.com/c2tz/ct-blog.cta.li.git
cd ct-blog.cta.li
pnpm install --frozen-lockfile
```

`pnpm install` télécharge les dépendances dans `node_modules`. L'option `--frozen-lockfile` impose les
versions enregistrées dans `pnpm-lock.yaml`, ce qui évite qu'une installation change le projet sans
le signaler.

`node_modules` peut être volumineux. Ce dossier n'est ni commité dans Git, ni envoyé tel quel aux
visiteurs du site.

## Voir le site localement

```sh
pnpm dev
```

Ouvrez <http://localhost:4321/>. Le serveur observe les fichiers et recharge le site après la plupart
des modifications. Pour l'arrêter, revenez dans le terminal et pressez `Ctrl+C`.

Si le port 4321 est déjà occupé, consultez [Dépannage](depannage.md#le-port-4321-est-deja-utilise).

## Les dossiers importants

| Chemin                    | Utilité                                       | Modification habituelle par un débutant |
| ------------------------- | --------------------------------------------- | --------------------------------------- |
| `src/content/blog`        | Articles Markdown et MDX                      | Oui                                     |
| `src/content/blog/images` | Images locales utilisées par les articles     | Oui                                     |
| `src/content/info`        | Pages d'information                           | Occasionnellement                       |
| `src/pages`               | Routes et pages générées par Astro            | Non, sauf développement                 |
| `src/components`          | Éléments réutilisables de l'interface         | Non, sauf développement                 |
| `src/assets/css`          | Styles du site                                | Non, sauf modification visuelle         |
| `src/assets/js`           | Comportements exécutés dans le navigateur     | Non, sauf fonctionnalité                |
| `public`                  | Fichiers copiés tels quels dans le site final | Occasionnellement                       |
| `scripts`                 | Contrôles et tâches de maintenance            | Rarement                                |
| `tests`                   | Tests unitaires et tests de navigateur        | Lors d'une fonctionnalité               |
| `.github/workflows`       | Automatisations GitHub Actions                | Rarement et avec prudence               |
| `docs`                    | Documentation humaine                         | Oui                                     |
| `dist`                    | Résultat temporaire de `pnpm build`           | Jamais à la main                        |
| `node_modules`            | Dépendances installées localement             | Jamais à la main                        |

## Trois parcours différents

### Écrire un article

Vous modifiez surtout `src/content/blog`, puis vous vérifiez avec `pnpm build`. Suivez
[Publier un article](publier-un-article.md).

### Modifier l'apparence ou une fonctionnalité

Vous modifiez le code dans `src`, vous lancez `pnpm dev`, puis des tests proportionnés au changement.
Une modification des interactions doit normalement être couverte par Playwright.

### Maintenir les outils et dépendances

Vous examinez les pull requests Dependabot, le résultat des workflows et les notes de version. Une
mise à jour ne doit pas être fusionnée uniquement parce qu'elle est récente : les contrôles doivent
passer et le résultat visible doit rester correct.

## Routine Git simple

Avant de commencer :

```sh
git switch develop
git pull --ff-only
git switch -c docs/mon-changement
```

Après vos modifications :

```sh
git status
git diff
pnpm build
git add <fichiers>
git commit -m "docs: explain article publishing"
git push -u origin docs/mon-changement
```

Sur GitHub, ouvrez ensuite une pull request vers `develop`. GitHub Actions vérifie la proposition.
Une croix rouge signifie qu'un contrôle a échoué ; elle ne signifie pas automatiquement que tout le
site est inutilisable. Ouvrez le contrôle pour lire la première erreur utile.

## Jusqu'où faut-il comprendre le code ?

Pour publier un article, il suffit de comprendre le Markdown, le frontmatter, Git et le résultat de
`pnpm build`. Vous n'avez pas besoin de maîtriser Astro, TypeScript, Material Web, Shiki, Playwright
ou la CSP.

Pour modifier le comportement du site, il faut en revanche comprendre la partie touchée et choisir
les tests adaptés. Les documents techniques servent de référence à ce niveau.
