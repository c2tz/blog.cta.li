import assert from "node:assert/strict";
import test from "node:test";

import {
  firstNormalizedValue,
  parseJsonValue,
  parseVersionedState,
  readCookieValue,
  serializeCookie,
} from "../src/assets/js/app/site-persistence.js";

test("readCookieValue matches exact encoded names and decodes values", () => {
  const header = "other=ignored; home-detail-view=detailed%20mode; malformed=%E0%A4%A";

  assert.equal(readCookieValue(header, "home-detail-view"), "detailed mode");
  assert.equal(readCookieValue(header, "detail-view"), null);
  assert.equal(readCookieValue(header, "malformed"), null);
  assert.equal(readCookieValue(header, ""), null);
});

test("serializeCookie keeps the shared persistence contract", () => {
  assert.equal(
    serializeCookie("home detail", "true"),
    "home%20detail=true; Max-Age=31536000; Path=/; SameSite=Lax",
  );
  assert.equal(
    serializeCookie("legacy", "", { maxAgeSeconds: 0 }),
    "legacy=; Max-Age=0; Path=/; SameSite=Lax",
  );
});

test("parseJsonValue and firstNormalizedValue fail closed", () => {
  assert.deepEqual(parseJsonValue('{"version":1}'), { version: 1 });
  assert.equal(parseJsonValue("{"), null);
  assert.equal(parseJsonValue(null), null);
  assert.deepEqual(parseVersionedState('{"version":1,"enabled":true}'), {
    enabled: true,
    version: 1,
  });
  assert.equal(parseVersionedState('{"version":2}', 1), null);
  assert.equal(parseVersionedState("[]"), null);

  const normalize = (value) => (value === "true" ? true : value === "false" ? false : null);
  assert.equal(firstNormalizedValue(["unknown", "false", "true"], normalize, true), false);
  assert.equal(firstNormalizedValue(["unknown"], normalize, false), false);
});
