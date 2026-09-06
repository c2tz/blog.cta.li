# Navigation au clavier

Le contour de focus indique le contrôle qui reçoit les actions du clavier. Les composants
Material conservent leur anneau officiel ; les boutons de tri natifs ont un contour intérieur
pour rester visibles dans les tableaux.

- `Tab` passe au contrôle suivant, `Maj + Tab` revient au précédent.
- Sur les liens et les boutons de la page, `Bas` ou `Droite` passe au contrôle suivant et
  `Haut` ou `Gauche` revient au précédent, dans l’ordre du document. Ce parcours traverse les
  sections, les services cookies, le bandeau de consentement et le pied de page. Les contrôles
  masqués ou désactivés sont ignorés. `Début` et `Fin` restent limités au groupe d’actions courant.
- Les champs de saisie, menus, onglets, filtres Material et autres contrôles qui utilisent déjà
  les flèches gardent leur comportement habituel. Utilisez `Tab` pour les quitter.
- `Entrée` ou `Espace` active un bouton. Déplacer le focus ne change aucun choix.
- Sur le bouton de thème, les flèches haut/bas ouvrent le menu. Elles permettent ensuite de
  parcourir ses options, y compris la couleur dynamique lorsqu’elle est disponible.
- `Échap` ferme la recherche ou le menu de thème et restitue le focus à son bouton d’ouverture.
- Les dialogues conservent le parcours dans leurs limites. Après validation de l’avertissement
  au clavier, le focus passe au bandeau cookies. Après un choix dans ce bandeau, il revient au
  contenu principal. Le bandeau cookies reste non modal : on peut le quitter avec les flèches.
- Un tableau devient lui-même un arrêt de tabulation uniquement lorsqu’il déborde
  horizontalement. Ses flèches permettent alors de faire défiler le contenu. Les boutons de tri
  et les liens des articles restent accessibles.

## Animations

Les animations sont désactivées par défaut sur toutes les pages. Le bouton **Animations**,
juste après la recherche, les active ou les désactive avec `Entrée`, `Espace` ou un clic. Son
état pressé indique qu’elles sont actives et le choix est mémorisé pour les pages suivantes.
Le mode simple/détaillé conserve uniquement son rôle d’affichage et ne change pas ce réglage.

## Safari sur Mac

Safari peut réserver `Tab` aux champs et ignorer les boutons ou les liens. Dans
**Safari → Réglages → Avancés**, activez **Appuyer sur Tab pour mettre en surbrillance chaque
élément d’une page web**. Vérifiez aussi **Réglages Système → Clavier → Navigation au clavier**.
`Option + Tab` permet d’utiliser le parcours étendu prévu par Safari.

Ces réglages appartiennent au navigateur et au système. Le site respecte leur comportement et
ne remplace pas globalement la touche `Tab`.

Référence : [raccourcis Safari documentés par Apple](https://support.apple.com/fr-fr/guide/safari/cpsh003/mac).

## Vérifications

Les scénarios de `tests/e2e/site-navigation.spec.ts` couvrent le retour de focus après la recherche,
le passage souris/clavier, les boutons de cookies, les actions désactivées, la couleur dynamique
et le redimensionnement des tableaux. WebKit utilise `Option + Tab` pour vérifier le parcours
complet sans modifier les préférences Safari de la machine.
