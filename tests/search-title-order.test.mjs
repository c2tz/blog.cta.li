import assert from "node:assert/strict";
import test from "node:test";
import { createTitleSortRanks } from "../src/lib/search-title-order.mjs";

test("orders accented French titles and numbers, with stable ties and no mutation", () => {
  const entries = [
    { id: "z", title: "Zèbre" },
    { id: "e10", title: "École 10" },
    { id: "e2-b", title: "école 2" },
    { id: "a", title: "abricot" },
    { id: "e2-a", title: "Ecole 2" },
  ];
  const before = structuredClone(entries);
  const ranks = createTitleSortRanks(entries);
  assert.deepEqual([...ranks.keys()], ["a", "e2-a", "e2-b", "e10", "z"]);
  assert.deepEqual([...ranks.values()], [1, 2, 3, 4, 5]);
  assert.deepEqual(createTitleSortRanks([...entries].reverse()), ranks);
  assert.deepEqual(entries, before);
});

test("supports an empty public corpus", () => {
  assert.equal(createTitleSortRanks([]).size, 0);
});
