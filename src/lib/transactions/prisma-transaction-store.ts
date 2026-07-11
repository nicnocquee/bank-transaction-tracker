import { prisma } from "@/lib/db/prisma";
import type { SinarmasTransaction } from "@/lib/parsers/sinarmas-parser";
import type { TransactionStore } from "@/lib/transactions/persist-transaction";

/**
 * Prisma-backed transaction store used by production IMAP sync.
 * @param db - Optional Prisma client (defaults to shared prisma).
 * @returns TransactionStore implementation.
 */
export function createPrismaTransactionStore(
  db: typeof prisma = prisma,
): TransactionStore {
  return {
    async upsertSinarmasTransaction({
      userId,
      parsed,
      sourceMessageId,
      rawSnippet,
    }) {
      return upsertSinarmasTransaction(
        db,
        userId,
        parsed,
        sourceMessageId,
        rawSnippet,
      );
    },
    async markImapSynced(userId, syncedAt) {
      await db.imapConnection.update({
        where: { userId },
        data: { lastSyncedAt: syncedAt },
      });
    },
  };
}

/**
 * Upserts a Sinarmas transaction row for a user.
 * @param db - Prisma client.
 * @param userId - Owning user id.
 * @param parsed - Parsed email fields.
 * @param sourceMessageId - Optional IMAP message id.
 * @param rawSnippet - Optional raw snippet.
 * @returns Created flag based on whether the row already existed.
 */
export async function upsertSinarmasTransaction(
  db: typeof prisma,
  userId: string,
  parsed: SinarmasTransaction,
  sourceMessageId?: string | null,
  rawSnippet?: string | null,
): Promise<{ id: string; created: boolean }> {
  const existing = await db.transaction.findUnique({
    where: {
      userId_transactionNumber: {
        userId,
        transactionNumber: parsed.transactionNumber!,
      },
    },
  });

  const row = await db.transaction.upsert({
    where: {
      userId_transactionNumber: {
        userId,
        transactionNumber: parsed.transactionNumber!,
      },
    },
    create: {
      userId,
      transactionNumber: parsed.transactionNumber!,
      transactionDate: new Date(parsed.transactionDate!),
      amountIdr: parsed.amount!,
      merchant: parsed.merchant,
      referenceNumber: parsed.referenceNumber,
      senderName: parsed.senderName,
      senderAccountMasked: parsed.senderAccountMasked,
      destinationBank: parsed.destinationBank,
      bank: parsed.bank,
      sourceMessageId: sourceMessageId ?? null,
      rawSnippet: rawSnippet ?? null,
    },
    update: {
      transactionDate: new Date(parsed.transactionDate!),
      amountIdr: parsed.amount!,
      merchant: parsed.merchant,
      referenceNumber: parsed.referenceNumber,
      senderName: parsed.senderName,
      senderAccountMasked: parsed.senderAccountMasked,
      destinationBank: parsed.destinationBank,
      sourceMessageId: sourceMessageId ?? null,
    },
  });

  return { id: row.id, created: !existing };
}
