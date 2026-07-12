import assert from "node:assert/strict";
import test from "node:test";

import { withDeterministicMaterialSourceColorRandom } from "../src/assets/js/app/material-source-color-random.js";

test("keeps the Material source-color random sequence deterministic", () => {
  const values = withDeterministicMaterialSourceColorRandom(() =>
    Array.from({ length: 6 }, Math.random),
  );

  assert.deepEqual(
    values,
    [
      0.0003297457005828619, 0.2232720274478197, 0.1462021479383111, 0.46732782293111086,
      0.5450490827206522, 0.6152513844426721,
    ],
  );
});

test("restores the native random generator when extraction fails", () => {
  const nativeRandom = Math.random;

  assert.throws(
    () =>
      withDeterministicMaterialSourceColorRandom(() => {
        throw new Error("expected_failure");
      }),
    /expected_failure/,
  );
  assert.equal(Math.random, nativeRandom);
});
