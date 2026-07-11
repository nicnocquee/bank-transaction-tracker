import { describe, it, expect, afterEach, vi } from "vitest";
import {
  extractAfterLabel,
  extractPayee,
  extractSender,
  parseIdrAmount,
  parseSinarmas,
  parseSinarmasDate,
} from "./sinarmas-parser";
import { SAMPLE_SINARMAS_EMAIL } from "./sinarmas-fixtures";

describe("sinarmas-parser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractAfterLabel", () => {
    it("returns the line after a label", () => {
      // Act
      const value = extractAfterLabel(SAMPLE_SINARMAS_EMAIL, "ID Transaksi");

      // Assert
      expect(value).toBe("FT261917R0C7");
    });

    it("returns null when the label is missing", () => {
      // Act
      const value = extractAfterLabel("hello", "ID Transaksi");

      // Assert
      expect(value).toBeNull();
    });
  });

  describe("parseSinarmasDate", () => {
    it("parses Indonesian month names into +07:00 ISO", () => {
      // Act
      const iso = parseSinarmasDate("10 Jul 2026, 18:37:54 WIB");

      // Assert
      expect(iso).toBe("2026-07-10T18:37:54+07:00");
    });

    it("returns null for malformed dates", () => {
      // Act / Assert
      expect(parseSinarmasDate("not-a-date")).toBeNull();
    });

    it("returns null for unknown month tokens", () => {
      // Act / Assert
      expect(parseSinarmasDate("10 Xxx 2026, 18:37:54 WIB")).toBeNull();
    });
  });

  describe("parseIdrAmount", () => {
    it("parses dotted rupiah amounts", () => {
      // Act
      const amount = parseIdrAmount("Rp120.000");

      // Assert
      expect(amount).toBe(120000);
    });

    it("returns null for non-numeric amounts", () => {
      // Act / Assert
      expect(parseIdrAmount("RpABC")).toBeNull();
    });
  });

  describe("extractPayee", () => {
    it("extracts merchant and destination bank from Indonesian receipts", () => {
      // Act
      const payee = extractPayee(SAMPLE_SINARMAS_EMAIL);

      // Assert
      expect(payee.merchant).toBe("FIESTA STEAK SUMARECON 3");
      expect(payee.destinationBank).toBe("BANK RAKYAT INDONESIA");
    });

    it("extracts English Paid to blocks with a bank line", () => {
      // Setup
      const text = `Paid to\nCoffee Shop\n12345\nBANK EXAMPLE\n`;

      // Act
      const payee = extractPayee(text);

      // Assert
      expect(payee.merchant).toBe("Coffee Shop");
      expect(payee.destinationBank).toBe("BANK EXAMPLE");
    });

    it("falls back to two-line Indonesian payee without a bank", () => {
      // Setup
      const text = `Dibayarkan ke\nMerchant A\n9360001\n`;

      // Act
      const payee = extractPayee(text);

      // Assert
      expect(payee.merchant).toBe("Merchant A 9360001");
      expect(payee.destinationBank).toBeNull();
    });

    it("falls back to two-line English payee without a bank", () => {
      // Setup
      const text = `Paid to\nMerchant B\n999\n`;

      // Act
      const payee = extractPayee(text);

      // Assert
      expect(payee.merchant).toBe("Merchant B 999");
      expect(payee.destinationBank).toBeNull();
    });

    it("uses combined lines when the third Indonesian line is not a bank", () => {
      // Setup
      const text = `Dibayarkan ke\nShop\n111\nNOT A BANK LINE\n`;

      // Act
      const payee = extractPayee(text);

      // Assert
      expect(payee.merchant).toBe("Shop 111");
      expect(payee.destinationBank).toBeNull();
    });

    it("uses combined lines when the third English line is not a bank", () => {
      // Setup
      const text = `Paid to\nShop\n111\nNOT A BANK LINE\n`;

      // Act
      const payee = extractPayee(text);

      // Assert
      expect(payee.merchant).toBe("Shop 111");
      expect(payee.destinationBank).toBeNull();
    });

    it("returns nulls when no payee block exists", () => {
      // Act
      const payee = extractPayee("no payee here");

      // Assert
      expect(payee).toEqual({ merchant: null, destinationBank: null });
    });
  });

  describe("extractSender", () => {
    it("extracts Dari name and account line", () => {
      // Act
      const sender = extractSender(SAMPLE_SINARMAS_EMAIL);

      // Assert
      expect(sender.senderName).toBe("NICO PRANANTA");
      expect(sender.senderAccountMasked).toBe("Simas Payroll - ******4946");
    });

    it("returns nulls when sender block is missing", () => {
      // Act
      const sender = extractSender("nothing");

      // Assert
      expect(sender).toEqual({
        senderName: null,
        senderAccountMasked: null,
      });
    });
  });

  describe("parseSinarmas", () => {
    it("parses the sample Simobi+ receipt", () => {
      // Act
      const parsed = parseSinarmas(SAMPLE_SINARMAS_EMAIL);

      // Assert
      expect(parsed).toMatchObject({
        transactionNumber: "FT261917R0C7",
        transactionDate: "2026-07-10T18:37:54+07:00",
        amount: 120000,
        merchant: "FIESTA STEAK SUMARECON 3",
        referenceNumber: "MB-783683472075",
        senderName: "NICO PRANANTA",
        senderAccountMasked: "Simas Payroll - ******4946",
        destinationBank: "BANK RAKYAT INDONESIA",
        bank: "sinarmas",
        year: 2026,
        month: 7,
        date: 10,
      });
    });

    it("returns null for missing text", () => {
      // Act / Assert
      expect(parseSinarmas(null)).toBeNull();
      expect(parseSinarmas(undefined)).toBeNull();
      expect(parseSinarmas("")).toBeNull();
    });

    it("parses English labels", () => {
      // Setup
      const text = `Transaction ID
TX-1

Transaction date
1 May 2026, 09:00:00 WIB

From
Alice
Account - ****11

Paid to
Store
999
BANK FOO

Reference number
REF-1

Amount
Rp1.500
`;

      // Act
      const parsed = parseSinarmas(text);

      // Assert
      expect(parsed?.transactionNumber).toBe("TX-1");
      expect(parsed?.amount).toBe(1500);
      expect(parsed?.referenceNumber).toBe("REF-1");
      expect(parsed?.merchant).toBe("Store");
      expect(parsed?.destinationBank).toBe("BANK FOO");
      expect(parsed?.month).toBe(5);
    });

    it("leaves date null when the date line is unparseable", () => {
      // Setup
      const text = `ID transaksi
ABC

Tanggal transaksi
bogus

Nominal
Rp100
`;

      // Act
      const parsed = parseSinarmas(text);

      // Assert
      expect(parsed?.transactionNumber).toBe("ABC");
      expect(parsed?.transactionDate).toBeNull();
      expect(parsed?.year).toBeNull();
      expect(parsed?.month).toBeNull();
      expect(parsed?.date).toBeNull();
    });
  });
});
