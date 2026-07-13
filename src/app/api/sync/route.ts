import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { prisma } from "@/lib/db/prisma";
import { syncSinarmasFromImap } from "@/lib/email/imap-sync";
import { createPrismaTransactionStore } from "@/lib/transactions/prisma-transaction-store";

/**
 * Runs an IMAP sync for the current user and upserts Sinarmas transactions.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.imapConnection.findUnique({
    where: { userId: session.user.id },
  });
  if (!connection || !connection.enabled) {
    return NextResponse.json(
      { error: "Connect IMAP in settings before syncing" },
      { status: 400 },
    );
  }

  try {
    const password = decryptSecret(connection.passwordEncrypted);
    const store = createPrismaTransactionStore();
    const result = await syncSinarmasFromImap(
      session.user.id,
      {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password,
        tls: connection.tls,
      },
      store,
    );

    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sync failed unexpectedly";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
