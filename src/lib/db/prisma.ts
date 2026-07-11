import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Creates a Prisma client bound to PostgreSQL via the pg driver adapter.
 * @param connectionString - Optional DATABASE_URL override.
 * @returns Configured PrismaClient instance.
 */
export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL,
): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Returns the shared Prisma client, creating it on first use.
 * Lazy init avoids requiring DATABASE_URL at import time (e.g. unit tests).
 * @returns Shared PrismaClient instance.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Shared Prisma client for the Next.js server runtime.
 * Delegates to {@link getPrisma} so modules can import without a live DB.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getPrisma() as object, property, receiver);
  },
});
