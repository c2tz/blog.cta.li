export const OPTIONAL_SERVICE_IDS = Object.freeze(["giscus", "ipgeo", "speed-insights"]);
export const OPTIONAL_SERVICES_CONSENT_VERSION = 2;

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function createOptionalServices(enabled = false) {
  return Object.fromEntries(OPTIONAL_SERVICE_IDS.map((service) => [service, Boolean(enabled)]));
}

function normalizeOptionalServices(value) {
  if (!isRecord(value)) return null;

  const services = {};
  for (const service of OPTIONAL_SERVICE_IDS) {
    if (typeof value[service] !== "boolean") return null;
    services[service] = value[service];
  }

  return services;
}

export function createOptionalServicesConsent(services, updatedAt = new Date().toISOString()) {
  const normalizedServices = normalizeOptionalServices(services);
  if (!normalizedServices) return null;

  return {
    services: normalizedServices,
    updatedAt,
    version: OPTIONAL_SERVICES_CONSENT_VERSION,
  };
}

export function normalizeOptionalServicesConsent(value) {
  if (!isRecord(value) || value.version !== OPTIONAL_SERVICES_CONSENT_VERSION) return null;
  if (typeof value.updatedAt !== "string" || !value.updatedAt) return null;

  return createOptionalServicesConsent(value.services, value.updatedAt);
}

export function optionalServicesFromLegacyConsent(value) {
  if (!isRecord(value) || value.version !== 1 || typeof value.functionality !== "boolean") {
    return null;
  }

  return createOptionalServices(value.functionality);
}

export function countEnabledOptionalServices(services) {
  const normalizedServices = normalizeOptionalServices(services);
  if (!normalizedServices) return 0;

  return OPTIONAL_SERVICE_IDS.filter((service) => normalizedServices[service]).length;
}

export function areAllOptionalServicesEnabled(services) {
  return countEnabledOptionalServices(services) === OPTIONAL_SERVICE_IDS.length;
}
