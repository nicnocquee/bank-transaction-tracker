/**
 * Formats year/month as an HTML month input value (YYYY-MM).
 * @param year - Full year.
 * @param month - Month number 1-12.
 * @returns Value suitable for `<input type="month">`.
 */
export function toMonthValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Parses an HTML month input value into year and month numbers.
 * @param value - String like "2026-07".
 * @returns Parsed year/month, or null when invalid.
 */
export function fromMonthValue(
  value: string,
): { year: number; month: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}
