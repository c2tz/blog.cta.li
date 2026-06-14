// public/cookieconsent-config.js
// Charge la librairie depuis le CDN (UMD) puis initialise la configuration.
import 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.1.0/dist/cookieconsent.umd.js';

CookieConsent.run({
  guiOptions: {
    consentModal: {
      layout: "box",
      position: "middle center",
      equalWeightButtons: false,
      flipButtons: false
    },
    preferencesModal: {
      layout: "box",
      position: "middle center",
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
          title: "CRAFT OF UI – PRO UPGRADE",
          description:
            "You are one step away from unlocking Pro features and content. Your subscription will be updated in the next billing cycle. You will not be charged for this cycle.<br><br>Do you want to proceed?",
          acceptAllBtn: "Proceed",
          acceptNecessaryBtn: "Cancel",
          showPreferencesBtn: "Preferences",
          footer:
            "<span>Proceed accepte les cookies optionnels. Cancel garde uniquement le nécessaire.</span>"
        },
        preferencesModal: {
          title: "Cookie control",
          acceptAllBtn: "Proceed",
          acceptNecessaryBtn: "Cancel",
          savePreferencesBtn: "Save choices",
          closeIconLabel: "Fermer la modale",
          serviceCounterLabel: "Services",
          sections: [
            {
              title: "Utilisation des cookies",
              description:
                "Tu peux choisir les fonctions optionnelles que le site est autorisé à activer."
            },
            {
              title:
                "Cookies strictement nécessaires <span class=\"pm__badge\">Toujours actif</span>",
              description:
                "Ils servent au fonctionnement de base du site et ne peuvent pas être désactivés.",
              linkedCategory: "necessary"
            },
            {
              title: "Fonctionnalités",
              description:
                "Active les fonctions optionnelles, comme le widget IP affiché dans le footer.",
              linkedCategory: "functionality"
            },
            {
              title: "Analytique",
              description:
                "Réserve pour de futures mesures anonymisées de fréquentation. Rien n'est activé tant que cette catégorie reste refusée.",
              linkedCategory: "analytics"
            },
            {
              title: "Plus d'informations",
              description:
                "Pour une question liée aux cookies, tu peux écrire à <a class=\"cc__link\" href=\"mailto:contact@cta.li\">contact@cta.li</a>."
            }
          ]
        }
      }
    }
  }
});
