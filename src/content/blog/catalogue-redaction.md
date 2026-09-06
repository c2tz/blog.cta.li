---
title: "Catalogue pour écrire un article en Markdown"
description: "Des exemples à copier et leur rendu : encadrés, boutons, icônes, onglets, infobulles, tableaux interactifs et code."
listed: false
tags:
  - documentation
---

Tous les exemples de cette page fonctionnent dans un article **`.md`** du blog. Un shortcode est
une petite balise qui ajoute un élément enrichi au Markdown. Astro le transforme automatiquement :
vous n’avez ni composant à importer, ni style à écrire.

**Pour vous en servir :** choisissez un élément, utilisez le bouton **Copier le code source** du
bloc correspondant, collez-le dans votre article et remplacez le texte. Conservez les balises et
les lignes vides. Les aperçus sont de vrais éléments du site : vous pouvez les ouvrir, les trier
ou changer d’onglet.

## Créer un article

Depuis la racine du dépôt, cette commande crée un fichier `.md` prêt à remplir :

```sh
pnpm new:post "Mon nouvel article" --tag astuces
```

Vous pouvez aussi créer `src/content/blog/mon-nouvel-article.md` vous-même avec ce modèle :

```md
---
title: "Mon nouvel article"
description: "Un résumé court qui donne envie de lire la suite."
listed: false
tags:
  - astuces
---

Un paragraphe pour introduire le sujet.

## Une première partie

Le contenu de votre article.
```

`title` fournit déjà le grand titre de la page : commencez les sections avec `##`, puis les
sous-sections avec `###`. Les dates de création et de modification viennent de Git ; aucun champ
de date n’est à ajouter.

À partir de quatre titres `##` ou `###`, un **sommaire se crée automatiquement** après
l’introduction et apparaît en **mode détaillé**. Le mode simple le masque. Il reprend les titres
de l’article et place les sous-sections en retrait.
Vous n’avez aucun lien à maintenir ; les titres à l’intérieur des exemples de code sont ignorés.

Gardez `listed: false` pendant la rédaction. La page reste accessible par son URL directe, mais
n’apparaît pas dans les listes d’articles ni la recherche. Passez à `listed: true` pour la publier.

## Le Markdown courant

**À copier :**

```md
Un texte avec du **gras**, de l’_italique_, du ~~texte barré~~ et du `code court`.

Un [lien vers tous les articles](/tags/all/).

- Une première idée.
- Une deuxième idée.

1. Ouvrir le fichier.
2. Écrire son contenu.
3. Prévisualiser le résultat.

> Une citation ou un passage à mettre en évidence.
```

**Rendu :**

Un texte avec du **gras**, de l’_italique_, du ~~texte barré~~ et du `code court`.

Un [lien vers tous les articles](/tags/all/).

- Une première idée.
- Une deuxième idée.

1. Ouvrir le fichier.
2. Écrire son contenu.
3. Prévisualiser le résultat.

> Une citation ou un passage à mettre en évidence.

## Les encadrés

Utilisez `admonition` pour une note, une astuce, un avertissement ou un résumé. Le contenu peut
inclure du Markdown : paragraphes, listes, liens et blocs de code.

**À copier :**

```md
{{< admonition type="tip" title="À retenir" >}}

Vous pouvez écrire du **gras**, ajouter un [lien](/tags/all/) et faire une liste :

- Une idée importante.
- Une autre idée utile.

{{< /admonition >}}
```

**Rendu :**

{{< admonition type="tip" title="À retenir" >}}

Vous pouvez écrire du **gras**, ajouter un [lien](/tags/all/) et faire une liste :

- Une idée importante.
- Une autre idée utile.

{{< /admonition >}}

Changez `type` pour choisir l’apparence. Le titre et l’icône s’adaptent automatiquement si vous
omettez `title` et `icon`.

| `type`     | Titre par défaut | Utilisation                         |
| ---------- | ---------------- | ----------------------------------- |
| `note`     | Note             | Un détail en complément.            |
| `abstract` | Résumé           | Les points essentiels.              |
| `info`     | Information      | Une précision à connaître.          |
| `tip`      | Astuce           | Un conseil pratique.                |
| `success`  | Succès           | Un résultat réussi.                 |
| `question` | Question         | Une question ou une aide.           |
| `warning`  | Attention        | Un avertissement.                   |
| `failure`  | Échec            | Une opération qui n’a pas réussi.   |
| `danger`   | Danger           | Une erreur importante ou un risque. |
| `bug`      | Bug              | Un problème connu.                  |
| `example`  | Exemple          | Un cas concret.                     |
| `quote`    | Citation         | Un extrait commenté.                |

`type` vaut `note` par défaut. `title="Votre titre"` personnalise le titre et `icon="info"`
remplace l’icône. Les alias suivants sont également acceptés ; certains adaptent le titre ou
l’icône en conservant l’apparence du type correspondant :

| Alias                  | Type correspondant |
| ---------------------- | ------------------ |
| `summary`, `tldr`      | `abstract`         |
| `todo`                 | `info`             |
| `hint`, `important`    | `tip`              |
| `check`, `done`        | `success`          |
| `help`, `faq`          | `question`         |
| `attention`, `caution` | `warning`          |
| `fail`, `missing`      | `failure`          |
| `error`                | `danger`           |
| `cite`                 | `quote`            |

## Les encadrés repliables

Ajoutez `collapsible=true` au même shortcode. Cliquez sur le titre de l’aperçu pour le déplier.

**À copier :**

```md
{{< admonition type="question" title="Comment prévisualiser mon article ?" collapsible=true >}}

Lancez `pnpm dev`, puis ouvrez l’adresse affichée dans le terminal.

{{< /admonition >}}
```

**Rendu :**

{{< admonition type="question" title="Comment prévisualiser mon article ?" collapsible=true >}}

Lancez `pnpm dev`, puis ouvrez l’adresse affichée dans le terminal.

{{< /admonition >}}

L’encadré est fermé au départ. Ajoutez `open=true` pour qu’il soit ouvert dès l’arrivée sur la
page, tout en restant repliable.

## Les boutons

Le shortcode `button` crée un lien présenté comme un bouton. `href` indique sa destination et
`label` son texte. Voici la forme la plus courte :

**À copier :**

```md
{{< button href="/tags/all/" label="Voir les articles" variant="tonal" icon="article" />}}
```

**Rendu :**

{{< button href="/tags/all/" label="Voir les articles" variant="tonal" icon="article" />}}

### Les cinq apparences

Remplacez `variant` par l’un de ces noms. Sans ce paramètre, le bouton utilise `filled`.

```md
{{< button href="/tags/all/" label="Rempli" variant="filled" />}}

{{< button href="/tags/all/" label="Tonal" variant="tonal" />}}

{{< button href="/tags/all/" label="Contour" variant="outlined" />}}

{{< button href="/tags/all/" label="Texte" variant="text" />}}

{{< button href="/tags/all/" label="Élevé" variant="elevated" />}}
```

{{< button href="/tags/all/" label="Rempli" variant="filled" />}}

{{< button href="/tags/all/" label="Tonal" variant="tonal" />}}

{{< button href="/tags/all/" label="Contour" variant="outlined" />}}

{{< button href="/tags/all/" label="Texte" variant="text" />}}

{{< button href="/tags/all/" label="Élevé" variant="elevated" />}}

`icon` est facultatif et place l’icône avant le texte. `target="_blank"` ouvre le lien dans un
nouvel onglet. `href` accepte aussi une URL complète ou une adresse `mailto:`.

Pour mettre du Markdown dans le libellé, remplacez `label` par un seul paragraphe court entre
les balises :

```md
{{< button href="/tags/all/" variant="outlined" >}}

Voir **tous** les articles

{{< /button >}}
```

{{< button href="/tags/all/" variant="outlined" >}}

Voir **tous** les articles

{{< /button >}}

## Les icônes

Le shortcode `icon` peut se placer directement dans une phrase. L’icône suit la taille et la
couleur du texte.

**À copier :**

```md
Une précision utile {{< icon name="info" label="Information" />}} pour la suite.
```

**Rendu :**

Une précision utile {{< icon name="info" label="Information" />}} pour la suite.

Quelques noms disponibles :

- `info` : {{< icon name="info" />}}
- `article` : {{< icon name="article" />}}
- `search` : {{< icon name="search" />}}
- `lightbulb` : {{< icon name="lightbulb" />}}
- `check-circle` : {{< icon name="check-circle" />}}
- `warning` : {{< icon name="warning" />}}

`label` donne un nom à l’icône pour les lecteurs d’écran. Omettez-le si l’icône est uniquement
décorative et que le texte voisin porte déjà son sens. Les noms utilisés par les encadrés sont
également disponibles ; le dépôt contient la liste complète dans
`src/generated/material-symbol-codepoints.json`.

## Les infobulles simples

Pour développer un sigle, utilisez la balise HTML `abbr` directement dans votre `.md`.
Le site présente son `title` comme une infobulle au survol.

**À copier :**

```md
Une requête <abbr title="Hypertext Transfer Protocol">HTTP</abbr> échange des données avec un serveur.
```

**Rendu :**

Une requête <abbr title="Hypertext Transfer Protocol">HTTP</abbr> échange des données avec un serveur.

`title` contient du texte simple. Pour une explication avec des liens, une liste ou un bouton,
utilisez l’infobulle riche ci-dessous. Gardez les informations indispensables dans le texte de
l’article.

## Les infobulles riches

Il faut **deux shortcodes** : `rich-tooltip-ref` affiche le déclencheur et `rich-tooltip` contient
l’explication. Ils partagent exactement le même `id`. Copiez le bloc entier.

**À copier :**

```md
Le site se construit avec Astro. {{< rich-tooltip-ref id="detail-construction" label="Comment ça marche ?" />}}

{{< rich-tooltip id="detail-construction" title="La construction du site" >}}

Astro prépare les pages à partir de vos fichiers **Markdown** :

- Le texte devient une page HTML.
- Les shortcodes prennent l’apparence du site.

{{< button href="/tags/all/" label="Parcourir les articles" variant="text" />}}

{{< /rich-tooltip >}}
```

**Rendu :**

Le site se construit avec Astro. {{< rich-tooltip-ref id="detail-construction" label="Comment ça marche ?" />}}

{{< rich-tooltip id="detail-construction" title="La construction du site" >}}

Astro prépare les pages à partir de vos fichiers **Markdown** :

- Le texte devient une page HTML.
- Les shortcodes prennent l’apparence du site.

{{< button href="/tags/all/" label="Parcourir les articles" variant="text" />}}

{{< /rich-tooltip >}}

Survolez le déclencheur, atteignez-le au clavier ou touchez-le sur écran tactile pour ouvrir
l’explication. La touche Échap la ferme.

| Paramètre | À écrire dans…      | Rôle                                                                 |
| --------- | ------------------- | -------------------------------------------------------------------- |
| `id`      | Les deux shortcodes | Relier le déclencheur au contenu. Obligatoire.                       |
| `label`   | `rich-tooltip-ref`  | Texte du déclencheur. Par défaut : « Afficher le détail ».           |
| `title`   | `rich-tooltip`      | Titre de l’explication. Par défaut : « Information complémentaire ». |

Choisissez un identifiant différent pour chaque infobulle de la page, par exemple
`detail-construction` puis `detail-images`. Commencez par une lettre ; utilisez ensuite des
lettres sans accent, des chiffres, des tirets ou des underscores.

Le contenu accepte aussi du code, des images, des encadrés, des onglets et des tableaux. Une
infobulle riche ne peut pas contenir une autre infobulle riche ni son déclencheur.

## Les onglets

`tabs` regroupe les onglets ; chaque `tab` fournit un titre et son contenu Markdown. Voici deux
façons de créer un article. Cliquez sur le second onglet dans l’aperçu.

**À copier :**

````md
{{< tabs label="Créer un article" >}}

{{< tab title="Avec la commande" >}}

```sh
pnpm new:post "Mon nouvel article"
```

{{< /tab >}}

{{< tab title="À la main" >}}

Créez un fichier `.md` dans `src/content/blog`, puis ajoutez son titre et son contenu.

{{< /tab >}}

{{< /tabs >}}
````

**Rendu :**

{{< tabs label="Créer un article" >}}

{{< tab title="Avec la commande" >}}

```sh
pnpm new:post "Mon nouvel article"
```

{{< /tab >}}

{{< tab title="À la main" >}}

Créez un fichier `.md` dans `src/content/blog`, puis ajoutez son titre et son contenu.

{{< /tab >}}

{{< /tabs >}}

Dupliquez un bloc `tab` complet pour ajouter un onglet. `label` nomme le groupe pour les lecteurs
d’écran ; `title` nomme chaque onglet. Le premier est sélectionné à l’ouverture.

## Les tableaux interactifs

Écrivez un tableau Markdown ordinaire entre les balises `material-table`. Le shortcode peut lui
ajouter une recherche, un tri par colonne et une pagination.

**À copier :**

```md
{{< material-table filter=true sort=true paginate=true pageSize=5 >}}

| Élément   | Exemple           | Quantité |
| --------- | ----------------- | -------: |
| Encadré   | Une astuce        |        3 |
| Bouton    | Voir les articles |        2 |
| Icône     | Information       |        4 |
| Onglet    | Deux méthodes     |        2 |
| Infobulle | Un détail         |        1 |
| Tableau   | Un comparatif     |        6 |

{{< /material-table >}}
```

**Rendu :** essayez « astuce » dans le filtre, cliquez sur « Quantité » pour trier ou passez à la
page suivante pour voir la sixième ligne.

{{< material-table filter=true sort=true paginate=true pageSize=5 >}}

| Élément   | Exemple           | Quantité |
| --------- | ----------------- | -------: |
| Encadré   | Une astuce        |        3 |
| Bouton    | Voir les articles |        2 |
| Icône     | Information       |        4 |
| Onglet    | Deux méthodes     |        2 |
| Infobulle | Un détail         |        1 |
| Tableau   | Un comparatif     |        6 |

{{< /material-table >}}

| Option     | Valeur par défaut | Effet                                                     |
| ---------- | ----------------- | --------------------------------------------------------- |
| `filter`   | `false`           | `true` ajoute un champ pour filtrer les lignes.           |
| `sort`     | `true`            | `false` désactive le tri au clic sur les en-têtes.        |
| `paginate` | `false`           | `true` répartit les lignes sur plusieurs pages.           |
| `pageSize` | `10`              | Nombre de lignes par page, par exemple `5`, `10` ou `25`. |

Pour un tableau sans commandes interactives, utilisez seulement la syntaxe Markdown du tableau,
sans les balises `material-table`.

## Les barres de progression

Le shortcode `progress` affiche une barre Material Web. La valeur est celle écrite dans le
fichier : elle ne mesure pas automatiquement une opération réelle.

**À copier :**

```md
Progression de l’exemple : **65 %**.

{{< progress label="Progression de l’exemple" value=65 buffer=85 max=100 />}}
```

**Rendu :**

Progression de l’exemple : **65 %**.

{{< progress label="Progression de l’exemple" value=65 buffer=85 max=100 />}}

| Option          | Rôle                                                                  |
| --------------- | --------------------------------------------------------------------- |
| `label`         | Nom de la progression pour les lecteurs d’écran.                      |
| `value`         | Valeur atteinte, entre `0` et `max`. `percent` est un alias accepté.  |
| `max`           | Total à atteindre, `100` par défaut.                                  |
| `buffer`        | Valeur du tampon, facultative, comprise entre `value` et `max`.       |
| `indeterminate` | `true` anime la barre sans pourcentage connu ; omettez alors `value`. |
| `fourColor`     | `true` active l’apparence à quatre couleurs du mode indéterminé.      |

Pour illustrer une attente sans valeur connue :

```md
{{< progress label="Exemple d’attente" indeterminate=true fourColor=true />}}
```

{{< progress label="Exemple d’attente" indeterminate=true fourColor=true />}}

Cette seconde barre est une démonstration continue, pas un chargement de la page.

## Le code

Entourez le code de trois accents graves et indiquez son langage : `sh`, `js`, `ts`, `json`,
`html`, `css`, `md`… La coloration et le bouton de copie sont automatiques. `{2}` met en évidence
la deuxième ligne ; ce réglage est facultatif.

**À copier :**

````md
```js {2}
const titre = "Mon article";
console.log(titre);
```
````

**Rendu :**

```js {2}
const titre = "Mon article";
console.log(titre);
```

Pour montrer un shortcode comme du code sans le transformer en encadré ou en bouton, placez-le
dans un bloc de code, comme tous les exemples à copier de cette page. Si ce bloc contient déjà
trois accents graves, entourez l’ensemble de quatre accents graves.

## Les images

Placez votre fichier dans `src/content/blog/images`, puis remplacez le nom et la description :

```md
![Un lac de montagne entouré de sommets](./images/mon-image.webp)
```

Le fichier doit exister à cet emplacement. Le texte entre crochets décrit ce qu’on voit.
Le site ajoute automatiquement son aperçu agrandi ; vous n’avez pas de shortcode à écrire.

## Les réflexes à garder

- **Restez en `.md` pour ces exemples.** MDX interprète autrement les accolades ; changer
  simplement l’extension d’un article contenant ces shortcodes n’est pas une conversion.
- **Conservez les lignes vides.** Isolez les balises des encadrés, boutons, onglets, tableaux,
  progressions et contenus d’infobulles sur leurs propres lignes. Seuls `icon` et
  `rich-tooltip-ref` peuvent être insérés au milieu d’une phrase.
- **Fermez les blocs.** Un encadré ouvert avec `admonition` se termine par `/admonition`.
  Les formes courtes comme `icon`, `progress` ou un bouton avec `label` se terminent par `/>}}`.
- **Gardez les guillemets droits dans le code.** Écrivez `title="Mon titre"`. Les guillemets
  typographiques conviennent au texte de l’article, mais pas pour délimiter les paramètres.
- **Vérifiez les identifiants des infobulles riches.** Le déclencheur et son contenu ont le même
  `id`, différent de ceux des autres infobulles de la page.

Pour prévisualiser pendant la rédaction :

```sh
pnpm dev
```

Ouvrez l’adresse affichée dans le terminal, puis `/posts/mon-nouvel-article/` pour le fichier
`mon-nouvel-article.md`. Avant de publier, `pnpm build` vérifie aussi le contenu et les liens.

Le cycle de publication est détaillé dans `guide/publier-un-article.md`. Pour voir les douze
encadrés et un exemple qui combine plusieurs éléments, consultez aussi la
[page de référence des shortcodes](/posts/hugo-material-shortcodes/).
