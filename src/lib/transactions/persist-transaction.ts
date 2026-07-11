import type { SinarmasTransaction } from "@/lib/parsers/sinarmas-parser";

/**
 * Minimal persistence surface used by IMAP sync (enables fakes in tests).
 */
export type TransactionStore = {
  upsertSinarmasTransaction: (input: {
    userId: string;
    parsed: SinarmasTransaction;
    sourceMessageId?: string | null;
    rawSnippet?: string | null;
  }) => Promise<{ id: string; created: boolean }>;
  markImapSynced: (userId: string, syncedAt: Date) => Promise<void>;
};

/**
 * Upserts a parsed Sinarmas transaction for a user, keyed by transaction number.
 * @param store - Persistence collaborator.
 * @param userId - Owning user id.
 * @param parsed - Parsed email fields.
 * @param sourceMessageId - Optional IMAP/RFC message id.
 * @param rawSnippet - Optional raw text snippet for debugging.
 * @returns Upsert result with created flag.
 */
export async function persistParsedTransaction(
  store: TransactionStore,
  userId: string,
  parsed: SinarmasTransaction,
  sourceMessageId?: string | null,
  rawSnippet?: string | null,
): Promise<{ id: string; created: boolean } | null> {
  if (
    !parsed.transactionNumber ||
    parsed.amount == null ||
    !parsed.transactionDate
  ) {
    return null;
  }
  return store.upsertSinarmasTransaction({
    userId,
    parsed,
    sourceMessageId,
    rawSnippet,
  });
}
