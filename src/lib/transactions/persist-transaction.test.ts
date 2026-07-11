import { describe, it, expect, afterEach, vi } from "vitest";
import { persistParsedTransaction } from "./persist-transaction";
import type { TransactionStore } from "./persist-transaction";
import type { SinarmasTransaction } from "@/lib/parsers/sinarmas-parser";

const valid: SinarmasTransaction = {
  transactionDate: "2026-07-10T18:37:54+07:00",
  transactionNumber: "FT261917R0C7",
  amount: 120000,
  merchant: "FIESTA",
  referenceNumber: "MB-1",
  senderName: "NICO",
  senderAccountMasked: "****4946",
  destinationBank: "BRI",
  bank: "sinarmas",
  year: 2026,
  month: 7,
  date: 10,
};

describe("persistParsedTransaction", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to the store for complete transactions", async () => {
    // Setup
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
    };

    // Act
    const result = await persistParsedTransaction(store, "user-1", valid);

    // Assert
    expect(result).toEqual({ id: "1", created: true });
  });

  it("returns null when amount is missing", async () => {
    // Setup
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
    };

    // Act
    const result = await persistParsedTransaction(store, "user-1", {
      ...valid,
      amount: null,
    });

    // Assert
    expect(result).toBeNull();
  });

  it("returns null when transactionDate is missing", async () => {
    // Setup
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
    };

    // Act
    const result = await persistParsedTransaction(store, "user-1", {
      ...valid,
      transactionDate: null,
    });

    // Assert
    expect(result).toBeNull();
  });
});
