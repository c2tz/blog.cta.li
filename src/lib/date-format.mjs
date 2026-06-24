const DISPLAY_TIME_ZONE = "Europe/Paris";

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: DISPLAY_TIME_ZONE,
});

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: DISPLAY_TIME_ZONE,
  timeZoneName: "shortOffset",
});

export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export function formatFrenchDateTime(value) {
  const date = toDate(value);
  const formattedDate = DATE_FORMATTER.format(date);
  const formattedTime = TIME_FORMATTER.format(date).replace("UTC−", "UTC-");
  const capitalizedDate =
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return `${capitalizedDate}, ${formattedTime}`;
}
