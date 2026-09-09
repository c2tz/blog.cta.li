export const ARCHIVE_COUNTS = [0, 1, 11, 101] as const;

export function archivePosts(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, index + 1));
    return {
      createdIso: date.toISOString(),
      createdLabelCompact: date.toLocaleDateString("fr-FR", { timeZone: "UTC" }),
      createdLabelFull: date.toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "UTC" }),
      title: `Article ${String(count - index).padStart(3, "0")}`,
      url: "/posts/bienvenue-sur-ct-blog",
    };
  });
}
