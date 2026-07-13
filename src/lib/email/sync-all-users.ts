import { decryptSecret } from "@/lib/crypto/secret-box";
import {
  isSyncDeadlineReached,
  syncSinarmasFromImap,
  type ImapClient,
  type ImapConnectionConfig,
  type SyncDeadline,
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
  stoppedEarly: boolean;
  outcomes: UserSyncOutcome[];
};

/**
 * Per-user sync function shape used by {@link syncAllEnabledUsers}.
 */
export type SyncUserFn = (
  userId: string,
  config: ImapConnectionConfig,
  store: TransactionStore,
  createClient?: (config: ImapConnectionConfig) => ImapClient,
  messageLimit?: number,
  deadline?: SyncDeadline,
) => Promise<SyncResult>;

/**
 * Syncs bank receipt emails for every user with an enabled IMAP connection.
 * Stops starting new users when `deadline` is reached so serverless hosts can
 * return before the platform gateway times out.
 * @param loader - Loads enabled IMAP connections.
 * @param store - Transaction persistence collaborator.
 * @param decryptPassword - Decrypts stored IMAP passwords (defaults to decryptSecret).
 * @param syncUser - Per-user sync function (defaults to syncSinarmasFromImap).
 * @param createClient - Optional IMAP client factory forwarded to sync.
 * @param deadline - Optional wall-clock deadline for the whole batch.
 * @returns Aggregate sync outcomes per user.
 */
export async function syncAllEnabledUsers(
  loader: ImapConnectionLoader,
  store: TransactionStore,
  decryptPassword: (payload: string) => string = decryptSecret,
  syncUser: SyncUserFn = syncSinarmasFromImap,
  createClient?: (config: ImapConnectionConfig) => ImapClient,
  deadline?: SyncDeadline,
): Promise<SyncAllResult> {
  const connections = await loader.listEnabled();
  const outcomes: UserSyncOutcome[] = [];
  let stoppedEarly = false;

  for (const connection of connections) {
    if (isSyncDeadlineReached(deadline)) {
      stoppedEarly = true;
      break;
    }

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
        undefined,
        deadline,
      );
      if (result.deadlineReached) {
        stoppedEarly = true;
      }
      outcomes.push({ userId: connection.userId, ok: true, result });
      if (result.deadlineReached) {
        break;
      }
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
    usersAttempted: outcomes.length,
    usersSucceeded,
    usersFailed: outcomes.length - usersSucceeded,
    stoppedEarly,
    outcomes,
  };
}
