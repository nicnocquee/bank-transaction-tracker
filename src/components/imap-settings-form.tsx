"use client";

import { FormEvent, useEffect, useState } from "react";

type ImapConnection = {
  host: string;
  port: number;
  username: string;
  tls: boolean;
  lastSyncedAt: string | null;
} | null;

/**
 * IMAP connection settings form with save, test, and disconnect actions.
 */
export function ImapSettingsForm() {
  const [connection, setConnection] = useState<ImapConnection>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/imap");
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { connection: ImapConnection };
      setConnection(data.connection);
    })();
  }, []);

  /**
   * Saves IMAP settings for the current user.
   */
  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      host: String(form.get("host") ?? ""),
      port: Number(form.get("port") ?? 993),
      username: String(form.get("username") ?? ""),
      password: String(form.get("password") ?? ""),
      tls: form.get("tls") === "on",
    };
    const response = await fetch("/api/imap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "Failed to save IMAP settings");
      return;
    }
    const data = (await response.json()) as { connection: ImapConnection };
    setConnection(data.connection);
    setMessage("IMAP settings saved. Password is encrypted at rest.");
    (event.target as HTMLFormElement).reset();
  }

  /**
   * Tests the saved IMAP connection.
   */
  async function onTest() {
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/imap/test", {
      method: "POST",
      body: "{}",
    });
    setPending(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "IMAP test failed");
      return;
    }
    setMessage("IMAP connection succeeded.");
  }

  /**
   * Removes the saved IMAP connection.
   */
  async function onDisconnect() {
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/imap", { method: "DELETE" });
    setPending(false);
    if (!response.ok) {
      setError("Failed to disconnect");
      return;
    }
    setConnection(null);
    setMessage("IMAP connection removed.");
  }

  return (
    <div className="space-y-6">
      {connection ? (
        <div className="rounded-lg border border-line bg-panel p-4 text-sm">
          <p>
            Connected as{" "}
            <span className="font-mono">{connection.username}</span> @{" "}
            {connection.host}:{connection.port}
          </p>
          <p className="mt-1 text-ink-muted">
            Last sync:{" "}
            {connection.lastSyncedAt
              ? new Date(connection.lastSyncedAt).toLocaleString("id-ID")
              : "Never"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void onTest()}
              className="rounded-md border border-line px-3 py-1.5 hover:bg-background"
            >
              Test connection
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void onDisconnect()}
              className="rounded-md border border-danger/40 px-3 py-1.5 text-danger hover:bg-background"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          No mailbox connected yet. Use a Gmail app password or any IMAP host
          that receives mail from{" "}
          <span className="font-mono">qris-transaction@banksinarmas.com</span>.
        </p>
      )}

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-lg border border-line bg-panel p-4"
      >
        <div>
          <label className="mb-1 block text-sm text-ink-muted" htmlFor="host">
            IMAP host
          </label>
          <input
            id="host"
            name="host"
            required
            placeholder="imap.gmail.com"
            defaultValue={connection?.host ?? "imap.gmail.com"}
            className="w-full rounded-md border border-line bg-background px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-ink-muted" htmlFor="port">
              Port
            </label>
            <input
              id="port"
              name="port"
              type="number"
              required
              defaultValue={connection?.port ?? 993}
              className="w-full rounded-md border border-line bg-background px-3 py-2"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                name="tls"
                type="checkbox"
                defaultChecked={connection?.tls ?? true}
              />
              Use TLS
            </label>
          </div>
        </div>
        <div>
          <label
            className="mb-1 block text-sm text-ink-muted"
            htmlFor="username"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            required
            defaultValue={connection?.username ?? ""}
            className="w-full rounded-md border border-line bg-background px-3 py-2"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm text-ink-muted"
            htmlFor="password"
          >
            Password / app password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-md border border-line bg-background px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save IMAP settings"}
        </button>
      </form>

      {message ? <p className="text-sm text-accent">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
