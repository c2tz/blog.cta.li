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

À partir de quatre titres `##` ou `###`, le site ajoute automatiquement un sommaire après
l’introduction, juste avant la première section. Il est visible en mode détaillé et masqué en
mode simple, selon le bouton d’affichage dans l’en-tête. Ses liens reprennent les ancres des titres ;
les sous-sections `###` sont imbriquées sous leur section `##`. Les exemples de code et les
titres des composants ne sont pas repris. Les articles courts gardent leur présentation simple.
Ses liens sont de simples ancres HTML. Le sommaire n’ajoute pas de texte en double dans la recherche.

Un tag :

- contient de 1 à 48 caractères ;
- commence par une lettre ou un chiffre ;
- ne contient pas d'espace ;
- peut contenir lettres, chiffres, points, tirets, `_` et `+` ;
- ne doit pas être `all`, car le site ajoute ce tag automatiquement.

### Image d’aperçu lors du partage

Le site génère automatiquement `/posts/identifiant-de-l-article/og.png` avec le titre, la date de
création issue de Git et les deux premiers tags du frontmatter, dans leur ordre de rédaction.
Placez donc les deux tags les plus représentatifs en premier. Aucun champ de date ou d’image
supplémentaire n’est nécessaire.

La description reste dans les métadonnées de partage ; elle n’est pas imprimée dans l’image pour
laisser de la place au titre. Les titres et tags très longs se terminent par une ellipse dans ce
visuel, sans modifier le texte de l’article. La police Google Sans est fournie en WOFF2 local et
utilisée uniquement pendant la génération de ces images.

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

Pour ajouter des encadrés, boutons, icônes, onglets, infobulles ou tableaux interactifs dans un
simple `.md`, ouvrez le [catalogue de rédaction](../src/content/blog/catalogue-redaction.md).
Chaque élément a un exemple à copier, un aperçu et ses options utiles. Avec le serveur local,
ouvrez `/posts/catalogue-redaction/` pour voir les rendus et utiliser les boutons de copie.
Cette page est non listée afin de garder la documentation hors des listes d’articles.

La [référence des shortcodes](../src/content/blog/hugo-material-shortcodes.md) rassemble aussi
les douze types d’encadrés et un exemple combinant plusieurs composants.

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

La page affiche la date de création et, lorsqu’il existe, un lien vers son commit GitHub.
La date de modification et son lien n’apparaissent que si le commit de modification est différent
de celui de création. Deux commits distincts restent distingués, même s’ils datent du même jour.
Si les deux commits ne sont pas disponibles, la page compare les jours affichés, dans le fuseau
Europe/Paris, et masque la modification lorsque les deux dates correspondent au même jour.

La date d’un brouillon non commité peut donc sembler locale ou changer : le commit établit la source
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
