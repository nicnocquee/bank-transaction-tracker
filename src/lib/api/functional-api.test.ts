import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@/lib/auth/password";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { upsertSinarmasTransaction } from "@/lib/transactions/prisma-transaction-store";
import { parseSinarmas } from "@/lib/parsers/sinarmas-parser";
import { SAMPLE_SINARMAS_EMAIL } from "@/lib/parsers/sinarmas-fixtures";

process.env.IMAP_SECRET_KEY =
  process.env.IMAP_SECRET_KEY ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

/**
 * Creates an isolated test user with a unique email.
 */
async function createUser(label: string) {
  const email = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  return db.user.create({
    data: {
      email,
      passwordHash: await hashPassword("password123", 4),
    },
  });
}

describe("functional API / data isolation", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for functional tests");
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("encrypts IMAP passwords at rest and never stores plaintext", async () => {
    // Setup
    const user = await createUser("imap");
    const plaintext = "gmail-app-password";

    // Act
    const connection = await db.imapConnection.create({
      data: {
        userId: user.id,
        host: "imap.gmail.com",
        port: 993,
        username: user.email,
        passwordEncrypted: encryptSecret(plaintext),
        tls: true,
      },
    });

    // Assert
    expect(connection.passwordEncrypted).not.toContain(plaintext);
    expect(decryptSecret(connection.passwordEncrypted)).toBe(plaintext);

    await db.user.delete({ where: { id: user.id } });
  });

  it("upserts Sinarmas transactions idempotently per user", async () => {
    // Setup
    const user = await createUser("sync");
    const parsed = parseSinarmas(SAMPLE_SINARMAS_EMAIL)!;

    // Act
    const first = await upsertSinarmasTransaction(db, user.id, parsed, "1");
    const second = await upsertSinarmasTransaction(db, user.id, parsed, "1");
    const count = await db.transaction.count({ where: { userId: user.id } });

    // Assert
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(count).toBe(1);

    await db.user.delete({ where: { id: user.id } });
  });

  it("isolates transactions between users (no IDOR by transaction number)", async () => {
    // Setup
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const parsed = parseSinarmas(SAMPLE_SINARMAS_EMAIL)!;

    await upsertSinarmasTransaction(db, alice.id, parsed, "a1");
    await upsertSinarmasTransaction(
      db,
      bob.id,
      {
        ...parsed,
        amount: 999,
        merchant: "BOB MERCHANT",
      },
      "b1",
    );

    // Act
    const aliceRows = await db.transaction.findMany({
      where: { userId: alice.id },
    });
    const bobRows = await db.transaction.findMany({
      where: { userId: bob.id },
    });
    const cross = await db.transaction.findFirst({
      where: {
        userId: bob.id,
        merchant: "FIESTA STEAK SUMARECON 3",
      },
    });

    // Assert
    expect(aliceRows).toHaveLength(1);
    expect(aliceRows[0]?.amountIdr).toBe(120000);
    expect(bobRows).toHaveLength(1);
    expect(bobRows[0]?.amountIdr).toBe(999);
    expect(cross).toBeNull();

    await db.user.delete({ where: { id: alice.id } });
    await db.user.delete({ where: { id: bob.id } });
  });

  it("rejects duplicate account emails at the database layer", async () => {
    // Setup
    const user = await createUser("dup");

    // Act / Assert
    await expect(
      db.user.create({
        data: {
          email: user.email,
          passwordHash: await hashPassword("password123", 4),
        },
      }),
    ).rejects.toThrow();

    await db.user.delete({ where: { id: user.id } });
  });
});
