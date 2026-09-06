---
title: "Shortcodes Astro et Material Web"
description: "Les shortcodes du site qui invoquent de vrais composants Material 3 et leurs réglages utiles."
listed: false
tags:
  - documentation
  - shortcodes
  - material
---

Les shortcodes de ce site ne remplacent pas le Markdown. Ils servent à invoquer un composant
Material 3 quand le Markdown natif ne suffit pas. `admonition` reste l’exception éditoriale voulue
par le site. Les variantes exposées reprennent les réglages utiles, sans badges de version ni
composants en doublon.

## Admonitions

Une admonition accepte du Markdown, une icône personnalisée et un mode repliable. Les types
canoniques sont `note`, `abstract`, `info`, `tip`, `success`, `question`, `warning`, `failure`,
`danger`, `bug`, `example` et `quote`. Les alias de types habituels comme `important`, `caution`,
`error` ou `cite` restent disponibles.

{{< admonition type="info" title="Toutes les admonitions" collapsible=true open=true >}}

{{< admonition type="note" >}}

Une note pour ajouter un détail utile.

{{< /admonition >}}

{{< admonition type="abstract" >}}

Un résumé synthétique du contenu.

{{< /admonition >}}

{{< admonition type="info" >}}

Une information à connaître avant de continuer.

{{< /admonition >}}

{{< admonition type="tip" >}}

Une astuce ou une recommandation pratique.

{{< /admonition >}}

{{< admonition type="success" >}}

Une action terminée avec succès.

{{< /admonition >}}

{{< admonition type="question" >}}

Une question, une aide ou une FAQ.

{{< /admonition >}}

{{< admonition type="warning" >}}

Un avertissement qui demande de l’attention.

{{< /admonition >}}

{{< admonition type="failure" >}}

Un échec ou un élément manquant.

{{< /admonition >}}

{{< admonition type="danger" >}}

Un danger ou une erreur importante.

{{< /admonition >}}

{{< admonition type="bug" >}}

Un comportement incorrect ou un bug connu.

{{< /admonition >}}

{{< admonition type="example" >}}

Un exemple concret à reproduire.

{{< /admonition >}}

{{< admonition type="quote" >}}

Une citation ou une référence contextuelle.

{{< /admonition >}}

{{< /admonition >}}

## Boutons

Les cinq variantes de bouton Material Web sont disponibles. Le libellé peut contenir du Markdown
inline et l’icône reste optionnelle.

{{< button href="/tags/all/" variant="filled" icon="search" >}}

Bouton rempli

{{< /button >}}

{{< button href="/tags/all/" variant="tonal" icon="article" >}}

Bouton tonal

{{< /button >}}

{{< button href="/tags/all/" variant="outlined" >}}

Bouton contour

{{< /button >}}

{{< button href="/tags/all/" variant="text" >}}

Bouton texte

{{< /button >}}

{{< button href="/tags/all/" variant="elevated" >}}

Bouton élevé

{{< /button >}}

## Icônes

Une icône inline suit la taille et la couleur du texte : {{< icon name="info" label="Information" />}}
aucun composant supplémentaire n’est créé autour d’elle.

## Progression

Le shortcode `progress` produit directement un `md-linear-progress`. Il accepte une valeur
déterminée, un tampon et le mode indéterminé à quatre couleurs.

{{< progress label="Importation" value=65 buffer=85 max=100 />}}

{{< progress label="Recherche en cours" indeterminate=true fourColor=true />}}

```markdown
{{< progress label="Importation" value=65 buffer=85 max=100 />}}
{{< progress label="Recherche en cours" indeterminate=true fourColor=true />}}
```

## Onglets

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

## Rich tooltip

Un rich tooltip accepte du Markdown, une image, un tooltip natif, du code Shiki avec ses lignes,
des boutons, une progression, des onglets et un tableau Material. Son contenu peut recevoir le
focus. En revanche, il ne peut pas invoquer un autre rich tooltip.

{{< rich-tooltip-ref id="tooltip-http-shiki" label="Voir l’exemple riche" />}}

{{< rich-tooltip id="tooltip-http-shiki" title="Exemple complet" >}}

Une requête <abbr title="Hypertext Transfer Protocol">HTTP</abbr> avec une image :

![konachan-382339.jpg](./images/konachan-382339.jpg)

{{< admonition type="tip" title="Compatible" >}}

Les admonitions sont également rendues dans le rich tooltip.

{{< /admonition >}}

```ts {2}
const endpoint = "/api/articles";
const response = await fetch(endpoint);
const articles = await response.json();
```

{{< progress label="Chargement de l’exemple" value=72 buffer=90 />}}

{{< button href="/tags/all/" variant="tonal" icon="article" >}}

Voir les articles

{{< /button >}}

{{< tabs label="Format de réponse" >}}
{{< tab title="JSON" >}}

```json
{ "ok": true }
```

{{< /tab >}}
{{< tab title="Texte" >}}

Réponse lisible.

{{< /tab >}}
{{< /tabs >}}

{{< material-table sort=true paginate=false >}}

| Champ    | Type     |
| -------- | -------- |
| `title`  | `string` |
| `status` | `number` |

{{< /material-table >}}

{{< /rich-tooltip >}}

## Tableau Material

Le Markdown produit le tableau sémantique. `material-table` ajoute les contrôles Material de tri,
filtrage et pagination sans créer une seconde syntaxe de tableau.

{{< material-table filter=true sort=true paginate=true pageSize=5 >}}

| Composant        | Type            | Interactif |
| ---------------- | --------------- | ---------- |
| Bouton rempli    | Material Web    | Oui        |
| Bouton tonal     | Material Web    | Oui        |
| Bouton contour   | Material Web    | Oui        |
| Barre de progrès | Material Web    | Oui        |
| Onglets          | Material Web    | Oui        |
| Tableau          | HTML sémantique | Oui        |
| Rich tooltip     | HTML sémantique | Oui        |

{{< /material-table >}}

## Images Markdown

Une image d’article reste du Markdown standard et conserve la preview du site.

![konachan-382339.jpg](./images/konachan-382339.jpg)

## Liste disponible

Les seuls shortcodes reconnus sont `admonition`, `button`, `icon`, `progress`, `tabs`, `tab`,
`material-table`, `rich-tooltip` et `rich-tooltip-ref`. Les citations, notes de bas de page,
abréviations, images, blocs de code et tableaux simples restent du Markdown ou du HTML natif.
