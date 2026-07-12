---
title: "Shortcodes Astro et Material Web"
description: "Guide des shortcodes Astro : vrais composants Material Web et patterns éditoriaux sémantiques."
tags:
  - documentation
  - shortcodes
  - material
---

Ce site garde le Markdown et le MDX standards comme base. Les shortcodes ci-dessous sont
optionnels : ils servent uniquement quand un article a besoin d’un composant plus riche, sans
forcer tous les contenus à dépendre d’une bibliothèque d’interface.

Les shortcodes `button`, `icon`, `progress` et `tabs` produisent directement les Web Components
officiels de `@material/web`. Les cartes, annotations, tableaux et admonitions restent du HTML
sémantique stylé avec les tokens Material 3 : Material Web ne livre pas de `md-card`,
`md-data-table`, snackbar ou tooltip. Le blog complète donc la bibliothèque avec les primitives
HTML natives, sans inventer de faux composant `md-*`.

La syntaxe recommandée suit Hugo :

```markdown
{{< nom-du-shortcode option="valeur" >}}

Contenu Markdown.

{{< /nom-du-shortcode >}}
```

Les blocs appairés doivent être isolés par des lignes vides. Les shortcodes inline `icon`,
`inline-badge`, `kbd`, `abbr` et `annotation-ref` peuvent vivre au milieu d’une phrase.

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

| Paramètre     | Exemple         | Rôle                                                                                  |
| ------------- | --------------- | ------------------------------------------------------------------------------------- |
| `type`        | `warning`       | Famille visuelle. Si le type est inconnu, le build échoue avec les valeurs possibles. |
| `title`       | `Attention`     | Titre affiché dans l’en-tête.                                                         |
| `icon`        | `children-face` | Icône Material Symbol en kebab-case.                                                  |
| `collapsible` | `true`          | Transforme l’encart en bloc pliable.                                                  |
| `open`        | `true`          | Ouvre par défaut un bloc pliable.                                                     |

### Types disponibles

Les types canoniques sont `note`, `abstract`, `info`, `tip`, `success`, `question`, `warning`,
`failure`, `danger`, `bug`, `example` et `quote`.

Les alias pratiques sont également acceptés : `summary`, `tldr`, `todo`, `hint`, `important`,
`check`, `done`, `help`, `faq`, `attention`, `caution`, `fail`, `missing`, `error` et `cite`.

Les icônes par défaut suivent le type : `info` utilise `info`, `warning` utilise `warning`,
`failure` utilise `dangerous`, `danger` utilise `report`, `bug` utilise `bug-report`, etc. Vous pouvez toujours forcer une
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

#### Code

```markdown
{{< admonition type="info" title="Détails" collapsible=true open=true >}}

Ce bloc est ouvert par défaut, mais peut être replié.

{{< /admonition >}}
```

#### Rendu

{{< admonition type="info" title="Détails" collapsible=true open=true >}}

Ce bloc est ouvert par défaut, mais peut être replié.

{{< /admonition >}}

#### Variante fermée

```markdown
{{< admonition type="tip" title="Astuce pliable" collapsible=true >}}

Le contenu reste dans le HTML, mais il est fermé au premier affichage.

{{< /admonition >}}
```

{{< admonition type="tip" title="Astuce pliable" collapsible=true >}}

Le contenu reste dans le HTML, mais il est fermé au premier affichage.

{{< /admonition >}}

## Icônes Material Symbols

Le shortcode `icon` insère un vrai `<md-icon>` Material Web inline :

### Code

```markdown
Voici une icône {{< icon "children-face" />}} dans une phrase.
```

### Rendu

Voici une icône {{< icon "children-face" />}} dans une phrase.

### Variante accessible

```markdown
Statut {{< icon name="check-circle" label="Validé" />}} validé.
```

Statut {{< icon name="check-circle" label="Validé" />}} validé.

Les noms s’écrivent en kebab-case dans les articles. Le moteur convertit ensuite vers le nom de
glyph Material Symbols en snake_case. Exemple : `children-face` devient `children_face`, puis
l’alias actuel le redirige vers `child_care`.

## Badges inline

Le shortcode `inline-badge` ajoute un petit état au milieu d’une phrase. Les alias `badge`,
`counter` et `indicator` pointent vers le même rendu.

### Code

```markdown
API {{< inline-badge label="stable" value="v2" tone="success" />}}
Cache {{< badge label="beta" tone="warning" />}}
Incident {{< indicator value="bloquant" tone="danger" />}}
```

### Rendu

API {{< inline-badge label="stable" value="v2" tone="success" />}}
Cache {{< badge label="beta" tone="warning" />}}
Incident {{< indicator value="bloquant" tone="danger" />}}

### Paramètres

| Paramètre | Exemple   | Rôle                                                            |
| --------- | --------- | --------------------------------------------------------------- |
| `label`   | `stable`  | Texte principal du badge.                                       |
| `value`   | `v2`      | Valeur courte, souvent une version ou un état.                  |
| `tone`    | `success` | Ton visuel : `neutral`, `info`, `success`, `warning`, `danger`. |

## Raccourcis clavier

Le shortcode `kbd` évite d’écrire du HTML dans un paragraphe. Les alias `key` et `keys` sont
acceptés.

### Code

```markdown
Ouvrez la recherche avec {{< kbd "Ctrl" "K" />}}.
Fermez le panneau avec {{< key "Esc" />}}.
```

### Rendu

Ouvrez la recherche avec {{< kbd "Ctrl" "K" />}}.
Fermez le panneau avec {{< key "Esc" />}}.

## Progression

Le shortcode `progress` affiche un vrai `<md-linear-progress>` Material Web : migration,
couverture, checklist ou avancement d’une documentation.

Utilisez une valeur déterminée uniquement lorsqu’elle mesure un avancement réel. Pour les attentes
applicatives, le site n’affiche rien avant 200 ms, regroupe les activités liées sous un seul
indicateur et garde le mode indéterminé tant que la durée ou la progression reste inconnue. Une
barre linéaire se place sur le bord du conteneur ; un indicateur circulaire se centre dans l’élément
chargé.

### Code

```markdown
{{< progress label="Migration des composants" value=72 tone="info" />}}
{{< progress label="Couverture des exemples" value=100 tone="success" />}}
```

### Rendu

{{< progress label="Migration des composants" value=72 tone="info" />}}

{{< progress label="Couverture des exemples" value=100 tone="success" />}}

### Paramètres

| Paramètre | Exemple     | Rôle                                                            |
| --------- | ----------- | --------------------------------------------------------------- |
| `label`   | `Migration` | Libellé accessible et visible.                                  |
| `value`   | `72`        | Nombre entre `0` et `100`.                                      |
| `tone`    | `info`      | Ton visuel : `neutral`, `info`, `success`, `warning`, `danger`. |

## Boutons Material Web

Le shortcode `button` produit directement l’un des cinq composants officiellement livrés :
`<md-filled-button>`, `<md-filled-tonal-button>`, `<md-outlined-button>`,
`<md-text-button>` ou `<md-elevated-button>`. Leur propriété `href` crée le lien interne au
composant et les URL sont validées au build. Gardez un libellé bref, idéalement de un à trois mots,
en casse de phrase. Réservez `filled` à l’action principale et `elevated` aux fonds visuellement
chargés qui nécessitent une séparation ; la série ci-dessous sert d’inventaire technique.

```markdown
{{< button href="/tags/all/" variant="filled" icon="article" >}}

Voir les articles

{{< /button >}}

{{< button href="/tags/all/" variant="outlined" label="Parcourir" />}}

{{< button href="/cookies/" variant="tonal" label="Préférences" />}}

{{< button href="/" variant="text" label="Accueil" />}}

{{< button href="/tags/material/" variant="elevated" label="Material" />}}
```

{{< button href="/tags/all/" variant="filled" icon="article" >}}

Voir les articles

{{< /button >}}

{{< button href="/tags/all/" variant="outlined" label="Parcourir" />}}

{{< button href="/cookies/" variant="tonal" label="Préférences" />}}

{{< button href="/" variant="text" label="Accueil" />}}

{{< button href="/tags/material/" variant="elevated" label="Material" />}}

## Surfaces éditoriales en grille

`cards` organise de une à quatre colonnes responsives. Chaque `card` accepte du Markdown, une
icône et un lien optionnel. Ce pattern utilise `<article>` et les vrais rôles de couleur M3 ;
il n’est pas présenté comme un composant Material Web, car `<md-card>` n’existe pas.

```markdown
{{< cards columns=2 >}}

{{< card title="Installation" icon="download" href="/tags/all/" >}}

Accéder aux guides et aux articles publiés.

{{< /card >}}

{{< card title="Parcourir" icon="search" href="/tags/all/" >}}

Retrouver rapidement un contenu.

{{< /card >}}

{{< /cards >}}
```

{{< cards columns=2 >}}

{{< card title="Installation" icon="download" href="/tags/all/" >}}

Accéder aux guides et aux articles publiés.

{{< /card >}}

{{< card title="Parcourir" icon="search" href="/tags/all/" >}}

Retrouver rapidement un contenu.

{{< /card >}}

{{< /cards >}}

## Tooltips simples et enrichis

Les abréviations utilisent le tooltip simple du site. Un rich tooltip est une surface Material
distincte : son déclencheur reste un vrai bouton clavier, sans repère numérique ni apparence de note
de bas de page. Il s’ouvre au survol ou au focus et se referme dès que le déclencheur est quitté.

Le contenu enrichi accepte du Markdown. Un bloc de code est colorisé directement par Shiki sous la
forme `<pre><code>`, sans bouton de copie et sans surlignage de lignes.

````markdown
API {{< abbr text="HTTP" title="Hypertext Transfer Protocol" />}} —
{{< rich-tooltip-ref id="tooltip-http-shiki" label="Voir l’exemple Shiki" />}}

{{< rich-tooltip id="tooltip-http-shiki" title="Requête HTTP" >}}

```ts
const response = await fetch("https://example.com/api");
const payload = await response.json();
```

{{< /rich-tooltip >}}
````

API {{< abbr text="HTTP" title="Hypertext Transfer Protocol" />}} —
{{< rich-tooltip-ref id="tooltip-http-shiki" label="Voir l’exemple Shiki" />}}

{{< rich-tooltip id="tooltip-http-shiki" title="Requête HTTP" >}}

```ts
const response = await fetch("https://example.com/api");
const payload = await response.json();
```

{{< /rich-tooltip >}}

## Figures

Le shortcode `figure` associe une image, son texte alternatif et une légende, avec dimensions
optionnelles pour stabiliser la mise en page.

```markdown
{{< figure src="/mask.webp" alt="Logo du site" caption="Logo de c2tz" width=60 height=60 />}}
```

{{< figure src="/mask.webp" alt="Logo du site" caption="Logo de c2tz" width=60 height=60 />}}

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

Les onglets sont enrichis avec les vrais `<md-tabs>` et `<md-primary-tab>` Material Web. Le
contenu reste lisible avant l’enregistrement des Web Components et le contrôleur associe chaque
onglet à son panneau.

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

### Variante avec contenu éditorial

```markdown
{{< tabs label="États de livraison" >}}

{{< tab title="Stable" >}}

Version {{< badge label="stable" value="v2" tone="success" />}} prête à publier.

{{< /tab >}}

{{< tab title="À vérifier" >}}

Version {{< badge label="audit" tone="warning" />}} à relire avant publication.

{{< /tab >}}

{{< /tabs >}}
```

{{< tabs label="États de livraison" >}}

{{< tab title="Stable" >}}

Version {{< badge label="stable" value="v2" tone="success" />}} prête à publier.

{{< /tab >}}

{{< tab title="À vérifier" >}}

Version {{< badge label="audit" tone="warning" />}} à relire avant publication.

{{< /tab >}}

{{< /tabs >}}

## Tableaux interactifs

Le Markdown standard reste disponible pour les tableaux simples. Material Web ne livre pas de data
table : le shortcode `material-table` conserve donc un vrai `<table>` HTML et ne l’active que
quand vous avez besoin de tri, filtre ou pagination.

### Syntaxe

```markdown
{{< material-table filter=true sort=true paginate=true pageSize=5 >}}

| Composant  | Rôle                     | Interactif |
| ---------- | ------------------------ | ---------- |
| Table      | Données tabulaires       | Oui        |
| Tabs       | Contenu à onglets        | Oui        |
| Admonition | Information contextuelle | Non        |

{{< /material-table >}}
```

### Rendu

{{< material-table filter=true sort=true paginate=true pageSize=5 >}}

| Composant  | Rôle                     | Interactif |
| ---------- | ------------------------ | ---------- |
| Table      | Données tabulaires       | Oui        |
| Tabs       | Contenu à onglets        | Oui        |
| Admonition | Information contextuelle | Non        |
| Shiki      | Bloc de code éditorial   | Non        |

{{< /material-table >}}

### Paramètres

| Paramètre  | Défaut  | Rôle                                        |
| ---------- | ------- | ------------------------------------------- |
| `filter`   | `false` | Ajoute un champ de recherche.               |
| `sort`     | `true`  | Active le tri sur les colonnes.             |
| `paginate` | `false` | Ajoute une pagination.                      |
| `pageSize` | `10`    | Taille de page si la pagination est active. |

### Variante sans pagination

```markdown
{{< material-table sort=true >}}

| Shortcode      | Catégorie | Usage  |
| -------------- | --------- | ------ |
| `admonition`   | Contenu   | Bloc   |
| `inline-badge` | Inline    | Inline |
| `kbd`          | Inline    | Inline |

{{< /material-table >}}
```

{{< material-table sort=true >}}

| Shortcode      | Catégorie | Usage  |
| -------------- | --------- | ------ |
| `admonition`   | Contenu   | Bloc   |
| `inline-badge` | Inline    | Inline |
| `kbd`          | Inline    | Inline |

{{< /material-table >}}

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

### Variante annotée

````markdown
{{< shiki title="Diff annoté" filename="theme.ts" lang="ts" >}}

```ts
const oldAccent = "#6750a4"; // [!code --]
const newAccent = "#0ea5e9"; // [!code ++]
console.warn("Contraste à vérifier"); // [!code warning]
```

{{< /shiki >}}
````

{{< shiki title="Diff annoté" filename="theme.ts" lang="ts" >}}

```ts
const oldAccent = "#6750a4"; // [!code --]
const newAccent = "#0ea5e9"; // [!code ++]
console.warn("Contraste à vérifier"); // [!code warning]
```

{{< /shiki >}}

### Paramètres

| Paramètre            | Exemple                | Rôle                                                               |
| -------------------- | ---------------------- | ------------------------------------------------------------------ |
| `lang`               | `ts`                   | Langage Shiki si le bloc fenced n’en déclare pas.                  |
| `meta`               | `{2}`                  | Meta Shiki ajoutée au bloc, par exemple pour surligner des lignes. |
| `title`              | `Signal Angular`       | Titre visible au-dessus du bloc.                                   |
| `filename` ou `file` | `counter.component.ts` | Nom de fichier affiché à droite.                                   |
| `caption`            | `Exemple minimal`      | Légende sous le bloc.                                              |
| `icon`               | `terminal`             | Icône Material Symbol de l’en-tête.                                |

### Options Shiki activées

Les transformers Shiki sont chargés, mais ils ne changent rien tant que vous n’utilisez pas leurs
notations :

````markdown
```ts {1,3-4} /signal/
const count = signal(0);
count.set(1);
count.update((value) => value + 1);
```
````

```ts {1,3-4} /signal/
const count = signal(0);
count.set(1);
count.update((value) => value + 1);
```

Vous pouvez aussi annoter directement le code :

````markdown
```ts
const oldValue = 0; // [!code --]
const newValue = 1; // [!code ++]
console.warn("Attention"); // [!code warning]
console.error("Erreur"); // [!code error]
```
````

```ts
const oldValue = 0; // [!code --]
const newValue = 1; // [!code ++]
console.warn("Attention"); // [!code warning]
console.error("Erreur"); // [!code error]
```

Stress test avec un bloc volontairement long :

```asm
; x86_64 Linux/NASM - boucle de simulation volontairement longue pour tester le gutter, les lignes vides et le scroll horizontal. ; [!code info]
global _start
section .data
trace_banner db "render-wide-precode-stress: register lanes, branch table, diff markers and very long assembly comments stay aligned", 10
trace_banner_len equ $ - trace_banner
state_seed dq 0x9e3779b97f4a7c15
state_mask dq 0x0000ffffffffffff
dispatch_table dq stage_000, stage_001, stage_002, stage_003, stage_004, stage_005, stage_006, stage_007

section .bss
scratch resq 64
mirror resq 64

section .text
_start:
    mov rax, 1
    mov rdi, 1
    lea rsi, [rel trace_banner]
    mov rdx, trace_banner_len
    syscall

    xor r8, r8
    mov r9, [rel state_seed]
    lea r10, [rel scratch]
    lea r11, [rel mirror]
    mov r12, 0x0102030405060708
    mov r13, 0xfedcba9876543210
    mov r14, 0x13579bdf2468ace0
    mov r15, 0x0000000000000040

stage_000:
    mov rax, r9
    rol rax, 7
    xor rax, r12
    add rax, 0x0000000000000001
    mov [r10 + r8 * 8], rax
    mov [r11 + r8 * 8], r13
    cmp rax, r14
    cmova r13, rax
    inc r8
    and r8, 0x3f

stage_001:
    mov rbx, [r10 + r8 * 8]
    ror rbx, 11
    xor rbx, r9
    add rbx, 0x0000000000000101
    mov [r11 + r8 * 8], rbx
    test bl, 0x03
    cmovz r12, rbx
    lea r9, [rbx + r12 * 2 + 0x22]
    inc r8
    and r8, 0x3f

stage_002:
    mov rcx, [r11 + r8 * 8]
    shl rcx, 3
    xor rcx, r13
    add rcx, 0x0000000000000202
    mov [r10 + r8 * 8], rcx
    bt rcx, 17
    cmovc r14, rcx
    lea r13, [rcx + r14 + 0x3333333333333333]
    inc r8
    and r8, 0x3f

stage_003:
    mov rdx, [r10 + r8 * 8] ; [!code --]
    mov rdx, [r11 + r8 * 8] ; [!code ++]
    ror rdx, 19
    xor rdx, r12
    add rdx, 0x0000000000000303
    mov [r10 + r8 * 8], rdx
    mov [r11 + r8 * 8], r9
    cmp rdx, 0x7fffffffffffffff
    cmovbe r9, rdx
    inc r8
    and r8, 0x3f

stage_004:
    mov rax, [r11 + r8 * 8]
    rol rax, 23
    xor rax, r13
    add rax, 0x0000000000000404
    mov [r10 + r8 * 8], rax
    mov [r11 + r8 * 8], r12
    test ah, 0x80
    cmovnz r12, rax
    inc r8
    and r8, 0x3f

stage_005:
    mov rbx, [r10 + r8 * 8]
    shrd rbx, r13, 5
    xor rbx, r14
    add rbx, 0x0000000000000505
    mov [r11 + r8 * 8], rbx
    mov [r10 + r8 * 8], r15
    cmp rbx, r9
    cmovae r15, rbx
    inc r8
    and r8, 0x3f

stage_006:

    mov rcx, [r11 + r8 * 8]
    rol rcx, 31
    xor rcx, r15
    add rcx, 0x0000000000000606
    mov [r10 + r8 * 8], rcx
    mov [r11 + r8 * 8], r14
    test rcx, 0x000000000000ff00
    cmovnz r14, rcx
    inc r8
    and r8, 0x3f

stage_007:
    mov rdx, [r10 + r8 * 8]
    ror rdx, 37
    xor rdx, r9
    add rdx, 0x0000000000000707 ; [!code info]
    mov [r11 + r8 * 8], rdx
    mov [r10 + r8 * 8], r13
    cmp rdx, r12
    cmovb r12, rdx
    inc r8
    and r8, 0x3f

stage_008:
    mov rax, [r11 + r8 * 8]
    shld rax, r12, 9
    xor rax, r15
    add rax, 0x0000000000000808
    mov [r10 + r8 * 8], rax
    mov [r11 + r8 * 8], r9
    test al, 0x11
    cmovnz r9, rax
    inc r8
    and r8, 0x3f

stage_009:
    mov rbx, [r10 + r8 * 8]
    rol rbx, 41
    xor rbx, r13
    add rbx, 0x0000000000000909
    mov [r11 + r8 * 8], rbx
    mov qword [r10 + r8 * 8], 0x1111111111111111 ; [!code --]
    mov qword [r10 + r8 * 8], 0x2222222222222222 ; [!code ++]
    inc r8
    and r8, 0x3f

stage_010:
    mov rcx, [r11 + r8 * 8]
    ror rcx, 43
    xor rcx, r14
    add rcx, 0x0000000000001010
    mov [r10 + r8 * 8], rcx
    mov [r11 + r8 * 8], r15
    cmp rcx, rbx
    cmovne r15, rcx
    inc r8
    and r8, 0x3f

stage_011:
    mov rdx, [r10 + r8 * 8]
    rol rdx, 47
    xor rdx, r12
    add rdx, 0x0000000000001111
    mov [r11 + r8 * 8], rdx
    mov [r10 + r8 * 8], r9
    cmp rdx, r13
    cmovg r13, rdx
    inc r8
    and r8, 0x3f

stage_012:
    mov rax, [r11 + r8 * 8]
    ror rax, 53
    xor rax, r15
    add rax, 0x0000000000001212
    mov [r10 + r8 * 8], rax
    mov [r11 + r8 * 8], r14
    test rax, 0x000000ff00000000
    cmovnz r14, rax
    inc r8
    and r8, 0x3f

stage_013:
    mov rbx, [r10 + r8 * 8]
    rol rbx, 59
    xor rbx, r9
    add rbx, 0x0000000000001313
    mov [r11 + r8 * 8], rbx
    mov [r10 + r8 * 8], r12
    cmp rbx, r15
    cmova r15, rbx
    inc r8
    and r8, 0x3f

stage_014:
    mov rcx, [r11 + r8 * 8]
    ror rcx, 3
    xor rcx, r13
    add rcx, 0x0000000000001414
    mov [r10 + r8 * 8], rcx
    mov [r11 + r8 * 8], r9
    cmp rcx, r14
    cmovl r14, rcx
    inc r8
    and r8, 0x3f

stage_015:
    mov rdx, [r10 + r8 * 8]
    rol rdx, 13
    xor rdx, r12
    add rdx, 0x0000000000001515
    mov [r11 + r8 * 8], rdx
    mov [r10 + r8 * 8], r15
    cmp rdx, r9
    cmovae r9, rdx
    inc r8
    and r8, 0x3f

stage_016:
    mov rax, [r11 + r8 * 8]
    ror rax, 17
    xor rax, r14
    add rax, 0x0000000000001616
    mov [r10 + r8 * 8], rax
    mov [r11 + r8 * 8], r13
    test rax, 0x00000000000000f0
    cmovnz r13, rax
    inc r8
    and r8, 0x3f

stage_017:
    mov rbx, [r10 + r8 * 8]
    shld rbx, r9, 7
    xor rbx, r15
    add rbx, 0x0000000000001717
    mov [r11 + r8 * 8], rbx
    mov [r10 + r8 * 8], r12
    cmp rbx, r14
    cmovbe r14, rbx
    inc r8
    and r8, 0x3f

stage_018:
    mov rcx, [r11 + r8 * 8]
    shrd rcx, r13, 11
    xor rcx, r9
    add rcx, 0x0000000000001818
    mov [r10 + r8 * 8], rcx
    mov [r11 + r8 * 8], r15
    cmp rcx, r12
    cmovge r12, rcx
    inc r8
    and r8, 0x3f

stage_019:
    mov rdx, [r10 + r8 * 8]
    rol rdx, 29
    xor rdx, r14
    add rdx, 0x0000000000001919
    mov [r11 + r8 * 8], rdx
    mov [r10 + r8 * 8], r13
    cmp rdx, r15
    cmovb r15, rdx
    inc r8
    and r8, 0x3f

stage_020:
    mov rax, [r11 + r8 * 8]
    xor rax, r9
    xor rax, r12
    xor rax, r13
    xor rax, r14
    xor rax, r15
    mov [r10 + r8 * 8], rax
    mov rdi, rax
    call finalize_checksum_with_a_deliberately_long_symbol_name_to_force_horizontal_overflow_and_keep_the_copy_button_outside_the_text_column

finalize_checksum_with_a_deliberately_long_symbol_name_to_force_horizontal_overflow_and_keep_the_copy_button_outside_the_text_column:
    mov rax, rdi
    and rax, [rel state_mask]
    cmp rax, 0
    je exit_success
    jmp exit_success

exit_success:
    mov rax, 60
    xor rdi, rdi
    syscall
```

Les notations utiles sont :

| Notation                                           | Effet                                         |
| -------------------------------------------------- | --------------------------------------------- |
| `{1,3-4}` dans la meta                             | Surligne des lignes.                          |
| `/signal/` dans la meta                            | Surligne un mot.                              |
| `[!code ++]` / `[!code --]`                        | Marque une ligne ajoutée ou supprimée.        |
| `[!code highlight]`                                | Surligne une ligne.                           |
| `[!code focus]`                                    | Met une ligne au focus et atténue les autres. |
| `[!code warning]`, `[!code error]`, `[!code info]` | Marque une ligne par niveau.                  |
| `[!code word:signal]`                              | Surligne un mot dans les lignes suivantes.    |

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
