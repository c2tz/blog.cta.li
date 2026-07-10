export function materialControlValue(event: Event) {
  const candidates = [event.composedPath()[0], event.target, event.currentTarget];

  for (const candidate of candidates) {
    const value = (candidate as { value?: unknown } | null)?.value;
    if (typeof value === "string") return value;
  }

  return "";
}
