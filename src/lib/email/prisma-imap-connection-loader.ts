import { prisma } from "@/lib/db/prisma";
import type {
  EnabledImapConnection,
  ImapConnectionLoader,
} from "@/lib/email/sync-all-users";

/**
 * Prisma-backed loader for enabled IMAP connections across all users.
 * @param db - Optional Prisma client (defaults to shared prisma).
 * @returns ImapConnectionLoader implementation.
 */
export function createPrismaImapConnectionLoader(
  db: typeof prisma = prisma,
): ImapConnectionLoader {
  return {
    async listEnabled(): Promise<EnabledImapConnection[]> {
      const rows = await db.imapConnection.findMany({
        where: { enabled: true },
        select: {
          userId: true,
          host: true,
          port: true,
          username: true,
          passwordEncrypted: true,
          tls: true,
        },
      });
      return rows;
    },
  };
}
