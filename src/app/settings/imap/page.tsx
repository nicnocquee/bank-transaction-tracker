import { AppHeader } from "@/components/app-header";
import { ImapSettingsForm } from "@/components/imap-settings-form";
import { ImapSetupGuide } from "@/components/imap-setup-guide";
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
      <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            IMAP settings
          </h1>
          <p className="mt-2 text-ink-muted">
            Connect the inbox where your bank sends payment receipts.
            Credentials are encrypted before storage.
          </p>
        </div>
        <ImapSettingsForm />
        <ImapSetupGuide />
      </main>
    </div>
  );
}
