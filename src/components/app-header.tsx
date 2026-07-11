import Link from "next/link";
import { auth, signOut } from "@/lib/auth/auth";

/**
 * Top navigation for authenticated app pages.
 */
export async function AppHeader() {
  const session = await auth();

  return (
    <header className="border-b border-line bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Sinarmas Tracker
        </Link>
        <nav className="flex items-center gap-4 text-sm text-ink-muted">
          <Link href="/" className="hover:text-foreground">
            Expenses
          </Link>
          <Link href="/settings/imap" className="hover:text-foreground">
            IMAP
          </Link>
          {session?.user?.email ? (
            <span className="hidden sm:inline font-mono text-xs">
              {session.user.email}
            </span>
          ) : null}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-1.5 text-foreground hover:bg-background"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
