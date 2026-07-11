/**
 * Formats an integer IDR amount as an Indonesian Rupiah display string.
 * @param amountIdr - Amount in whole rupiah.
 * @returns Formatted currency string.
 */
export function formatIdr(amountIdr: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amountIdr);
}

/**
 * Formats a Date for display in Asia/Jakarta.
 * @param date - Transaction timestamp.
 * @returns Localized date-time string.
 */
export function formatTransactionDate(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value);
}
