import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Lists the current user's transactions for a month, with a total.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number.parseInt(
    searchParams.get("year") ?? String(now.getFullYear()),
    10,
  );
  const month = Number.parseInt(
    searchParams.get("month") ?? String(now.getMonth() + 1),
    10,
  );

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json(
      { error: "Invalid year or month" },
      { status: 400 },
    );
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: session.user.id,
      transactionDate: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { transactionDate: "desc" },
  });

  const totalIdr = transactions.reduce((sum, tx) => sum + tx.amountIdr, 0);

  return NextResponse.json({
    year,
    month,
    totalIdr,
    transactions,
  });
}
