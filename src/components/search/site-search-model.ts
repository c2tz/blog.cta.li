type SearchSortMode = "relevance" | "created-desc" | "title-asc";

export const SORT_OPTIONS: Array<{ label: string; value: SearchSortMode }> = [
  { label: "Pertinence", value: "relevance" },
  { label: "Récent", value: "created-desc" },
  { label: "Nom", value: "title-asc" },
];

export function isSearchSortMode(value: unknown): value is SearchSortMode {
  return SORT_OPTIONS.some((option) => option.value === value);
}
