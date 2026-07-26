import assert from "node:assert/strict";
import test from "node:test";

import { loadMaterialCustomElements } from "../src/assets/js/app/material-custom-elements.js";

function createRegistry(initialTagNames = []) {
  const definitions = new Map(initialTagNames.map((tagName) => [tagName, class {}]));
  const waiters = new Map();

  return {
    define(tagName, definition) {
      definitions.set(tagName, definition);
      waiters.get(tagName)?.();
    },
    get: (tagName) => definitions.get(tagName),
    whenDefined(tagName) {
      if (definitions.has(tagName)) return Promise.resolve(definitions.get(tagName));
      return new Promise((resolve) => {
        waiters.set(tagName, resolve);
      });
    },
  };
}

test("skips a Material module when all of its custom elements already exist", async () => {
  const registry = createRegistry(["md-dialog", "md-filled-text-field"]);
  let loadCount = 0;

  await loadMaterialCustomElements({
    load: async () => {
      loadCount += 1;
    },
    registry,
    tagNames: ["md-dialog", "md-filled-text-field"],
  });

  assert.equal(loadCount, 0);
});

test("loads a Material module and waits for every requested definition", async () => {
  const registry = createRegistry();

  await loadMaterialCustomElements({
    load: async () => {
      registry.define("md-dialog", class {});
      registry.define("md-filled-text-field", class {});
    },
    registry,
    tagNames: ["md-dialog", "md-filled-text-field"],
  });

  assert.ok(registry.get("md-dialog"));
  assert.ok(registry.get("md-filled-text-field"));
});

test("accepts a competing duplicate registration only after all tags exist", async () => {
  const registry = createRegistry();
  const duplicateRegistration = new Error(
    "Cannot define multiple custom elements with the same tag name",
  );
  duplicateRegistration.name = "NotSupportedError";

  await loadMaterialCustomElements({
    load: async () => {
      registry.define("md-dialog", class {});
      registry.define("md-filled-text-field", class {});
      throw duplicateRegistration;
    },
    registry,
    tagNames: ["md-dialog", "md-filled-text-field"],
  });
});

test("preserves a duplicate-registration failure when a required tag is absent", async () => {
  const registry = createRegistry(["md-dialog"]);
  const duplicateRegistration = new Error(
    "Cannot define multiple custom elements with the same tag name",
  );
  duplicateRegistration.name = "NotSupportedError";

  await assert.rejects(
    loadMaterialCustomElements({
      load: async () => {
        throw duplicateRegistration;
      },
      registry,
      tagNames: ["md-dialog", "md-filled-text-field"],
    }),
    duplicateRegistration,
  );
});
