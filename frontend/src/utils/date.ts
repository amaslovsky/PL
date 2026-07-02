// Date utilities shared by the form default-values and the input onChange.
//
// Both helpers use `timeZone: "UTC"` so the displayed string and the
// `<input type="date">` ISO value agree across the SSR/client hydration
// boundary. Without this, a user near UTC midnight sees a date mismatch
// on first paint (server renders UTC date, client renders local date).

/** Today's date as a UTC `yyyy-mm-dd` string (matches `<input type="date">`). */
export function todayIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Format a `Date` as a long English date in UTC, e.g. "June 30, 2026". */
export function formatLongDateUtc(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Produce the human-readable form of a `yyyy-mm-dd` ISO date string in UTC.
 * Returns an empty string for an empty input.
 */
export function formatIsoAsLongDateUtc(iso: string): string {
  if (!iso) return "";
  // Parse as UTC midnight to match `todayIsoUtc()` semantics.
  const [y, m, d] = iso.split("-").map(Number);
  return formatLongDateUtc(new Date(Date.UTC(y, m - 1, d)));
}