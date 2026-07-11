import { simpleParser } from "mailparser";
import { ImapFlow } from "imapflow";
import { parseSinarmas } from "@/lib/parsers/sinarmas-parser";
import {
  persistParsedTransaction,
  type TransactionStore,
} from "@/lib/transactions/persist-transaction";

export const SINARMAS_FROM = "qris-transaction@banksinarmas.com";

/**
 * Minimal IMAP client surface used by sync (real ImapFlow or a test fake).
 */
export type ImapClient = {
  connect: () => Promise<void>;
  logout: () => Promise<void>;
  mailboxOpen: (path: string) => Promise<unknown>;
  search: (query: object, options?: { uid?: boolean }) => Promise<number[]>;
  fetchOne: (
    uid: number,
    query: { source: true },
    options?: { uid?: boolean },
  ) => Promise<{ source?: Buffer } | false>;
};

export type ImapConnectionConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  tls?: boolean;
};

export type SyncResult = {
  fetched: number;
  created: number;
  skipped: number;
  errors: string[];
};

/**
 * Creates a production ImapFlow client for the given connection config.
 * @param config - Host, credentials, and TLS settings.
 * @returns Connected-capable ImapFlow instance cast to {@link ImapClient}.
 */
/* v8 ignore start -- thin wrapper around ImapFlow constructor */
export function createImapFlowClient(config: ImapConnectionConfig): ImapClient {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls ?? true,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  }) as unknown as ImapClient;
}
/* v8 ignore stop */

/**
 * Extracts plain text from a raw RFC822 message buffer.
 * @param source - Raw email bytes.
 * @param parseMail - Injectable mailparser (defaults to simpleParser).
 * @returns Plain text body or empty string.
 */
export async function extractPlainTextFromSource(
  source: Buffer,
  parseMail: typeof simpleParser = simpleParser,
): Promise<string> {
  const parsed = await parseMail(source);
  if (parsed.text?.trim()) {
    return parsed.text;
  }
  if (typeof parsed.html === "string" && parsed.html.trim()) {
    return parsed.html.replace(/<[^>]+>/g, "\n");
  }
  return "";
}

/**
 * Syncs Sinarmas QRIS emails from IMAP into the transaction store.
 * @param userId - Owning user id.
 * @param config - IMAP connection settings.
 * @param store - Transaction persistence collaborator.
 * @param createClient - Factory for IMAP clients (defaults to ImapFlow).
 * @returns Counts of fetched/created/skipped messages and error messages.
 */
export async function syncSinarmasFromImap(
  userId: string,
  config: ImapConnectionConfig,
  store: TransactionStore,
  createClient: (
    config: ImapConnectionConfig,
  ) => ImapClient = createImapFlowClient,
): Promise<SyncResult> {
  const client = createClient(config);
  const result: SyncResult = {
    fetched: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };

  await client.connect();
  try {
    await client.mailboxOpen("INBOX");
    const uids = await client.search({ from: SINARMAS_FROM }, { uid: true });
    result.fetched = uids.length;

    for (const uid of uids) {
      try {
        const message = await client.fetchOne(
          uid,
          { source: true },
          { uid: true },
        );
        if (!message || !message.source) {
          result.skipped += 1;
          continue;
        }
        const text = await extractPlainTextFromSource(message.source);
        const parsed = parseSinarmas(text);
        if (!parsed?.transactionNumber) {
          result.skipped += 1;
          continue;
        }
        const persisted = await persistParsedTransaction(
          store,
          userId,
          parsed,
          String(uid),
          text.slice(0, 500),
        );
        if (!persisted) {
          result.skipped += 1;
          continue;
        }
        if (persisted.created) {
          result.created += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : "Unknown sync error",
        );
      }
    }

    await store.markImapSynced(userId, new Date());
  } finally {
    await client.logout();
  }

  return result;
}

/**
 * Verifies IMAP credentials by connecting and opening INBOX.
 * @param config - IMAP connection settings.
 * @param createClient - Factory for IMAP clients (defaults to ImapFlow).
 * @returns True when login and mailbox open succeed.
 */
export async function testImapConnection(
  config: ImapConnectionConfig,
  createClient: (
    config: ImapConnectionConfig,
  ) => ImapClient = createImapFlowClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = createClient(config);
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    await client.logout();
    return { ok: true };
  } catch (error) {
    try {
      await client.logout();
    } catch {
      // ignore logout failures after connect errors
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "IMAP connection failed",
    };
  }
}
