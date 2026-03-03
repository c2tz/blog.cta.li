// Widget IP contrôlé par CookieConsent (service "ipgeo" dans la catégorie "functionality").

declare global {
  interface Window {
    CookieConsent?: {
      getUserPreferences?: () => {
        acceptedServices?: Record<string, string[]>;
      };
      acceptService?: (services: string[] | string, category: string) => void;
    };
  }
}

function serviceAccepted(): boolean {
  const list = window.CookieConsent?.getUserPreferences?.().acceptedServices?.['functionality'] ?? [];
  return Array.isArray(list) && list.includes('ipgeo');
}

function syncVisibility() {
  const allowNote = document.querySelector<HTMLElement>('[data-ip-consent]');
  const valueWrap = document.querySelector<HTMLElement>('[data-ip-widget]');
  if (allowNote) allowNote.hidden = serviceAccepted();
  if (valueWrap) valueWrap.hidden = !serviceAccepted();
}

async function fetchIp() {
  const endpoint = 'https://ipapi.co/json/';
  const ipEl = document.getElementById('client-ip');
  const countryEl = document.getElementById('client-country');
  if (!ipEl || !countryEl) return;

  try {
    const cached = sessionStorage.getItem('ipgeo');
    if (cached) {
      const d = JSON.parse(cached);
      ipEl.textContent = d.ip ?? 'non détectée';
      countryEl.textContent = d.country_name ?? 'Pays inconnu';
      return;
    }

    const res = await fetch(endpoint, { credentials: 'omit' });
    const d = await res.json().catch(() => ({}));
    sessionStorage.setItem('ipgeo', JSON.stringify(d));

    ipEl.textContent = d.ip ?? 'non détectée';
    countryEl.textContent = d.country_name ?? 'Pays inconnu';
  } catch {
    ipEl.textContent = 'non détectée';
    countryEl.textContent = 'Pays inconnu';
  }
}

export function initIpWidget() {
  syncVisibility();

  document.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-ipgeo-accept]');
    if (btn) {
      window.CookieConsent?.acceptService?.(['ipgeo'], 'functionality');
      syncVisibility();
      if (serviceAccepted()) fetchIp();
    }
  });

  if (serviceAccepted()) fetchIp();
  document.addEventListener('visibilitychange', () => syncVisibility());
}
