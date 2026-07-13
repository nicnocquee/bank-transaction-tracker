import { describe, it, expect, afterEach, vi } from "vitest";
import {
  syncAllEnabledUsers,
  type EnabledImapConnection,
  type ImapConnectionLoader,
  type SyncUserFn,
} from "./sync-all-users";
import type { TransactionStore } from "@/lib/transactions/persist-transaction";

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
      listSyncedSourceMessageIds: async () => [],
    };
    const syncUser = vi.fn<SyncUserFn>(async () => ({
      fetched: 1,
      created: 1,
      skipped: 0,
      errors: [],
      mailbox: "INBOX",
      truncated: false,
    }));

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
      listSyncedSourceMessageIds: async () => [],
    };
    const syncUser = vi.fn<SyncUserFn>(async (userId) => {
      if (userId === "bad") {
        throw new Error("imap down");
      }
      return {
        fetched: 0,
        created: 0,
        skipped: 0,
        errors: [],
        mailbox: "INBOX",
        truncated: false,
      };
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
      listSyncedSourceMessageIds: async () => [],
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
      listSyncedSourceMessageIds: async () => [],
    };

    // Act
    const result = await syncAllEnabledUsers(loader, store);

    // Assert
    expect(result).toEqual({
      usersAttempted: 0,
      usersSucceeded: 0,
      usersFailed: 0,
      stoppedEarly: false,
      outcomes: [],
    });
  });

  it("stops starting new users once the deadline is reached", async () => {
    // Setup
    let now = 1_000;
    const connections: EnabledImapConnection[] = [
      {
        userId: "u1",
        host: "h",
        port: 993,
        username: "a",
        passwordEncrypted: "a",
        tls: true,
      },
      {
        userId: "u2",
        host: "h",
        port: 993,
        username: "b",
        passwordEncrypted: "b",
        tls: true,
      },
    ];
    const loader: ImapConnectionLoader = {
      listEnabled: async () => connections,
    };
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
      listSyncedSourceMessageIds: async () => [],
    };
    const syncUser = vi.fn<SyncUserFn>(async () => {
      now = 5_000;
      return {
        fetched: 0,
        created: 0,
        skipped: 0,
        errors: [],
        mailbox: "INBOX",
        truncated: false,
      };
    });

    // Act
    const result = await syncAllEnabledUsers(
      loader,
      store,
      () => "secret",
      syncUser,
      undefined,
      { endsAt: 2_000, now: () => now },
    );

    // Assert
    expect(syncUser).toHaveBeenCalledTimes(1);
    expect(result.usersAttempted).toBe(1);
    expect(result.stoppedEarly).toBe(true);
  });

  it("marks stoppedEarly when a user sync hits the deadline", async () => {
    // Setup
    const loader: ImapConnectionLoader = {
      listEnabled: async () => [
        {
          userId: "u1",
          host: "h",
          port: 993,
          username: "a",
          passwordEncrypted: "a",
          tls: true,
        },
        {
          userId: "u2",
          host: "h",
          port: 993,
          username: "b",
          passwordEncrypted: "b",
          tls: true,
        },
      ],
    };
    const store: TransactionStore = {
      upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
      markImapSynced: async () => undefined,
      listSyncedSourceMessageIds: async () => [],
    };
    const syncUser = vi.fn<SyncUserFn>(async () => ({
      fetched: 2,
      created: 1,
      skipped: 0,
      errors: [],
      mailbox: "INBOX",
      truncated: true,
      deadlineReached: true,
    }));

    // Act
    const result = await syncAllEnabledUsers(
      loader,
      store,
      () => "secret",
      syncUser,
      undefined,
      { endsAt: Date.now() + 60_000 },
    );

    // Assert
    expect(syncUser).toHaveBeenCalledTimes(1);
    expect(result.stoppedEarly).toBe(true);
    expect(result.usersSucceeded).toBe(1);
  });
});
