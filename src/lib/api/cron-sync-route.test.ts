import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/sync-all-users", () => ({
  syncAllEnabledUsers: vi.fn(),
}));

vi.mock("@/lib/email/prisma-imap-connection-loader", () => ({
  createPrismaImapConnectionLoader: vi.fn(() => ({
    listEnabled: async () => [],
  })),
}));

vi.mock("@/lib/transactions/prisma-transaction-store", () => ({
  createPrismaTransactionStore: vi.fn(() => ({
    upsertSinarmasTransaction: async () => ({ id: "1", created: true }),
    markImapSynced: async () => undefined,
    listSyncedSourceMessageIds: async () => [],
  })),
}));

import { GET, POST } from "@/app/api/cron/sync/route";
import { syncAllEnabledUsers } from "@/lib/email/sync-all-users";

const syncAllMock = syncAllEnabledUsers as unknown as ReturnType<typeof vi.fn>;

describe("cron sync route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("rejects requests without a valid CRON_SECRET bearer token", async () => {
    // Setup
    process.env.CRON_SECRET = "cron-secret";

    // Act
    const response = await POST(
      new Request("http://localhost/api/cron/sync", { method: "POST" }),
    );

    // Assert
    expect(response.status).toBe(401);
    expect(syncAllMock).not.toHaveBeenCalled();
  });

  it("runs syncAllEnabledUsers when authorized", async () => {
    // Setup
    process.env.CRON_SECRET = "cron-secret";
    syncAllMock.mockResolvedValue({
      usersAttempted: 1,
      usersSucceeded: 1,
      usersFailed: 0,
      stoppedEarly: false,
      outcomes: [],
    });

    // Act
    const response = await POST(
      new Request("http://localhost/api/cron/sync", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );
    const body = (await response.json()) as {
      summary: { usersAttempted: number };
    };

    // Assert
    expect(response.status).toBe(200);
    expect(body.summary.usersAttempted).toBe(1);
    expect(syncAllMock).toHaveBeenCalledOnce();
    const deadline = syncAllMock.mock.calls[0]?.[5] as
      | { endsAt: number }
      | undefined;
    expect(deadline?.endsAt).toBeGreaterThan(Date.now() - 1_000);
  });

  it("supports GET for simple cron pingers", async () => {
    // Setup
    process.env.CRON_SECRET = "cron-secret";
    syncAllMock.mockResolvedValue({
      usersAttempted: 0,
      usersSucceeded: 0,
      usersFailed: 0,
      stoppedEarly: false,
      outcomes: [],
    });

    // Act
    const response = await GET(
      new Request("http://localhost/api/cron/sync", {
        method: "GET",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );

    // Assert
    expect(response.status).toBe(200);
  });
});
