import type { CookieConsentConfig } from 'vanilla-cookieconsent';

export const config: CookieConsentConfig = {
  root: '#cc-container',

  guiOptions: {
    consentModal: { layout: 'box inline', position: 'bottom left' },
    preferencesModal: { layout: 'box', position: 'right', equalWeightButtons: true }
  },

  categories: {
    necessary: { readOnly: true },
    functionality: {
      services: {
        ipgeo: {
          label: 'Widget IP (adresse et pays)'
        }
      }
    }
  },

  // Signale au site qu’un consentement a été donné/retiré
  onConsent: () => window.dispatchEvent(new CustomEvent('cc:change')),
  onChange: () => window.dispatchEvent(new CustomEvent('cc:change')),

  language: {
    default: 'fr',
    translations: {
      fr: {
        consentModal: {
          title: 'Gestion des cookies',
          description:
            'Nous utilisons des cookies pour améliorer votre expérience. '
            + 'L’appel à l’API IP est bloqué tant que vous ne l’autorisez pas.',
          acceptAllBtn: 'Tout accepter',
          acceptNecessaryBtn: 'Tout refuser',
          showPreferencesBtn: 'Personnaliser',
          footer: '<a href="/privacy">Politique de confidentialité</a>'
        },
        preferencesModal: {
          title: 'Centre de préférences',
          acceptAllBtn: 'Tout accepter',
          acceptNecessaryBtn: 'Tout refuser',
          savePreferencesBtn: 'Enregistrer',
          closeIconLabel: 'Fermer',
          sections: [
            {
              title: 'Cookies nécessaires',
              description: 'Indispensables au fonctionnement du site et toujours actifs.',
              linkedCategory: 'necessary'
            },
            {
              title: 'Fonctionnalités',
              description: 'Fonctionnalités optionnelles. L’API IP appartient à cette catégorie.',
              linkedCategory: 'functionality'
            }
          ]
        }
      }
    }
  }
};
