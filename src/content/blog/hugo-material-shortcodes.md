---
title: 'Shortcodes Hugo Material'
description: 'Guide des shortcodes Hugo optionnels du blog : admonitions, icônes Material Symbols, onglets, tableaux Angular Material et blocs Shiki.'
tags:
  - documentation
  - shortcodes
  - material
---

Ce site garde le Markdown et le MDX standards comme base. Les shortcodes ci-dessous sont
optionnels : ils servent uniquement quand un article a besoin d’un composant plus riche, sans
forcer tous les contenus à passer par Angular.

La syntaxe recommandée suit Hugo :

```markdown
{{< nom-du-shortcode option="valeur" >}}

Contenu Markdown.

{{< /nom-du-shortcode >}}
```

Les blocs appairés doivent être isolés par des lignes vides. Le shortcode inline `icon` est la
seule exception prévue pour vivre au milieu d’une phrase.

## Admonitions

Une admonition est un encart de contexte : note, avertissement, erreur, exemple, citation, etc. Le
comportement est inspiré de Material for MkDocs, mais les icônes viennent de Material Symbols.

### Syntaxe

```markdown
{{< admonition type="warning" title="Attention" >}}

Le contenu reste du **Markdown**. Vous pouvez mettre des listes, des liens, du code ou même une
autre admonition.

{{< /admonition >}}
```

### Rendu

{{< admonition type="warning" title="Attention" >}}

Le contenu reste du **Markdown**. Vous pouvez mettre des listes, des liens, du code ou même une
autre admonition.

{{< /admonition >}}

### Paramètres

| Paramètre | Exemple | Rôle |
| --- | --- | --- |
| `type` | `warning` | Famille visuelle. Si le type est inconnu, le rendu revient à `note`. |
| `title` | `Attention` | Titre affiché dans l’en-tête. |
| `icon` | `children-face` | Icône Material Symbol en kebab-case. |
| `collapsible` | `true` | Transforme l’encart en bloc pliable. |
| `open` | `true` | Ouvre par défaut un bloc pliable. |

### Types disponibles

Les types canoniques sont `note`, `abstract`, `info`, `tip`, `success`, `question`, `warning`,
`failure`, `danger`, `bug`, `example` et `quote`.

Les alias pratiques sont également acceptés : `summary`, `tldr`, `todo`, `hint`, `important`,
`check`, `done`, `help`, `faq`, `attention`, `caution`, `fail`, `missing`, `error` et `cite`.

Les icônes par défaut suivent le type : `info` utilise `info`, `warning` utilise `warning`,
`danger` utilise `dangerous`, `bug` utilise `bug-report`, etc. Vous pouvez toujours forcer une
autre icône avec le paramètre `icon`.

{{< admonition type="note" >}}

Une note neutre pour ajouter un détail.

{{< /admonition >}}

{{< admonition type="abstract" >}}

Un résumé ou une synthèse.

{{< /admonition >}}

{{< admonition type="info" >}}

Une information utile à lire avant de continuer.

{{< /admonition >}}

{{< admonition type="tip" >}}

Une astuce courte.

{{< /admonition >}}

{{< admonition type="success" >}}

Une action réussie ou validée.

{{< /admonition >}}

{{< admonition type="question" >}}

Une question ou une FAQ.

{{< /admonition >}}

{{< admonition type="warning" >}}

Un avertissement qui mérite de l’attention.

{{< /admonition >}}

{{< admonition type="failure" >}}

Un échec, un cas manquant ou une réponse négative.

{{< /admonition >}}

{{< admonition type="danger" >}}

Un danger ou une erreur importante.

{{< /admonition >}}

{{< admonition type="bug" >}}

Un bug connu.

{{< /admonition >}}

{{< admonition type="example" >}}

Un exemple concret.

{{< /admonition >}}

{{< admonition type="quote" >}}

Une citation ou une note de référence.

{{< /admonition >}}

### Bloc pliable

```markdown
{{< admonition type="info" title="Détails" collapsible=true open=true >}}

Ce bloc est ouvert par défaut, mais peut être replié.

{{< /admonition >}}
```

{{< admonition type="info" title="Détails" collapsible=true open=true >}}

Ce bloc est ouvert par défaut, mais peut être replié.

{{< /admonition >}}

## Icônes Material Symbols

Le shortcode `icon` insère une icône Material Symbol inline :

```markdown
Voici une icône {{< icon "children-face" />}} dans une phrase.
```

Voici une icône {{< icon "children-face" />}} dans une phrase.

Avec un libellé accessible :

```markdown
{{< icon name="children-face" label="Enfants" />}}
```

Les noms s’écrivent en kebab-case dans les articles. Le moteur convertit ensuite vers le nom de
glyph Material Symbols en snake_case. Exemple : `children-face` devient `children_face`, puis
l’alias actuel le redirige vers `child_care`.

### Ajouter un symbole qui n’est pas enregistré

La police Material Symbols livrée en production est un subset, donc elle ne contient que les glyphs
réellement utilisés par le site. C’est volontaire : charger les 4 000+ icônes pour quelques boutons
serait trop lourd.

Si un symbole ne fonctionne pas :

1. Vérifiez son nom dans `src/generated/material-symbol-codepoints.json` en version snake_case.
   Exemple : `vertical-align-top` devient `vertical_align_top`.
2. Utilisez-le dans un article avec son nom en kebab-case :

   ```markdown
   {{< icon "vertical-align-top" />}}
   ```

3. Régénérez le subset :

   ```bash
   pnpm update:material-symbols
   ```

4. Vérifiez que la fonte livrée contient bien toutes les icônes détectées :

   ```bash
   pnpm check:material-symbols
   ```

5. Si le symbole n’existe pas dans `material-symbol-codepoints.json`, mettez à jour la carte depuis
   le paquet `material-symbols` :

   ```bash
   pnpm update:material-symbol-map
   pnpm update:material-symbols
   ```

6. Si le nom public que vous voulez écrire ne correspond pas au nom réel du glyph, ajoutez un alias
   dans `MATERIAL_SYMBOL_ALIASES` dans `src/lib/remark-hugo-material-shortcodes.mjs`.

Le moteur échoue volontairement au build si une icône est inconnue. C’est mieux qu’un carré vide
silencieux en production.

Le script `pnpm check:material-symbols` est aussi exécuté par `pnpm verify:project`. Le workflow
GitHub détecte donc automatiquement une icône ajoutée sans régénération du subset.

## Onglets

Les onglets sont rendus par Angular Material. Ils sont utiles pour proposer plusieurs commandes ou
plusieurs variantes sans dupliquer le texte autour.

### Syntaxe

````markdown
{{< tabs label="Gestionnaire de paquets" >}}

{{< tab title="pnpm" >}}

```bash
pnpm install
```

{{< /tab >}}

{{< tab title="npm" >}}

```bash
npm install
```

{{< /tab >}}

{{< /tabs >}}
````

### Rendu

{{< tabs label="Gestionnaire de paquets" >}}

{{< tab title="pnpm" >}}

```bash
pnpm install
```

{{< /tab >}}

{{< tab title="npm" >}}

```bash
npm install
```

{{< /tab >}}

{{< /tabs >}}

## Tableaux Angular Material

Le Markdown standard reste disponible pour les tableaux simples. Le shortcode `material-table`
active un tableau Angular Material uniquement quand vous avez besoin de tri, filtre ou pagination.

### Syntaxe

```markdown
{{< material-table filter=true sort=true paginate=true pageSize=5 >}}

| Composant | Rôle | Interactif |
| --- | --- | --- |
| MatTable | Données tabulaires | Oui |
| MatTabs | Contenu à onglets | Oui |
| Admonition | Information contextuelle | Non |

{{< /material-table >}}
```

### Rendu

{{< material-table filter=true sort=true paginate=true pageSize=5 >}}

| Composant | Rôle | Interactif |
| --- | --- | --- |
| MatTable | Données tabulaires | Oui |
| MatTabs | Contenu à onglets | Oui |
| Admonition | Information contextuelle | Non |
| Shiki | Bloc de code éditorial | Non |

{{< /material-table >}}

### Paramètres

| Paramètre | Défaut | Rôle |
| --- | --- | --- |
| `filter` | `false` | Ajoute un champ de recherche. |
| `sort` | `true` | Active le tri sur les colonnes. |
| `paginate` | `false` | Ajoute une pagination. |
| `pageSize` | `10` | Taille de page si la pagination est active. |

## Blocs Shiki

Les blocs de code Markdown normaux utilisent déjà Shiki via Astro. Le shortcode `shiki` ajoute une
couche éditoriale optionnelle : titre, nom de fichier, légende et icône. Le code lui-même reste un
vrai bloc fenced Markdown, donc la coloration reste celle d’Astro/Shiki.

Le site n’affiche pas de numéros de ligne par défaut. Les annotations Shiki restent disponibles :
focus, diff, warning, error, info et highlight.

### Syntaxe

````markdown
{{< shiki title="Signal Angular" filename="counter.component.ts" lang="ts" meta="{2}" >}}

```
const count = signal(0)
count.update((value) => value + 1)
```

{{< /shiki >}}
````

### Rendu

{{< shiki title="Signal Angular" filename="counter.component.ts" lang="ts" meta="{2}" >}}

```
const count = signal(0)
count.update((value) => value + 1)
```

{{< /shiki >}}

### Paramètres

| Paramètre | Exemple | Rôle |
| --- | --- | --- |
| `lang` | `ts` | Langage Shiki si le bloc fenced n’en déclare pas. |
| `meta` | `{2}` | Meta Shiki ajoutée au bloc, par exemple pour surligner des lignes. |
| `title` | `Signal Angular` | Titre visible au-dessus du bloc. |
| `filename` ou `file` | `counter.component.ts` | Nom de fichier affiché à droite. |
| `caption` | `Exemple minimal` | Légende sous le bloc. |
| `icon` | `terminal` | Icône Material Symbol de l’en-tête. |

### Options Shiki activées

Les transformers Shiki sont chargés, mais ils ne changent rien tant que vous n’utilisez pas leurs
notations :

````markdown
```ts {1,3-4} /signal/
const count = signal(0)
count.set(1)
count.update((value) => value + 1)
```
````

```ts {1,3-4} /signal/
const count = signal(0)
count.set(1)
count.update((value) => value + 1)
```

Vous pouvez aussi annoter directement le code :

````markdown
```ts
const oldValue = 0 // [!code --]
const newValue = 1 // [!code ++]
console.warn("Attention") // [!code warning]
console.error("Erreur") // [!code error]
```
````

```ts
const oldValue = 0 // [!code --]
const newValue = 1 // [!code ++]
console.warn("Attention") // [!code warning]
console.error("Erreur") // [!code error]
```

Les notations utiles sont :

| Notation | Effet |
| --- | --- |
| `{1,3-4}` dans la meta | Surligne des lignes. |
| `/signal/` dans la meta | Surligne un mot. |
| `[!code ++]` / `[!code --]` | Marque une ligne ajoutée ou supprimée. |
| `[!code highlight]` | Surligne une ligne. |
| `[!code focus]` | Met une ligne au focus et atténue les autres. |
| `[!code warning]`, `[!code error]`, `[!code info]` | Marque une ligne par niveau. |
| `[!code word:signal]` | Surligne un mot dans les lignes suivantes. |

### Code inline

Astro colore déjà les blocs fenced Markdown avec Shiki. Shiki sait aussi colorer du code inline via
`@shikijs/rehype` avec une option dédiée, par exemple une syntaxe de type
`` `const value = 1{:ts}` ``. Ce n’est pas activé ici pour l’instant : les `<code>` inline restent
volontairement simples et intégrés au style du texte.

## Maintenance automatique

### Material Symbols

- `pnpm update:material-symbols` scanne `src/`, détecte les codepoints utilisés et régénère
  `public/fonts/material-symbols-rounded-subset.woff2`.
- Le même script met à jour le cache-buster de `src/assets/css/base/fonts.scss` avec un hash du
  fichier WOFF2.
- `pnpm check:material-symbols` échoue si une icône utilisée manque dans le subset.
- `pnpm verify:project` lance ce check, donc la CI attrape les oublis.

### Headers et hashes CSP

Les hashes de scripts inline dépendent du HTML généré. Si le build change ces scripts, il faut
mettre à jour `vercel.json` :

```bash
pnpm build
pnpm sync:headers
pnpm check:headers
```

Le workflow `Sync security header hashes` lance la même séquence sur les pull requests internes et
commite automatiquement `vercel.json` si les hashes CSP ont changé. Le build Vercel vérifie ensuite
les headers avec `pnpm build:vercel`.

## Règles à garder en tête

- Les shortcodes sont opt-in : si vous n’en mettez pas, le Markdown standard reste standard.
- Les blocs appairés ont besoin de lignes vides autour de leur contenu.
- Les paramètres peuvent être nommés ou positionnels, mais pas mélangés dans le même appel.
- Les icônes doivent exister dans la carte Material Symbols ou passer par un alias.
- Le build doit échouer quand un shortcode ou une icône est inconnue : c’est volontaire pour éviter
  les pages cassées en production.
