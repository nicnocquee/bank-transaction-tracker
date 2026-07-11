import { describe, it, expect, afterEach, vi } from "vitest";
import {
  syncAllEnabledUsers,
  type EnabledImapConnection,
  type ImapConnectionLoader,
} from "./sync-all-users";
import type { TransactionStore } from "@/lib/transactions/persist-transaction";
import type { SyncResult } from "./imap-sync";

describe("syncAllEnabledUsers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs every enabled connection and aggregates successes", async () => {
    // Setup
    const connections: EnabledImapConnection[] = [
      {
        userId: "u1",
        host: "imap.example.com",
        port: 993,
        username: "a@example.com",
        passwordEncrypted: "enc-a",
        tls: true,
      },
      {
        userId: "u2",
        host: "imap.example.com",
        port: 993,
        username: "b@example.com",
        passwordEncrypted: "enc-b",
        tls: true,
      },
    ];
    const loader: ImapConnectionLoader = {
      listEnabled: async () => connections,
    };
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
    };
    const syncUser = vi.fn(
      async (): Promise<SyncResult> => ({
        fetched: 1,
        created: 1,
        skipped: 0,
        errors: [],
      }),
    );

    // Act
    const result = await syncAllEnabledUsers(
      loader,
      store,
      (payload) => `plain-${payload}`,
      syncUser,
    );

    // Assert
    expect(result.usersAttempted).toBe(2);
    expect(result.usersSucceeded).toBe(2);
    expect(result.usersFailed).toBe(0);
    expect(syncUser).toHaveBeenCalledTimes(2);
    expect(syncUser.mock.calls[0]?.[1]).toMatchObject({
      password: "plain-enc-a",
    });
  });

  it("records per-user failures without aborting the batch", async () => {
    // Setup
    const loader: ImapConnectionLoader = {
      listEnabled: async () => [
        {
          userId: "ok",
          host: "h",
          port: 993,
          username: "u",
          passwordEncrypted: "x",
          tls: true,
        },
        {
          userId: "bad",
          host: "h",
          port: 993,
          username: "u",
          passwordEncrypted: "y",
          tls: true,
        },
      ],
    };
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
    };
    const syncUser = vi.fn(async (userId: string): Promise<SyncResult> => {
      if (userId === "bad") {
        throw new Error("imap down");
      }
      return { fetched: 0, created: 0, skipped: 0, errors: [] };
    });

    // Act
    const result = await syncAllEnabledUsers(
      loader,
      store,
      () => "secret",
      syncUser,
    );

    // Assert
    expect(result.usersSucceeded).toBe(1);
    expect(result.usersFailed).toBe(1);
    expect(result.outcomes.find((o) => o.userId === "bad")?.error).toBe(
      "imap down",
    );
  });

  it("records a generic error for non-Error throws", async () => {
    // Setup
    const loader: ImapConnectionLoader = {
      listEnabled: async () => [
        {
          userId: "u1",
          host: "h",
          port: 993,
          username: "u",
          passwordEncrypted: "x",
          tls: true,
        },
      ],
    };
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
    };

    // Act
    const result = await syncAllEnabledUsers(
      loader,
      store,
      () => "secret",
      async () => {
        throw "boom";
      },
    );

    // Assert
    expect(result.usersFailed).toBe(1);
    expect(result.outcomes[0]?.error).toBe("Unknown sync error");
  });

  it("returns zeros when no connections are enabled", async () => {
    // Setup
    const loader: ImapConnectionLoader = {
      listEnabled: async () => [],
    };
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
    };

    // Act
    const result = await syncAllEnabledUsers(loader, store);

    // Assert
    expect(result).toEqual({
      usersAttempted: 0,
      usersSucceeded: 0,
      usersFailed: 0,
      outcomes: [],
    });
  });
});
