# Publier un article

Ce guide couvre le cycle complet : créer un brouillon, l'écrire, le prévisualiser, le publier et
comprendre ses dates.

## 1. Créer un brouillon

Depuis la racine du dépôt :

```sh
pnpm new:post "Mon premier article"
```

Pour remplir directement ses tags, répétez l'option `--tag` :

```sh
pnpm new:post "Mon premier article" --tag astro --tag debutant
```

La commande crée `src/content/blog/mon-premier-article.md`. Elle refuse d'écraser un fichier déjà
présent. Un brouillon ressemble à ceci :

```md
---
title: "Mon premier article"
tags: []
listed: false
---

Écrivez votre article ici.
```

`listed: false` signifie que la page reste accessible par son URL directe, mais qu'elle n'apparaît
pas sur la page d'accueil, les pages de tags, le RSS, le sitemap et l'index de recherche Pagefind.
Ce mécanisme n'est pas une protection par mot de passe : toute personne connaissant l'URL peut lire
le brouillon déployé.

## 2. Remplir le frontmatter

Le frontmatter est le bloc situé entre les deux lignes `---`.

| Champ         | Obligatoire            | Rôle                                                                |
| ------------- | ---------------------- | ------------------------------------------------------------------- |
| `title`       | Oui                    | Titre de 1 à 160 caractères, affiché comme H1 par la page           |
| `description` | Pour un article listé  | Résumé de 1 à 320 caractères utilisé dans les listes et métadonnées |
| `listed`      | À écrire explicitement | `false` pour un brouillon, `true` pour publier                      |
| `tags`        | Non                    | Jusqu'à 12 tags uniques et sans espace                              |
| `priority`    | Non                    | Entier de 0 à 100 utilisé comme métadonnée de recherche             |

Exemple prêt à publier :

```md
---
title: "Comprendre un site statique"
description: "Une explication simple du build Astro et de la publication avec Git."
listed: true
tags:
  - astro
  - debutant
priority: 10
---

## Pourquoi utiliser un site statique ?

Le contenu de l'article commence ici.
```

N'ajoutez pas un titre Markdown `#` identique au titre. Astro produit déjà le H1 à partir de
`title`. Le corps de l'article commence normalement avec un titre de niveau 2, écrit `##`.

Un tag :

- contient de 1 à 48 caractères ;
- commence par une lettre ou un chiffre ;
- ne contient pas d'espace ;
- peut contenir lettres, chiffres, points, tirets, `_` et `+` ;
- ne doit pas être `all`, car le site ajoute ce tag automatiquement.

## 3. Écrire en Markdown

```md
## Un sous-titre

Un paragraphe avec du **gras**, de l'_italique_ et un [lien](https://example.com/).

- premier élément ;
- deuxième élément.

> Une citation.
```

Pour un bloc de code, indiquez le langage après les trois accents graves. Shiki applique alors la
coloration syntaxique pendant le build :

````md
```js
const message = "Bonjour";
console.log(message);
```
````

Si le langage n'est pas reconnu ou n'est pas indiqué, le contenu reste un bloc `pre > code` lisible
sans coloration spécifique. Le bouton de copie et le style du site sont ajoutés séparément dans le
navigateur.

Les shortcodes Material/Hugo disponibles sont documentés et démontrés dans
`src/content/blog/hugo-material-shortcodes.md`. Ce fichier est une page de référence non listée.

## 4. Ajouter une image

Placez de préférence l'image dans `src/content/blog/images`, puis utilisez un chemin relatif :

```md
![Description utile de l'image](./images/mon-image.webp)
```

Le texte entre crochets décrit l'image aux personnes qui ne peuvent pas la voir. Évitez les textes
comme « image » ou « capture » sans contexte.

Le pipeline Markdown ajoute automatiquement le chargement différé, le décodage asynchrone et les
données nécessaires à l'aperçu. Le composant d'aperçu gère ensuite le zoom, la navigation, le
téléchargement et le partage selon les capacités du navigateur.

Pour une image provenant d'un autre site, utilisez une URL complète seulement si cette source est
fiable et compatible avec la politique de sécurité du site. Une image locale est plus durable.

## 5. Prévisualiser

Pendant l'écriture :

```sh
pnpm dev
```

L'URL de l'article est basée sur son nom de fichier :

```text
http://localhost:4321/posts/mon-premier-article/
```

Avant la publication, construisez le site :

```sh
pnpm build
pnpm preview
```

`pnpm build` valide aussi les liens internes, les ancres, les fichiers référencés, les H1, les URL
canoniques et l'absence des brouillons dans les surfaces de découverte.

## 6. Publier

Pour publier un brouillon existant :

1. remplacez le texte temporaire par le contenu final ;
2. ajoutez une `description` utile ;
3. passez `listed` à `true` ;
4. lancez `pnpm build` ;
5. commitez et poussez le fichier ainsi que ses images ;
6. ouvrez une pull request vers `develop` si vous travaillez sur une branche séparée.

Il est également possible de créer directement un article listé :

```sh
pnpm new:post "Titre" --description "Résumé utile et autonome." --publish
```

## Dates de création et de modification

Les dates ne sont pas écrites dans le frontmatter. Au moment du build, le site interroge Git pour
le fichier de l'article :

- la création correspond au premier commit pertinent du fichier ;
- la dernière modification correspond au commit pertinent le plus récent ;
- les renommages sont suivis avec `git log --follow` ;
- si l'historique Git est indisponible, le code utilise temporairement les dates du fichier local.

La page affiche ces deux dates et, lorsqu'ils sont disponibles, des liens vers les commits GitHub.
La date d'un brouillon non commité peut donc sembler locale ou changer : le commit établit la source
de vérité durable.

Vercel exécute `scripts/ensure-git-history.mjs` avant son build pour vérifier que l'historique requis
est présent. Un clone peu profond peut empêcher le calcul correct de la date de création.

## Auteur de l'article

L'auteur déclaré actuellement dans les métadonnées structurées de chaque article est `c2tz`, avec
un lien vers `https://www.cta.li/`. Il est défini globalement dans
`src/pages/posts/[...slug]/index.astro` et non dans le frontmatter de chaque article.

Cela signifie que le projet ne gère pas encore plusieurs auteurs par article. Pour ajouter cette
possibilité, il faudrait étendre le schéma de contenu, le générateur, l'affichage et les tests avant
d'utiliser un champ `author` dans les fichiers Markdown.

## Corriger un article déjà publié

Modifiez son fichier, vérifiez le résultat, puis créez un nouveau commit. La date de dernière
modification sera mise à jour automatiquement au prochain build. Ne modifiez pas la date à la main.
