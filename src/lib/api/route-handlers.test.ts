import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth/auth";
import { POST as registerPost } from "@/app/api/register/route";
import { GET as meGet } from "@/app/api/me/route";
import {
  POST as imapPost,
  GET as imapGet,
  DELETE as imapDelete,
} from "@/app/api/imap/route";
import { POST as imapTestPost } from "@/app/api/imap/test/route";
import { POST as syncPost } from "@/app/api/sync/route";
import { GET as transactionsGet } from "@/app/api/transactions/route";
import { POST as fixturePost } from "@/app/api/sync/fixture/route";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret } from "@/lib/crypto/secret-box";
import {
  testImapConnection,
  syncSinarmasFromImap,
} from "@/lib/email/imap-sync";
import { SAMPLE_SINARMAS_EMAIL } from "@/lib/parsers/sinarmas-fixtures";

vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/email/imap-sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email/imap-sync")>(
    "@/lib/email/imap-sync",
  );
  return {
    ...actual,
    testImapConnection: vi.fn(),
    syncSinarmasFromImap: vi.fn(),
  };
});

const authMock = auth as unknown as ReturnType<typeof vi.fn>;
const testImapMock = testImapConnection as unknown as ReturnType<typeof vi.fn>;
const syncMock = syncSinarmasFromImap as unknown as ReturnType<typeof vi.fn>;

/**
 * Builds a JSON Request for route-handler tests.
 */
function jsonRequest(url: string, body?: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("API route handlers", () => {
  afterEach(() => {
    vi.clearAllMocks();
    authMock.mockReset();
    testImapMock.mockReset();
    syncMock.mockReset();
  });

  it("registers a user and rejects duplicates", async () => {
    // Setup
    const email = `route-${Date.now()}@example.com`;

    // Act
    const created = await registerPost(
      jsonRequest("http://localhost/api/register", {
        email,
        password: "password123",
      }),
    );
    const duplicate = await registerPost(
      jsonRequest("http://localhost/api/register", {
        email,
        password: "password123",
      }),
    );
    const invalid = await registerPost(
      jsonRequest("http://localhost/api/register", {
        email: "bad",
        password: "short",
      }),
    );

    // Assert
    expect(created.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(invalid.status).toBe(400);

    await prisma.user.delete({ where: { email } });
  });

  it("requires auth for me / imap / sync / transactions", async () => {
    // Setup
    authMock.mockResolvedValue(null);

    // Act / Assert
    expect((await meGet()).status).toBe(401);
    expect((await imapGet()).status).toBe(401);
    expect(
      (await imapPost(jsonRequest("http://localhost/api/imap", {}))).status,
    ).toBe(401);
    expect((await imapDelete()).status).toBe(401);
    expect(
      (await imapTestPost(jsonRequest("http://localhost/api/imap/test", {})))
        .status,
    ).toBe(401);
    expect((await syncPost()).status).toBe(401);
    expect(
      (await transactionsGet(new Request("http://localhost/api/transactions")))
        .status,
    ).toBe(401);
  });

  it("saves encrypted IMAP settings and lists month transactions for the session user only", async () => {
    // Setup
    const email = `imap-route-${Date.now()}@example.com`;
    const register = await registerPost(
      jsonRequest("http://localhost/api/register", {
        email,
        password: "password123",
      }),
    );
    const { user } = (await register.json()) as {
      user: { id: string; email: string };
    };
    authMock.mockResolvedValue({ user: { id: user.id, email } });

    // Act
    const saved = await imapPost(
      jsonRequest("http://localhost/api/imap", {
        host: "imap.gmail.com",
        port: 993,
        username: email,
        password: "app-pass-secret",
        tls: true,
      }),
    );
    const listed = await imapGet();
    const row = await prisma.imapConnection.findUnique({
      where: { userId: user.id },
    });

    process.env.ALLOW_FIXTURE_SYNC = "1";
    const fixture = await fixturePost();
    const txs = await transactionsGet(
      new Request("http://localhost/api/transactions?year=2026&month=7"),
    );
    const payload = (await txs.json()) as {
      totalIdr: number;
      transactions: Array<{ merchant: string | null }>;
    };

    // Assert
    expect(saved.status).toBe(200);
    expect(listed.status).toBe(200);
    expect(row?.passwordEncrypted).toBeTruthy();
    expect(decryptSecret(row!.passwordEncrypted)).toBe("app-pass-secret");
    expect(fixture.status).toBe(200);
    expect(payload.totalIdr).toBe(120000);
    expect(payload.transactions[0]?.merchant).toContain("FIESTA");

    await prisma.user.delete({ where: { id: user.id } });
  });

  it("tests IMAP via injectable collaborator and syncs with mocked IMAP", async () => {
    // Setup
    const email = `sync-route-${Date.now()}@example.com`;
    const register = await registerPost(
      jsonRequest("http://localhost/api/register", {
        email,
        password: "password123",
      }),
    );
    const { user } = (await register.json()) as {
      user: { id: string; email: string };
    };
    authMock.mockResolvedValue({ user: { id: user.id, email } });
    await imapPost(
      jsonRequest("http://localhost/api/imap", {
        host: "imap.example.com",
        port: 993,
        username: email,
        password: "secret",
        tls: true,
      }),
    );
    testImapMock.mockResolvedValue({ ok: true });
    syncMock.mockResolvedValue({
      fetched: 1,
      created: 1,
      skipped: 0,
      errors: [],
    });

    // Act
    const tested = await imapTestPost(
      jsonRequest("http://localhost/api/imap/test", {}),
    );
    const synced = await syncPost();

    // Assert
    expect(tested.status).toBe(200);
    expect(synced.status).toBe(200);
    expect(syncMock).toHaveBeenCalledOnce();

    await prisma.user.delete({ where: { id: user.id } });
  });

  it("returns merchant HTML as JSON text without an HTML content type", async () => {
    // Setup
    const email = `xss-${Date.now()}@example.com`;
    const register = await registerPost(
      jsonRequest("http://localhost/api/register", {
        email,
        password: "password123",
      }),
    );
    const { user } = (await register.json()) as {
      user: { id: string; email: string };
    };
    authMock.mockResolvedValue({ user: { id: user.id, email } });
    await prisma.transaction.create({
      data: {
        userId: user.id,
        transactionNumber: "XSS1",
        transactionDate: new Date("2026-07-10T18:37:54+07:00"),
        amountIdr: 1000,
        merchant: "<script>alert(1)</script>",
        bank: "sinarmas",
      },
    });

    // Act
    const txs = await transactionsGet(
      new Request("http://localhost/api/transactions?year=2026&month=7"),
    );
    const body = await txs.text();

    // Assert
    expect(body).toContain("<script>alert(1)</script>");
    expect(txs.headers.get("content-type")).toContain("application/json");
    void SAMPLE_SINARMAS_EMAIL;

    await prisma.user.delete({ where: { id: user.id } });
  });

  it("returns 404 for fixture sync when ALLOW_FIXTURE_SYNC is disabled", async () => {
    // Setup
    const previous = process.env.ALLOW_FIXTURE_SYNC;
    process.env.ALLOW_FIXTURE_SYNC = "0";
    authMock.mockResolvedValue({
      user: { id: "user-1", email: "a@example.com" },
    });

    // Act
    const response = await fixturePost();

    // Assert
    expect(response.status).toBe(404);
    process.env.ALLOW_FIXTURE_SYNC = previous;
  });
});
