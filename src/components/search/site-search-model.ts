type SearchSortMode = "relevance" | "created-desc" | "title-asc";

export const SORT_OPTIONS: Array<{
  accessibleLabel: string;
  icon: string;
  label: string;
  value: SearchSortMode;
}> = [
  {
    accessibleLabel: "Trier par pertinence",
    icon: "\uE8B6",
    label: "Pertinence",
    value: "relevance",
  },
  {
    accessibleLabel: "Trier par date, du plus récent au plus ancien",
    icon: "\uE192",
    label: "Plus récents",
    value: "created-desc",
  },
  {
    accessibleLabel: "Trier par titre, de A à Z",
    icon: "\uE053",
    label: "Titre A–Z",
    value: "title-asc",
  },
];

export function isSearchSortMode(value: unknown): value is SearchSortMode {
  return SORT_OPTIONS.some((option) => option.value === value);
}
