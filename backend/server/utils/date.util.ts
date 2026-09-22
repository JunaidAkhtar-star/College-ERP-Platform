const INDIA_TIME_ZONE = "Asia/Kolkata";

/** Stable human date for every PDF, email and notification: DD/MM/YYYY. */
export function formatIndiaDate(value: string | number | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: INDIA_TIME_ZONE,
  }).format(date);
}

/** Stable India date/time with padded date and time components. */
export function formatIndiaDateTime(value: string | number | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: INDIA_TIME_ZONE,
  }).format(date);
}
