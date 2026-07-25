# Validation CI adaptée aux changements

Les workflows obligatoires classent chaque pull request dans une lane déterministe. Le
classificateur utilise les SHA `pull_request.base.sha` et `pull_request.head.sha` fournis par
GitHub, puis inspecte le diff Git complet entre leur base de fusion et la tête de la pull request.
Il ne compare jamais une pull request à une branche locale supposée.

## Lanes

| Lane         | Chemins admis                                                                                             | Validation                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `docs`       | `guide/**`, documents racine connus et documentation/templates Markdown GitHub                            | Diff/Prettier des documents modifiés et titre de pull request                             |
| `content`    | `LICENSE*` et fichiers Markdown/MDX sous `src/content/**`                                                 | Formatage, tests unitaires, build/Pagefind, CSP/headers et smoke Chromium ciblé           |
| `post-merge` | Push d’un unique commit de merge dont la PR et les cinq checks verts sont prouvés par GitHub              | Publication rapide des cinq statuts sans répéter les validations déjà réussies            |
| `full`       | Code, styles, dépendances, configuration, workflows, rulesets, scripts, tests, assets et chemins inconnus | Suite qualité et Playwright actuelle, Lighthouse, validation CSP complète et vraie CodeQL |

La priorité est `full` > `content` > `docs`. Les deux chemins d’un renommage sont classés et une
suppression conserve la classe de son ancien chemin. Un chemin inconnu, un ensemble vide, un SHA
manquant ou nul, un historique incomplet et toute erreur de diff basculent vers `full`.

Les événements planifiés et manuels sont toujours complets. Un push direct, forcé, multiple ou
ambigu reste également en `full`, même si son message ressemble à un merge.

## Checks requis

Les rulesets de `develop` et `main` exigent exactement :

1. `Analyze (javascript-typescript)`
2. `Build and sync security header hashes`
3. `Check Astro, Material Web, and security headers`
4. `Lighthouse 95+ performance (mobile and desktop, no SEO)`
5. `Validate pull request title`

Chaque job requis est créé pour chaque pull request et push protégé. Une lane légère saute
uniquement ses étapes lourdes à l’intérieur du job, explique ce choix dans le résumé GitHub et
termine normalement. Aucun workflow requis n’utilise `paths-ignore`.

## Preuve `post-merge`

Le message du commit n’est jamais utilisé comme preuve. Le fast-path exige cumulativement :

1. un push non forcé sur `develop` ou `main`, avec `before` et `after` complets ;
2. `before` comme premier parent direct de `after` et un intervalle Git de premier parent contenant
   exactement le commit `after` ;
3. une unique pull request renvoyée par `GET /commits/{after}/pulls`, fermée et fusionnée vers la
   branche poussée, avec `base.sha === before` et `merge_commit_sha === after` ;
4. une réponse non paginée de `GET /commits/{head_sha}/check-runs` ;
5. exactement une exécution terminée avec succès pour chacun des cinq noms requis.

Les workflows accordent uniquement `pull-requests: read` et `checks: read` à cette preuve. Le jeton
GitHub est passé comme entrée masquée à l’action locale et n’est jamais journalisé. Une API
indisponible, une pagination, plusieurs associations, un check absent/dupliqué/rouge ou toute donnée
incomplète rebascule en `full`.

## Validation locale

Le classificateur et l’alignement statique des checks sont couverts par :

```sh
node --test tests/classify-ci-lane.test.mjs
```

La suite simule notamment documentation, article, licence, code, workflow, dépendances, mélange,
renommage, suppression, merge prouvé, push direct, faux merge, API indisponible, check absent ou
rouge, push multiple/forcé, SHA absent et historique indisponible.
