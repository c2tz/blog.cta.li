# ct-blog.cta.li

Ce dépôt contient le code source du blog statique
[ct-blog.cta.li](https://ct-blog.cta.li/). Le site est construit avec Astro, les articles sont écrits
en Markdown ou MDX et l'interface utilise Material Web.

## L'essentiel en une minute

- Il n'y a pas de base de données ni d'administration WordPress à maintenir.
- Un article est un fichier `.md` ou `.mdx` placé dans `src/content/blog`.
- Astro transforme le contenu et le code du site en fichiers statiques dans `dist`.
- En production, le navigateur reçoit ces fichiers statiques. Node.js et les outils de test ne sont
  pas exécutés pour chaque visiteur.
- Git fournit automatiquement la date de création et la dernière date de modification d'un
  article.
- GitHub Actions refait les principaux contrôles à chaque pull request et lors des pushes vers
  `develop` ou `main`.

## Démarrage rapide

Les versions de référence sont Node.js `22.22.3` et pnpm `11.1.3`. Volta peut les sélectionner
automatiquement à partir de `package.json`.

```sh
git clone https://github.com/c2tz/ct-blog.cta.li.git
cd ct-blog.cta.li
pnpm install --frozen-lockfile
pnpm dev
```

Ouvrez ensuite <http://localhost:4321/>. Arrêtez le serveur avec `Ctrl+C`.

Pour créer un brouillon :

```sh
pnpm new:post "Titre de mon article"
```

Pour créer un article immédiatement publiable :

```sh
pnpm new:post "Titre de mon article" --description "Résumé de l'article." --publish
```

Le guide complet est dans [Publier un article](docs/publier-un-article.md).

## Quelle commande utiliser ?

| Situation                                | Commande                | Résultat attendu                              |
| ---------------------------------------- | ----------------------- | --------------------------------------------- |
| Voir le site pendant une modification    | `pnpm dev`              | Serveur local sur le port 4321                |
| Créer un brouillon                       | `pnpm new:post "Titre"` | Nouveau fichier Markdown non listé            |
| Vérifier rapidement le code et les types | `pnpm check`            | Aucune erreur Astro ou TypeScript             |
| Construire la version statique           | `pnpm build`            | Dossier `dist` prêt à être prévisualisé       |
| Voir exactement le résultat construit    | `pnpm preview`          | Serveur local utilisant `dist`                |
| Reproduire le contrôle complet du projet | `pnpm verify`           | Tous les tests, navigateurs et audits passent |

`pnpm verify` est volontairement long. Pour une simple rédaction d'article, il est raisonnable de
lancer `pnpm build` localement et de laisser GitHub Actions refaire la matrice complète. Consultez
[Commandes et contrôles](docs/commandes-et-controles.md) avant de lancer ou de corriger une commande
que vous ne connaissez pas.

## Documentation

Commencez par les documents suivants :

1. [Guide du débutant](docs/guide-du-debutant.md) : vocabulaire, installation et organisation du
   dépôt.
2. [Publier un article](docs/publier-un-article.md) : brouillon, Markdown, images, dates Git et
   publication.
3. [Commandes et contrôles](docs/commandes-et-controles.md) : rôle de chaque script `pnpm`.
4. [GitHub Actions et déploiement](docs/github-actions-et-deploiement.md) : contrôles automatiques,
   Vercel et hébergement statique.
5. [Dépendances](docs/dependances.md) : pourquoi il y en a plusieurs et lesquelles arrivent dans le
   navigateur.
6. [Dépannage](docs/depannage.md) : solutions aux erreurs les plus courantes.

Références techniques pour les modifications plus avancées :

- [Architecture](docs/architecture.md)
- [Architecture du rendu et performances](docs/rendering-architecture.md)
- [En-têtes de sécurité](docs/security-headers.md)
- [Messages de commit](docs/commit-messages.md)
- [Vérification sur appareils physiques](docs/physical-device-qa.md)

## Branches et publication

Le travail normal cible `develop`. La branche `main` représente la version stable. Les règles GitHub
et les noms exacts de certains contrôles sont liés à ces deux branches : ne les renommez pas sans
mettre à jour les workflows et les rulesets ensemble.

Ne modifiez pas à la main :

- `dist`, car il est recréé par `pnpm build` ;
- `node_modules`, car il est recréé par `pnpm install` ;
- `src/assets/css/base/material-theme.generated.scss`, sauf via `pnpm theme:generate` ;
- les hachages CSP de `vercel.json`, sauf via `pnpm build && pnpm sync:headers`.

## Ce que les contrôles garantissent, et ce qu'ils ne garantissent pas

Les tests réduisent fortement les risques de régression : syntaxe, types, liens, contenu généré,
accessibilité automatisée, sécurité, recherche, interactions dans plusieurs navigateurs et budget
Lighthouse. Ils ne peuvent toutefois pas garantir « zéro bug » sur tous les téléphones, tous les
réseaux et toutes les futures versions de navigateur. Une vérification visuelle sur un vrai appareil
reste utile pour une modification d'interface importante.
