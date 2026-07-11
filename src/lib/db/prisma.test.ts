import { afterEach, describe, expect, it, vi } from "vitest";

describe("createPrismaClient / getPrisma", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    const globalForPrisma = globalThis as { prisma?: unknown };
    delete globalForPrisma.prisma;
  });

  it("throws when DATABASE_URL is missing", async () => {
    // Setup
    vi.stubEnv("DATABASE_URL", "");
    const { createPrismaClient } = await import("./prisma");

    // Act / Assert
    expect(() => createPrismaClient(undefined)).toThrow(
      "DATABASE_URL is required",
    );
  });

  it("creates a client when a connection string is provided", async () => {
    // Act
    const { createPrismaClient } = await import("./prisma");
    const client = createPrismaClient(
      "postgresql://tracker:tracker@localhost:5432/bank_transaction_tracker",
    );

    // Assert
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe("function");
    await client.$disconnect();
  });

  it("getPrisma caches the client on globalThis", async () => {
    // Setup
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://tracker:tracker@localhost:5432/bank_transaction_tracker",
    );
    const { getPrisma } = await import("./prisma");

    // Act
    const first = getPrisma();
    const second = getPrisma();

    // Assert
    expect(first).toBe(second);
    await first.$disconnect();
  });

  it("prisma proxy forwards property access to the live client", async () => {
    // Setup
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://tracker:tracker@localhost:5432/bank_transaction_tracker",
    );
    const { prisma, getPrisma } = await import("./prisma");

    // Act
    const proxiedConnect = prisma.$connect;
    const liveConnect = getPrisma().$connect;

    // Assert
    expect(proxiedConnect).toBe(liveConnect);
    await getPrisma().$disconnect();
  });
});
