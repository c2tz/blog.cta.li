import assert from "node:assert/strict";
import test from "node:test";

import {
  OPTIONAL_SERVICE_IDS,
  areAllOptionalServicesEnabled,
  countEnabledOptionalServices,
  createOptionalServices,
  createOptionalServicesConsent,
  normalizeOptionalServicesConsent,
  optionalServicesFromLegacyConsent,
} from "../src/lib/optional-services-consent.mjs";

test("creates and validates a granular optional-services consent payload", () => {
  const services = createOptionalServices(false);
  services.giscus = true;
  const state = createOptionalServicesConsent(services, "2026-07-22T00:00:00.000Z");

  assert.deepEqual(state, {
    services: { giscus: true, ipgeo: false, "speed-insights": false },
    updatedAt: "2026-07-22T00:00:00.000Z",
    version: 2,
  });
  assert.deepEqual(normalizeOptionalServicesConsent(state), state);
  assert.equal(countEnabledOptionalServices(state.services), 1);
  assert.equal(areAllOptionalServicesEnabled(state.services), false);
});

test("fails closed when an optional service is missing or malformed", () => {
  assert.equal(
    normalizeOptionalServicesConsent({
      services: { giscus: true, ipgeo: false },
      updatedAt: "2026-07-22T00:00:00.000Z",
      version: 2,
    }),
    null,
  );
  assert.equal(
    normalizeOptionalServicesConsent({
      services: Object.fromEntries(OPTIONAL_SERVICE_IDS.map((service) => [service, "true"])),
      updatedAt: "2026-07-22T00:00:00.000Z",
      version: 2,
    }),
    null,
  );
});

test("migrates a v1 global decision to the three individual services", () => {
  assert.deepEqual(optionalServicesFromLegacyConsent({ functionality: true, version: 1 }), {
    giscus: true,
    ipgeo: true,
    "speed-insights": true,
  });
  assert.deepEqual(optionalServicesFromLegacyConsent({ functionality: false, version: 1 }), {
    giscus: false,
    ipgeo: false,
    "speed-insights": false,
  });
  assert.equal(optionalServicesFromLegacyConsent({ functionality: true, version: 2 }), null);
});
