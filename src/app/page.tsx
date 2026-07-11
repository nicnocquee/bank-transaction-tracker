import { AppHeader } from "@/components/app-header";
import { ExpenseDashboard } from "@/components/expense-dashboard";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const imap = await prisma.imapConnection.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  const now = new Date();

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ExpenseDashboard
          initialYear={now.getFullYear()}
          initialMonth={now.getMonth() + 1}
          hasImap={!!imap}
        />
      </main>
    </div>
  );
}
