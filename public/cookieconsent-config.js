// public/cookieconsent-config.js
// Charge la librairie depuis le CDN (UMD) puis initialise la configuration.
import 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.1.0/dist/cookieconsent.umd.js';

CookieConsent.run({
  guiOptions: {
    consentModal: {
      layout: "cloud inline",
      position: "bottom center",
      equalWeightButtons: true,
      flipButtons: false
    },
    preferencesModal: {
      layout: "box",
      position: "left",
      equalWeightButtons: true,
      flipButtons: false
    }
  },

  // Empêche l'interaction avec la page tant que le choix n'est pas exprimé
  disablePageInteraction: true,

 // extrait pertinent
categories: {
  necessary: { readOnly: true },
  functionality: {
    services: {
      ipgeo: { label: "Widget IP (adresse + pays)" }
    }
  },
  analytics: {}
},
// Optionnel (redondant avec les events natifs), mais utile si tu veux forcer un signal custom :
onConsent: () => document.dispatchEvent(new Event('cc:onConsent')),
onChange:  () => document.dispatchEvent(new Event('cc:onChange')),


  // Texte et langue
  language: {
    default: "fr",
    autoDetect: "browser",
    translations: {
      fr: {
        consentModal: {
          title: "Bonjour voyageur, c'est l'heure des cookies!",
          description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.",
          acceptAllBtn: "Tout accepter",
          acceptNecessaryBtn: "Tout rejeter",
          showPreferencesBtn: "Gérer les préférences",
          footer:
            "<a href=\"#link\">Politique de confidentialité</a>\n<a href=\"#link\">Termes et conditions</a>"
        },
        preferencesModal: {
          title: "Préférences de cookies",
          acceptAllBtn: "Tout accepter",
          acceptNecessaryBtn: "Tout rejeter",
          savePreferencesBtn: "Sauvegarder les préférences",
          closeIconLabel: "Fermer la modale",
          serviceCounterLabel: "Services",
          sections: [
            {
              title: "Utilisation des Cookies",
              description:
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
            },
            {
              title:
                "Cookies Strictement Nécessaires <span class=\"pm__badge\">Toujours Activé</span>",
              description:
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
              linkedCategory: "necessary"
            },
            {
              title: "Cookies de Fonctionnalités",
              description:
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
              linkedCategory: "functionality"
            },
            {
              title: "Cookies Analytiques",
              description:
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
              linkedCategory: "analytics"
            },
            {
              title: "Plus d'informations",
              description:
                "For any query in relation to my policy on cookies and your choices, please <a class=\"cc__link\" href=\"#yourdomain.com\">contact me</a>."
            }
          ]
        }
      }
    }
  }
});
