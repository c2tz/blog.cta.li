/** @param {readonly { id: string, title: string }[]} entries */
export function createTitleSortRanks(entries) {
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
  const ordered = [...entries].sort(
    (left, right) =>
      collator.compare(left.title, right.title) || left.id.localeCompare(right.id, "en"),
  );
  return new Map(ordered.map((entry, index) => [entry.id, index + 1]));
}
