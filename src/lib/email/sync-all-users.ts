import { decryptSecret } from "@/lib/crypto/secret-box";
import {
  syncSinarmasFromImap,
  type ImapClient,
  type ImapConnectionConfig,
  type SyncResult,
} from "@/lib/email/imap-sync";
import type { TransactionStore } from "@/lib/transactions/persist-transaction";

/**
 * Enabled IMAP connection row needed to run a background sync.
 */
export type EnabledImapConnection = {
  userId: string;
  host: string;
  port: number;
  username: string;
  passwordEncrypted: string;
  tls: boolean;
};

/**
 * Loads enabled IMAP connections for all users.
 */
export type ImapConnectionLoader = {
  listEnabled: () => Promise<EnabledImapConnection[]>;
};

export type UserSyncOutcome = {
  userId: string;
  ok: boolean;
  result?: SyncResult;
  error?: string;
};

export type SyncAllResult = {
  usersAttempted: number;
  usersSucceeded: number;
  usersFailed: number;
  outcomes: UserSyncOutcome[];
};

/**
 * Syncs bank receipt emails for every user with an enabled IMAP connection.
 * @param loader - Loads enabled IMAP connections.
 * @param store - Transaction persistence collaborator.
 * @param decryptPassword - Decrypts stored IMAP passwords (defaults to decryptSecret).
 * @param syncUser - Per-user sync function (defaults to syncSinarmasFromImap).
 * @param createClient - Optional IMAP client factory forwarded to sync.
 * @returns Aggregate sync outcomes per user.
 */
export async function syncAllEnabledUsers(
  loader: ImapConnectionLoader,
  store: TransactionStore,
  decryptPassword: (payload: string) => string = decryptSecret,
  syncUser: (
    userId: string,
    config: ImapConnectionConfig,
    store: TransactionStore,
    createClient?: (config: ImapConnectionConfig) => ImapClient,
  ) => Promise<SyncResult> = syncSinarmasFromImap,
  createClient?: (config: ImapConnectionConfig) => ImapClient,
): Promise<SyncAllResult> {
  const connections = await loader.listEnabled();
  const outcomes: UserSyncOutcome[] = [];

  for (const connection of connections) {
    try {
      const password = decryptPassword(connection.passwordEncrypted);
      const result = await syncUser(
        connection.userId,
        {
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password,
          tls: connection.tls,
        },
        store,
        createClient,
      );
      outcomes.push({ userId: connection.userId, ok: true, result });
    } catch (error) {
      outcomes.push({
        userId: connection.userId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown sync error",
      });
    }
  }

  const usersSucceeded = outcomes.filter((outcome) => outcome.ok).length;
  return {
    usersAttempted: connections.length,
    usersSucceeded,
    usersFailed: connections.length - usersSucceeded,
    outcomes,
  };
}
