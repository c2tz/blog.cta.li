export type SearchSortMode = "relevance" | "created-desc" | "title-asc";

export interface SearchResult {
  createdAt?: string;
  createdLabel?: string;
  excerpt: string;
  modifiedAt?: string;
  modifiedLabel?: string;
  priority: number;
  score: number;
  tags: string[];
  title: string;
  titleHtml: string;
  url: string;
}

export interface TagFilter {
  count: number;
  value: string;
}

export const SORT_OPTIONS: Array<{ label: string; value: SearchSortMode }> = [
  { label: "Pertinence", value: "relevance" },
  { label: "Récent", value: "created-desc" },
  { label: "Nom", value: "title-asc" },
];

export function isSearchSortMode(value: unknown): value is SearchSortMode {
  return SORT_OPTIONS.some((option) => option.value === value);
}
