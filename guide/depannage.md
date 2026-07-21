# Dépannage

Commencez toujours par lire la première erreur et par vérifier que le terminal se trouve à la racine
du dépôt :

```sh
pwd
git status
node --version
pnpm --version
```

Les versions de référence sont Node.js `22.22.3` et pnpm `11.1.3`.

## `pnpm` est introuvable

Installez pnpm avec l'outil choisi pour votre environnement, ou utilisez Volta. Fermez et rouvrez le
terminal, puis vérifiez :

```sh
pnpm --version
```

La version attendue est indiquée dans `package.json` sous `packageManager` et `volta`.

## L'installation échoue avec le lockfile

Vérifiez d'abord que vous êtes sur le bon commit et que `package.json` et `pnpm-lock.yaml` ne sont pas
partiellement modifiés :

```sh
git status
git diff -- package.json pnpm-lock.yaml
```

N'utilisez pas une régénération du lockfile comme première réponse à une erreur réseau. Réessayez
après avoir confirmé la connexion et le registre. Si le projet a volontairement changé ses
dépendances, exécutez `pnpm install`, examinez le diff du lockfile, puis commitez-le avec
`package.json`.

## Le port 4321 est déjà utilisé

Un ancien serveur de développement est probablement encore actif. Revenez à son terminal et pressez
`Ctrl+C`. Si vous ne savez pas quel processus écoute, recherchez le port avec un outil système comme
`lsof`, puis arrêtez uniquement le processus identifié.

Ne modifiez pas le port dans la configuration du projet uniquement pour contourner un serveur oublié.

## Le navigateur affiche une ancienne version

Vérifiez dans cet ordre :

1. que le terminal `pnpm dev` appartient au bon dossier et à la bonne branche ;
2. que l'URL et le port sont ceux affichés dans ce terminal ;
3. que le fichier a été enregistré ;
4. que le navigateur n'affiche pas une ancienne preview ;
5. que le service worker ou le cache n'intervient pas, puis rechargez sans cache si nécessaire.

Pour voir la version construite, arrêtez `dev`, puis lancez :

```sh
pnpm build
pnpm preview
```

## Mon brouillon n'apparaît pas sur le site

C'est normal si son frontmatter contient :

```yaml
listed: false
```

Ouvrez son URL directe `/posts/<nom-du-fichier>/`. Pour le publier, ajoutez une description et passez
`listed` à `true`, puis reconstruisez.

## Une date d'article est incorrecte

Les dates viennent de l'historique Git. Vérifiez :

```sh
git log --follow -- src/content/blog/nom-de-l-article.md
```

Un fichier non commité, un clone peu profond ou un historique incomplet peut provoquer l'utilisation
temporaire des dates du système de fichiers. Commitez l'article et utilisez un checkout avec
l'historique complet pour le build de production.

## `pnpm build` signale un lien ou une ancre manquante

Lisez le chemin mentionné par `check:content`. Vérifiez :

- la casse exacte du nom de fichier ;
- le `/` final des routes du site ;
- le texte transformé en identifiant pour un titre Markdown ;
- le chemin relatif d'une image ;
- que la ressource est bien suivie par Git.

Ne désactivez pas le contrôle pour publier un lien cassé.

## Les hachages de sécurité sont obsolètes

Après une modification d'un script inline ou du HTML concerné par la CSP :

```sh
pnpm build
pnpm sync:headers
pnpm check:headers
git diff -- vercel.json
```

Committez le changement de `vercel.json` seulement s'il correspond à la modification attendue. Ne
copiez pas un hachage provenant d'un autre build.

## Prettier échoue

Pour les fichiers modifiés :

```sh
pnpm format
pnpm format:check
```

Examinez le diff avant de committer. `pnpm format:all` reformate tout le dépôt et n'est normalement
pas nécessaire.

## ESLint échoue

Essayez :

```sh
pnpm lint:fix
pnpm lint
```

Les erreurs restantes nécessitent une correction comprise. N'ajoutez pas une désactivation globale
d'ESLint pour masquer une seule erreur.

## Knip signale un élément inutilisé

Recherchez d'abord les usages dynamiques, les scripts et les workflows. Si l'élément est réellement
inutile, supprimez-le avec ses tests et sa dépendance. S'il est volontairement chargé d'une manière
que Knip ne peut pas voir, documentez l'exception dans `knip.json`.

## Playwright échoue

Vérifiez qu'aucun ancien serveur n'occupe le port 4322. Relancez le test précis mentionné dans le
rapport plutôt que toute la matrice, par exemple :

```sh
pnpm exec playwright test tests/e2e/site-search.spec.ts
```

Consultez `test-results` pour les captures et traces. Un sélecteur trop rapide, un mauvais worktree
servi ou une fonctionnalité chargée après l'interaction peuvent produire un échec qui doit être
reproduit dans le navigateur avant de modifier le code.

## Lighthouse n'atteint pas le seuil

Une seule mesure locale peut varier. La configuration officielle exécute trois passages et utilise
le résultat pessimiste. Vérifiez :

- qu'aucune autre tâche lourde ne monopolise la machine ;
- que le build est à jour ;
- la ressource ou le script indiqué par le rapport ;
- si l'échec se reproduit dans GitHub Actions.

Ne réduisez pas automatiquement le seuil pour faire passer une régression. Les seuils sont un contrat
du projet : 95 en performance, 100 en accessibilité et 100 en bonnes pratiques.

## GitHub Actions reste rouge après une correction

Confirmez que la correction est bien committée et poussée sur la branche de la pull request. Ouvrez
le dernier run associé au dernier commit. Une ancienne exécution peut avoir été annulée par le
nouveau push.

Si le workflow échoue seulement sur GitHub, comparez les versions Node/pnpm, les variables, l'accès
réseau et l'historique Git. GitHub installe avec `pnpm install --frozen-lockfile`, donc un lockfile
non synchronisé est une cause fréquente.

## Vercel est déployé mais le site n'a pas changé

Vérifiez séparément :

1. le commit déployé par Vercel ;
2. l'environnement Preview ou Production ;
3. l'alias du domaine ;
4. le journal de `pnpm build:vercel` ;
5. le cache du document et des ressources ;
6. le smoke test de l'URL publique.

Un workflow GitHub vert ne garantit pas que l'alias de production pointe déjà vers ce déploiement.

## Le déploiement Synology affiche des 404

Vérifiez que vous avez copié le **contenu** de `dist`, pas le dossier source du dépôt. Configurez le
serveur pour les routes avec répertoires et `index.html`, et testez aussi le vrai statut de
`404.html`. Vérifiez les types MIME et les permissions de lecture.

## Quand demander de l'aide

Fournissez au minimum :

- la commande exacte ;
- la première erreur complète ;
- la branche et le commit ;
- `node --version` et `pnpm --version` ;
- les fichiers volontairement modifiés ;
- si le problème est local, GitHub Actions, Vercel ou Synology ;
- pour un bug visuel, le navigateur, l'appareil, l'URL et une capture.

Ces informations permettent de diagnostiquer la cause sans deviner ni supprimer des protections
utiles.
