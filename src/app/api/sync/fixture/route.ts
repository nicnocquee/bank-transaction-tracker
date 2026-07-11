import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { parseSinarmas } from "@/lib/parsers/sinarmas-parser";
import { persistParsedTransaction } from "@/lib/transactions/persist-transaction";
import { createPrismaTransactionStore } from "@/lib/transactions/prisma-transaction-store";
import { SAMPLE_SINARMAS_EMAIL } from "@/lib/parsers/sinarmas-fixtures";

/**
 * E2E/dev-only sync that upserts the sample Sinarmas fixture without IMAP.
 * Enabled when ALLOW_FIXTURE_SYNC=1.
 */
export async function POST() {
  if (process.env.ALLOW_FIXTURE_SYNC !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseSinarmas(SAMPLE_SINARMAS_EMAIL);
  if (!parsed) {
    return NextResponse.json(
      { error: "Fixture parse failed" },
      { status: 500 },
    );
  }

  const store = createPrismaTransactionStore();
  const first = await persistParsedTransaction(
    store,
    session.user.id,
    parsed,
    "fixture-1",
    SAMPLE_SINARMAS_EMAIL.slice(0, 500),
  );
  const second = await persistParsedTransaction(
    store,
    session.user.id,
    parsed,
    "fixture-1",
    SAMPLE_SINARMAS_EMAIL.slice(0, 500),
  );

  return NextResponse.json({
    result: {
      fetched: 1,
      created: first?.created ? 1 : 0,
      skipped: second?.created ? 0 : 1,
      errors: [] as string[],
    },
  });
}
