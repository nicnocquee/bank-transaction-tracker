import { describe, it, expect, afterEach, vi } from "vitest";
import {
  buildSinarmasSearchQuery,
  extractPlainTextFromSource,
  isGmailHost,
  resolveSyncMailbox,
  selectUidsForSync,
  syncSinarmasFromImap,
  testImapConnection,
  type ImapClient,
  type ImapConnectionConfig,
} from "./imap-sync";
import type { TransactionStore } from "@/lib/transactions/persist-transaction";
import { SAMPLE_SINARMAS_EMAIL } from "@/lib/parsers/sinarmas-fixtures";

const config: ImapConnectionConfig = {
  host: "imap.example.com",
  port: 993,
  username: "user@example.com",
  password: "secret",
  tls: true,
};

/**
 * Builds a fake IMAP client for deterministic sync tests.
 */
function createFakeClient(options: {
  uids?: number[] | false;
  sources?: Record<number, Buffer>;
  connectError?: Error;
  mailboxes?: { path: string; specialUse?: string }[];
  listError?: Error;
  opened?: string[];
  searchedQueries?: object[];
}): ImapClient {
  return {
    connect: async () => {
      if (options.connectError) {
        throw options.connectError;
      }
    },
    logout: async () => undefined,
    list: options.mailboxes
      ? async () => {
          if (options.listError) {
            throw options.listError;
          }
          return options.mailboxes ?? [];
        }
      : undefined,
    mailboxOpen: async (path) => {
      options.opened?.push(path);
      return {};
    },
    search: async (query) => {
      options.searchedQueries?.push(query);
      return options.uids ?? [];
    },
    fetchOne: async (uid) => {
      const source = options.sources?.[uid];
      if (!source) {
        return false;
      }
      return { source };
    },
  };
}

describe("imap-sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isGmailHost", () => {
    it("detects gmail and googlemail hosts", () => {
      // Act / Assert
      expect(isGmailHost("imap.gmail.com")).toBe(true);
      expect(isGmailHost("IMAP.Gmail.com")).toBe(true);
      expect(isGmailHost("imap.googlemail.com")).toBe(true);
      expect(isGmailHost("imap.example.com")).toBe(false);
    });
  });

  describe("buildSinarmasSearchQuery", () => {
    it("uses gmraw for Gmail and from for other hosts", () => {
      // Act / Assert
      expect(buildSinarmasSearchQuery("imap.gmail.com")).toEqual({
        gmraw: "from:qris-transaction@banksinarmas.com",
      });
      expect(buildSinarmasSearchQuery("imap.example.com")).toEqual({
        from: "qris-transaction@banksinarmas.com",
      });
    });
  });

  describe("resolveSyncMailbox", () => {
    it("returns INBOX when list is unavailable", async () => {
      // Act
      const path = await resolveSyncMailbox({});

      // Assert
      expect(path).toBe("INBOX");
    });

    it("prefers the SPECIAL-USE All mailbox when listed", async () => {
      // Setup
      const client = createFakeClient({
        mailboxes: [
          { path: "INBOX" },
          { path: "[Gmail]/All Mail", specialUse: "\\All" },
        ],
      });

      // Act
      const path = await resolveSyncMailbox(client);

      // Assert
      expect(path).toBe("[Gmail]/All Mail");
    });

    it("falls back to INBOX when list throws", async () => {
      // Setup
      const client = createFakeClient({
        mailboxes: [{ path: "INBOX" }],
        listError: new Error("list failed"),
      });

      // Act
      const path = await resolveSyncMailbox(client);

      // Assert
      expect(path).toBe("INBOX");
    });

    it("falls back to INBOX when no All mailbox is listed", async () => {
      // Setup
      const client = createFakeClient({
        mailboxes: [{ path: "INBOX" }, { path: "Archive" }],
      });

      // Act
      const path = await resolveSyncMailbox(client);

      // Assert
      expect(path).toBe("INBOX");
    });
  });

  describe("selectUidsForSync", () => {
    it("returns newest UIDs first and marks truncation", () => {
      // Act
      const full = selectUidsForSync([1, 3, 2], 10);
      const capped = selectUidsForSync([1, 2, 3, 4], 2);

      // Assert
      expect(full).toEqual({ selected: [3, 2, 1], truncated: false });
      expect(capped).toEqual({ selected: [4, 3], truncated: true });
    });
  });

  describe("extractPlainTextFromSource", () => {
    it("prefers text/plain bodies", async () => {
      // Setup
      const source = Buffer.from(
        "Content-Type: text/plain; charset=utf-8\r\n\r\nHello plain",
      );

      // Act
      const text = await extractPlainTextFromSource(source);

      // Assert
      expect(text).toContain("Hello plain");
    });

    it("strips HTML when plain text is absent", async () => {
      // Setup
      const parseMail = vi.fn(async () => ({
        text: undefined,
        html: "<p>Hello <b>HTML</b></p>",
      }));

      // Act
      const text = await extractPlainTextFromSource(
        Buffer.from("x"),
        parseMail as never,
      );

      // Assert
      expect(text).toContain("Hello");
      expect(text).not.toContain("<b>");
    });

    it("returns empty string when the message has no body", async () => {
      // Setup
      const parseMail = vi.fn(async () => ({ text: "   ", html: false }));

      // Act
      const text = await extractPlainTextFromSource(
        Buffer.from("x"),
        parseMail as never,
      );

      // Assert
      expect(text).toBe("");
    });

    it("returns empty string when html is an empty string", async () => {
      // Setup
      const parseMail = vi.fn(async () => ({ text: "", html: "   " }));

      // Act
      const text = await extractPlainTextFromSource(
        Buffer.from("x"),
        parseMail as never,
      );

      // Assert
      expect(text).toBe("");
    });
  });

  describe("syncSinarmasFromImap", () => {
    it("creates transactions from parseable Sinarmas emails and dedupes", async () => {
      // Setup
      const createdIds: string[] = [];
      const store: TransactionStore = {
        upsertSinarmasTransaction: async ({ parsed }) => {
          const created = !createdIds.includes(parsed.transactionNumber!);
          if (created) {
            createdIds.push(parsed.transactionNumber!);
          }
          return { id: `tx-${parsed.transactionNumber}`, created };
        },
        markImapSynced: async () => undefined,
      };
      const source = Buffer.from(
        `Content-Type: text/plain; charset=utf-8\r\n\r\n${SAMPLE_SINARMAS_EMAIL}`,
      );
      const createClient = () =>
        createFakeClient({
          uids: [1, 2],
          sources: { 1: source, 2: source },
        });

      // Act
      const first = await syncSinarmasFromImap(
        "user-1",
        config,
        store,
        createClient,
      );
      const second = await syncSinarmasFromImap(
        "user-1",
        config,
        store,
        createClient,
      );

      // Assert
      expect(first.fetched).toBe(2);
      expect(first.created).toBe(1);
      expect(first.mailbox).toBe("INBOX");
      expect(second.created).toBe(0);
    });

    it("opens All Mail and uses Gmail raw search on Gmail hosts", async () => {
      // Setup
      const opened: string[] = [];
      const searchedQueries: object[] = [];
      const store: TransactionStore = {
        upsertSinarmasTransaction: async () => ({ id: "x", created: true }),
        markImapSynced: async () => undefined,
      };
      const gmailConfig: ImapConnectionConfig = {
        ...config,
        host: "imap.gmail.com",
      };
      const createClient = () =>
        createFakeClient({
          uids: [],
          opened,
          searchedQueries,
          mailboxes: [
            { path: "INBOX" },
            { path: "[Gmail]/All Mail", specialUse: "\\All" },
          ],
        });

      // Act
      const result = await syncSinarmasFromImap(
        "user-1",
        gmailConfig,
        store,
        createClient,
      );

      // Assert
      expect(opened).toEqual(["[Gmail]/All Mail"]);
      expect(searchedQueries).toEqual([
        { gmraw: "from:qris-transaction@banksinarmas.com" },
      ]);
      expect(result.mailbox).toBe("[Gmail]/All Mail");
      expect(result.fetched).toBe(0);
    });

    it("treats a false search result as zero matches", async () => {
      // Setup
      const store: TransactionStore = {
        upsertSinarmasTransaction: async () => ({ id: "x", created: true }),
        markImapSynced: async () => undefined,
      };
      const createClient = () => createFakeClient({ uids: false });

      // Act
      const result = await syncSinarmasFromImap(
        "user-1",
        config,
        store,
        createClient,
      );

      // Assert
      expect(result.fetched).toBe(0);
      expect(result.created).toBe(0);
    });

    it("processes newest UIDs first and reports truncation", async () => {
      // Setup
      const fetchedOrder: number[] = [];
      const store: TransactionStore = {
        upsertSinarmasTransaction: async () => ({ id: "x", created: true }),
        markImapSynced: async () => undefined,
      };
      const source = Buffer.from(
        `Content-Type: text/plain; charset=utf-8\r\n\r\n${SAMPLE_SINARMAS_EMAIL}`,
      );
      const createClient = (): ImapClient => {
        const base = createFakeClient({
          uids: [1, 2, 3],
          sources: { 1: source, 2: source, 3: source },
        });
        return {
          ...base,
          fetchOne: async (uid, query, options) => {
            fetchedOrder.push(uid);
            return base.fetchOne(uid, query, options);
          },
        };
      };

      // Act
      const result = await syncSinarmasFromImap(
        "user-1",
        config,
        store,
        createClient,
        2,
      );

      // Assert
      expect(fetchedOrder).toEqual([3, 2]);
      expect(result.fetched).toBe(3);
      expect(result.truncated).toBe(true);
    });

    it("skips messages without a source or transaction number", async () => {
      // Setup
      const store: TransactionStore = {
        upsertSinarmasTransaction: async () => ({ id: "x", created: true }),
        markImapSynced: async () => undefined,
      };
      const createClient = () =>
        createFakeClient({
          uids: [1, 2],
          sources: {
            2: Buffer.from(
              "Content-Type: text/plain; charset=utf-8\r\n\r\nno fields here",
            ),
          },
        });

      // Act
      const result = await syncSinarmasFromImap(
        "user-1",
        config,
        store,
        createClient,
      );

      // Assert
      expect(result.skipped).toBe(2);
      expect(result.created).toBe(0);
    });

    it("records per-message errors without aborting the sync", async () => {
      // Setup
      const store: TransactionStore = {
        upsertSinarmasTransaction: async () => {
          throw new Error("db down");
        },
        markImapSynced: async () => undefined,
      };
      const source = Buffer.from(
        `Content-Type: text/plain; charset=utf-8\r\n\r\n${SAMPLE_SINARMAS_EMAIL}`,
      );
      const createClient = () =>
        createFakeClient({ uids: [1], sources: { 1: source } });

      // Act
      const result = await syncSinarmasFromImap(
        "user-1",
        config,
        store,
        createClient,
      );

      // Assert
      expect(result.errors).toContain("db down");
    });

    it("skips when persist returns null for incomplete parses", async () => {
      // Setup
      const store: TransactionStore = {
        upsertSinarmasTransaction: async () => ({ id: "x", created: true }),
        markImapSynced: async () => undefined,
      };
      const incomplete = `ID Transaksi\nONLY-ID\n`;
      const source = Buffer.from(
        `Content-Type: text/plain; charset=utf-8\r\n\r\n${incomplete}`,
      );
      const createClient = () =>
        createFakeClient({ uids: [1], sources: { 1: source } });

      // Act
      const result = await syncSinarmasFromImap(
        "user-1",
        config,
        store,
        createClient,
      );

      // Assert
      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it("records non-Error throws as a generic message", async () => {
      // Setup
      const store: TransactionStore = {
        upsertSinarmasTransaction: async () => {
          throw "boom";
        },
        markImapSynced: async () => undefined,
      };
      const source = Buffer.from(
        `Content-Type: text/plain; charset=utf-8\r\n\r\n${SAMPLE_SINARMAS_EMAIL}`,
      );
      const createClient = () =>
        createFakeClient({ uids: [1], sources: { 1: source } });

      // Act
      const result = await syncSinarmasFromImap(
        "user-1",
        config,
        store,
        createClient,
      );

      // Assert
      expect(result.errors).toContain("Unknown sync error");
    });
  });

  describe("testImapConnection", () => {
    it("returns ok when connect succeeds", async () => {
      // Act
      const result = await testImapConnection(config, () =>
        createFakeClient({}),
      );

      // Assert
      expect(result).toEqual({ ok: true });
    });

    it("returns an error when connect fails", async () => {
      // Act
      const result = await testImapConnection(config, () =>
        createFakeClient({ connectError: new Error("auth failed") }),
      );

      // Assert
      expect(result).toEqual({ ok: false, error: "auth failed" });
    });

    it("returns a generic error for non-Error connect failures", async () => {
      // Setup
      const client: ImapClient = {
        connect: async () => {
          throw "nope";
        },
        logout: async () => {
          throw new Error("logout failed");
        },
        mailboxOpen: async () => ({}),
        search: async () => [],
        fetchOne: async () => false,
      };

      // Act
      const result = await testImapConnection(config, () => client);

      // Assert
      expect(result).toEqual({ ok: false, error: "IMAP connection failed" });
    });
  });
});
