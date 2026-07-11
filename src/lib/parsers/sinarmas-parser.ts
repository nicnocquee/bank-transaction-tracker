/**
 * Structured Bank Sinarmas / Simobi+ QRIS payment receipt fields.
 */
export type SinarmasTransaction = {
  transactionDate: string | null;
  transactionNumber: string | null;
  amount: number | null;
  merchant: string | null;
  referenceNumber: string | null;
  senderName: string | null;
  senderAccountMasked: string | null;
  destinationBank: string | null;
  bank: "sinarmas";
  year: number | null;
  month: number | null;
  date: number | null;
};

const MONTH_MAP: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  Mei: "05",
  May: "05",
  Jun: "06",
  Jul: "07",
  Agu: "08",
  Aug: "08",
  Sep: "09",
  Okt: "10",
  Oct: "10",
  Nov: "11",
  Des: "12",
  Dec: "12",
};

/**
 * Extracts the first non-empty line after a label in plain-text email bodies.
 * @param text - Full email plain text.
 * @param label - Indonesian or English field label.
 * @returns Trimmed value or null.
 */
export function extractAfterLabel(text: string, label: string): string | null {
  const regex = new RegExp(`${label}\\s*\\n+([^\\n\\[]+)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parses an Indonesian/English Simobi+ transaction date into ISO-8601 with +07:00.
 * @param rawDate - e.g. "10 Jul 2026, 18:37:54 WIB".
 * @returns ISO datetime string or null when unparseable.
 */
export function parseSinarmasDate(rawDate: string): string | null {
  const match = rawDate.match(
    /(\d{1,2})\s+(\w+)\s+(\d{4}),\s+(\d{2}:\d{2}:\d{2})/,
  );
  if (!match) {
    return null;
  }
  const [, day, month, year, time] = match;
  const mm = MONTH_MAP[month];
  if (!mm) {
    return null;
  }
  return `${year}-${mm}-${day.padStart(2, "0")}T${time}+07:00`;
}

/**
 * Parses an IDR amount string like "Rp120.000" into an integer rupiah value.
 * @param amountRaw - Amount text from the email.
 * @returns Integer IDR amount or null.
 */
export function parseIdrAmount(amountRaw: string): number | null {
  const digits = amountRaw.replace(/[Rp\s.]/gi, "").replace(/,/g, "");
  if (!/^\d+$/.test(digits)) {
    return null;
  }
  return Number.parseInt(digits, 10);
}

/**
 * Extracts merchant name and destination bank from the "Dibayarkan ke" / "Paid to" block.
 * @param text - Full email plain text.
 * @returns Merchant display name and destination bank when present.
 */
export function extractPayee(text: string): {
  merchant: string | null;
  destinationBank: string | null;
} {
  const idMatch = text.match(
    /Dibayarkan ke\s*\n+([^\n]+)\n+([^\n]+)\n+([^\n]+)/i,
  );
  if (idMatch) {
    const line1 = idMatch[1].trim();
    const line2 = idMatch[2].trim();
    const line3 = idMatch[3].trim();
    const destinationBank = /^bank\b/i.test(line3) ? line3 : null;
    const merchant = destinationBank
      ? line1.replace(/-\s*$/, "").trim()
      : `${line1} ${line2}`.trim();
    return { merchant, destinationBank };
  }

  const enMatch = text.match(/Paid to\s*\n+([^\n]+)\n+([^\n]+)\n+([^\n]+)/i);
  if (enMatch) {
    const line1 = enMatch[1].trim();
    const line2 = enMatch[2].trim();
    const line3 = enMatch[3].trim();
    const destinationBank = /^bank\b/i.test(line3) ? line3 : null;
    const merchant = destinationBank
      ? line1.replace(/-\s*$/, "").trim()
      : `${line1} ${line2}`.trim();
    return { merchant, destinationBank };
  }

  const fallbackId = text.match(/Dibayarkan ke\s*\n+([^\n]+)\n+([^\n]+)/i);
  if (fallbackId) {
    return {
      merchant: `${fallbackId[1].trim()} ${fallbackId[2].trim()}`.trim(),
      destinationBank: null,
    };
  }

  const fallbackEn = text.match(/Paid to\s*\n+([^\n]+)\n+([^\n\[]+)/i);
  if (fallbackEn) {
    return {
      merchant: `${fallbackEn[1].trim()} ${fallbackEn[2].trim()}`.trim(),
      destinationBank: null,
    };
  }

  return { merchant: null, destinationBank: null };
}

/**
 * Extracts sender name and masked account line from the "Dari" / "From" block.
 * @param text - Full email plain text.
 * @returns Sender name and account summary when present.
 */
export function extractSender(text: string): {
  senderName: string | null;
  senderAccountMasked: string | null;
} {
  const match = text.match(/(?:Dari|From)\s*\n+([^\n]+)\n+([^\n]+)/i);
  if (!match) {
    return { senderName: null, senderAccountMasked: null };
  }
  return {
    senderName: match[1].trim(),
    senderAccountMasked: match[2].trim(),
  };
}

/**
 * Parses a Bank Sinarmas Simobi+ QRIS/transfer confirmation email body.
 * @param text - Plain-text email body (or null/empty).
 * @returns Structured transaction fields, or null when text is missing.
 */
export function parseSinarmas(
  text: string | null | undefined,
): SinarmasTransaction | null {
  if (!text) {
    return null;
  }

  const transactionNumber =
    extractAfterLabel(text, "ID Transaksi") ||
    extractAfterLabel(text, "ID transaksi") ||
    extractAfterLabel(text, "Transaction ID");

  const rawDate =
    extractAfterLabel(text, "Tanggal transaksi") ||
    extractAfterLabel(text, "Transaction date");

  const transactionDate = rawDate ? parseSinarmasDate(rawDate) : null;

  const amountRaw =
    extractAfterLabel(text, "Nominal") || extractAfterLabel(text, "Amount");
  const amount = amountRaw ? parseIdrAmount(amountRaw) : null;

  const referenceNumber =
    extractAfterLabel(text, "Nomor referensi") ||
    extractAfterLabel(text, "Reference number");

  const { merchant, destinationBank } = extractPayee(text);
  const { senderName, senderAccountMasked } = extractSender(text);

  return {
    transactionDate,
    transactionNumber,
    amount,
    merchant,
    referenceNumber,
    senderName,
    senderAccountMasked,
    destinationBank,
    bank: "sinarmas",
    year: transactionDate
      ? Number.parseInt(transactionDate.slice(0, 4), 10)
      : null,
    month: transactionDate
      ? Number.parseInt(transactionDate.slice(5, 7), 10)
      : null,
    date: transactionDate
      ? Number.parseInt(transactionDate.slice(8, 10), 10)
      : null,
  };
}
