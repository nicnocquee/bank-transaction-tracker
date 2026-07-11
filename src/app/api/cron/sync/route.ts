import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron-secret";
import { createPrismaImapConnectionLoader } from "@/lib/email/prisma-imap-connection-loader";
import { syncAllEnabledUsers } from "@/lib/email/sync-all-users";
import { createPrismaTransactionStore } from "@/lib/transactions/prisma-transaction-store";

/**
 * Server cron endpoint: syncs IMAP for every user with an enabled connection.
 * Authorize with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await syncAllEnabledUsers(
    createPrismaImapConnectionLoader(),
    createPrismaTransactionStore(),
  );

  return NextResponse.json({ summary });
}

/**
 * Allows GET for simple uptime/cron pingers that only support GET.
 */
export async function GET(request: Request) {
  return POST(request);
}
