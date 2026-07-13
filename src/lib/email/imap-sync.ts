import { simpleParser } from "mailparser";
import { ImapFlow } from "imapflow";
import { parseSinarmas } from "@/lib/parsers/sinarmas-parser";
import {
  persistParsedTransaction,
  type TransactionStore,
} from "@/lib/transactions/persist-transaction";

export const SINARMAS_FROM = "qris-transaction@banksinarmas.com";

/** Max messages processed per sync to stay within serverless time limits. */
export const SYNC_MESSAGE_LIMIT = 50;

/**
 * Default wall-clock budget for Netlify `/api/cron/sync` (platform ~26–30s cap).
 */
export const CRON_SYNC_BUDGET_MS_DEFAULT = 18_000;

/** IMAP connect/greeting/socket timeouts tuned for serverless runtimes. */
export const IMAP_CONNECTION_TIMEOUT_MS = 10_000;
export const IMAP_GREETING_TIMEOUT_MS = 8_000;
export const IMAP_SOCKET_TIMEOUT_MS = 15_000;

/**
 * Optional wall-clock deadline so sync can stop cleanly before the host kills it.
 */
export type SyncDeadline = {
  endsAt: number;
  now?: () => number;
};

/**
 * Minimal mailbox list entry used when resolving the All Mail folder.
 */
export type ImapMailboxListEntry = {
  path: string;
  specialUse?: string;
};

/**
 * Minimal IMAP client surface used by sync (real ImapFlow or a test fake).
 */
export type ImapClient = {
  connect: () => Promise<void>;
  logout: () => Promise<void>;
  list?: () => Promise<ImapMailboxListEntry[]>;
  mailboxOpen: (path: string) => Promise<unknown>;
  search: (
    query: object,
    options?: { uid?: boolean },
  ) => Promise<number[] | false>;
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
  mailbox: string;
  truncated: boolean;
  deadlineReached?: boolean;
};

/**
 * Returns true when the optional sync deadline has already passed.
 * @param deadline - Optional wall-clock deadline.
 */
export function isSyncDeadlineReached(deadline?: SyncDeadline): boolean {
  if (!deadline) {
    return false;
  }
  const now = deadline.now ?? Date.now;
  return now() >= deadline.endsAt;
}

/**
 * Builds a sync deadline `budgetMs` milliseconds from now.
 * @param budgetMs - How long sync may run before stopping early.
 * @param now - Clock function (defaults to Date.now) for tests.
 */
export function createSyncDeadline(
  budgetMs: number,
  now: () => number = Date.now,
): SyncDeadline {
  return { endsAt: now() + budgetMs, now };
}

/**
 * Creates a production ImapFlow client for the given connection config.
 * Uses short timeouts so a hung IMAP server cannot outlive serverless limits.
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
    connectionTimeout: IMAP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: IMAP_GREETING_TIMEOUT_MS,
    socketTimeout: IMAP_SOCKET_TIMEOUT_MS,
  }) as unknown as ImapClient;
}
/* v8 ignore stop */

/**
 * Returns true when the IMAP host is Gmail (including googlemail).
 * @param host - IMAP hostname from connection settings.
 */
export function isGmailHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "imap.gmail.com" ||
    normalized.endsWith(".gmail.com") ||
    normalized === "imap.googlemail.com" ||
    normalized.endsWith(".googlemail.com")
  );
}

/**
 * Builds the IMAP search query for Sinarmas QRIS receipts.
 * Gmail uses X-GM-RAW so archived mail matches the same way as the web UI.
 * @param host - IMAP hostname from connection settings.
 */
export function buildSinarmasSearchQuery(host: string): object {
  if (isGmailHost(host)) {
    return { gmraw: `from:${SINARMAS_FROM}` };
  }
  return { from: SINARMAS_FROM };
}

/**
 * Prefers the provider's All Mail folder (SPECIAL-USE \\All) so archived
 * receipts are included; falls back to INBOX when listing is unavailable.
 * @param client - Connected IMAP client (list is optional for fakes).
 */
export async function resolveSyncMailbox(
  client: Pick<ImapClient, "list">,
): Promise<string> {
  if (!client.list) {
    return "INBOX";
  }
  try {
    const boxes = await client.list();
    const allMail = boxes.find((box) => box.specialUse === "\\All");
    return allMail?.path ?? "INBOX";
  } catch {
    return "INBOX";
  }
}

/**
 * Selects newest UIDs first, skips already-imported source ids, and caps the
 * batch for serverless runtimes so "Sync again" advances past imported mail.
 * @param uids - UIDs returned by IMAP SEARCH.
 * @param limit - Max messages to process (defaults to {@link SYNC_MESSAGE_LIMIT}).
 * @param excludeSourceIds - Source message ids already stored for the user.
 */
export function selectUidsForSync(
  uids: number[],
  limit: number = SYNC_MESSAGE_LIMIT,
  excludeSourceIds: Iterable<string> = [],
): { selected: number[]; truncated: boolean } {
  const exclude = new Set(
    [...excludeSourceIds].map((id) => id.trim()).filter(Boolean),
  );
  const sorted = [...uids]
    .filter((uid) => !exclude.has(String(uid)))
    .sort((a, b) => b - a);
  if (sorted.length <= limit) {
    return { selected: sorted, truncated: false };
  }
  return { selected: sorted.slice(0, limit), truncated: true };
}

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
 * Searches All Mail when available (not only INBOX) so archived Gmail
 * receipts are imported. Processes newest messages first, capped per run.
 * @param userId - Owning user id.
 * @param config - IMAP connection settings.
 * @param store - Transaction persistence collaborator.
 * @param createClient - Factory for IMAP clients (defaults to ImapFlow).
 * @param messageLimit - Optional per-run fetch cap (defaults to SYNC_MESSAGE_LIMIT).
 * @param deadline - Optional wall-clock deadline for serverless hosts.
 * @returns Counts of fetched/created/skipped messages and error messages.
 */
export async function syncSinarmasFromImap(
  userId: string,
  config: ImapConnectionConfig,
  store: TransactionStore,
  createClient: (
    config: ImapConnectionConfig,
  ) => ImapClient = createImapFlowClient,
  messageLimit: number = SYNC_MESSAGE_LIMIT,
  deadline?: SyncDeadline,
): Promise<SyncResult> {
  const client = createClient(config);
  const result: SyncResult = {
    fetched: 0,
    created: 0,
    skipped: 0,
    errors: [],
    mailbox: "INBOX",
    truncated: false,
  };

  await client.connect();
  try {
    if (isSyncDeadlineReached(deadline)) {
      result.deadlineReached = true;
      result.truncated = true;
      return result;
    }

    result.mailbox = await resolveSyncMailbox(client);
    await client.mailboxOpen(result.mailbox);
    const searchResult = await client.search(
      buildSinarmasSearchQuery(config.host),
      { uid: true },
    );
    const uids = Array.isArray(searchResult) ? searchResult : [];
    result.fetched = uids.length;

    if (isSyncDeadlineReached(deadline)) {
      result.deadlineReached = true;
      result.truncated = true;
      await store.markImapSynced(userId, new Date());
      return result;
    }

    const alreadySynced = await store.listSyncedSourceMessageIds(userId);
    const { selected, truncated } = selectUidsForSync(
      uids,
      messageLimit,
      alreadySynced,
    );
    result.truncated = truncated;

    for (const uid of selected) {
      if (isSyncDeadlineReached(deadline)) {
        result.deadlineReached = true;
        result.truncated = true;
        break;
      }
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
