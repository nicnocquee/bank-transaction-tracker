import { AppHeader } from "@/components/app-header";
import { ImapSettingsForm } from "@/components/imap-settings-form";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function ImapSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">IMAP settings</h1>
        <p className="mt-2 mb-6 text-ink-muted">
          Connect the mailbox that receives{" "}
          <span className="font-mono text-sm">
            qris-transaction@banksinarmas.com
          </span>{" "}
          receipts. Credentials are encrypted before storage.
        </p>
        <ImapSettingsForm />
      </main>
    </div>
  );
}
