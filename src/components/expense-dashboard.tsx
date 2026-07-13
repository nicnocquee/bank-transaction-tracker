"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatIdr, formatTransactionDate } from "@/lib/format/money";
import { fromMonthValue, toMonthValue } from "@/lib/format/period";

type Transaction = {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  amountIdr: number;
  merchant: string | null;
  destinationBank: string | null;
  referenceNumber: string | null;
};

type TransactionsResponse = {
  year: number;
  month: number;
  totalIdr: number;
  transactions: Transaction[];
};

/**
 * Dashboard controls for month filtering, sync, and expense listing.
 */
export function ExpenseDashboard({
  initialYear,
  initialMonth,
  hasImap,
}: {
  initialYear: number;
  initialMonth: number;
  hasImap: boolean;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const monthLabel = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [year, month],
  );

  useEffect(() => {
    void (async () => {
      setError(null);
      const response = await fetch(
        `/api/transactions?year=${year}&month=${month}`,
      );
      if (!response.ok) {
        setError("Could not load transactions");
        return;
      }
      const json = (await response.json()) as TransactionsResponse;
      setData(json);
    })();
  }, [year, month]);

  /**
   * Triggers IMAP sync (or fixture sync when enabled for e2e).
   */
  async function onSync() {
    setPending(true);
    setError(null);
    setSyncMessage(null);
    const endpoint =
      process.env.NEXT_PUBLIC_ALLOW_FIXTURE_SYNC === "1"
        ? "/api/sync/fixture"
        : "/api/sync";
    const response = await fetch(endpoint, { method: "POST" });
    setPending(false);
    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(json?.error ?? "Sync failed");
      return;
    }
    const json = (await response.json()) as {
      result?: {
        created: number;
        fetched: number;
        skipped: number;
        truncated?: boolean;
        errors?: string[];
      };
    };
    if (!json.result) {
      setSyncMessage("Sync complete");
    } else {
      const parts = [
        `Synced ${json.result.fetched} messages`,
        `${json.result.created} new`,
        `${json.result.skipped} skipped`,
      ];
      let message = parts.join(" · ");
      if (json.result.fetched === 0) {
        message +=
          ". No matching bank receipts found, including archived mail. We only import from qris-transaction@banksinarmas.com.";
      } else if (json.result.truncated) {
        message += ". More left to import — sync again.";
      }
      if (json.result.errors?.length) {
        message += ` · ${json.result.errors[0]}`;
      }
      setSyncMessage(message);
    }
    const refresh = await fetch(
      `/api/transactions?year=${year}&month=${month}`,
    );
    if (refresh.ok) {
      setData((await refresh.json()) as TransactionsResponse);
    }
  }

  /**
   * Updates the selected month from the period picker.
   */
  function onPeriodChange(value: string) {
    const parsed = fromMonthValue(value);
    if (!parsed) {
      return;
    }
    setYear(parsed.year);
    setMonth(parsed.month);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 sm:max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight">Expenses</h1>
          <p className="mt-1 text-ink-muted">
            Bank receipts for {monthLabel}. New emails are checked every 5
            minutes — or refresh now.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-initial">
            <label
              className="text-xs font-medium text-ink-muted"
              htmlFor="period"
            >
              Period
            </label>
            <input
              id="period"
              type="month"
              value={toMonthValue(year, month)}
              onChange={(event) => onPeriodChange(event.target.value)}
              className="h-10 w-full rounded-md border border-line bg-panel px-3 sm:w-44"
            />
          </div>
          <button
            type="button"
            disabled={
              pending ||
              (!hasImap && process.env.NEXT_PUBLIC_ALLOW_FIXTURE_SYNC !== "1")
            }
            onClick={() => void onSync()}
            className="h-10 shrink-0 rounded-md bg-accent px-4 font-medium text-white transition-transform duration-150 ease-out active:scale-[0.97] hover:bg-accent-dark disabled:opacity-50"
          >
            {pending ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      {!hasImap && process.env.NEXT_PUBLIC_ALLOW_FIXTURE_SYNC !== "1" ? (
        <p className="rounded-lg border border-line bg-panel p-4 text-sm text-ink-muted">
          Connect your mailbox under{" "}
          <Link
            href="/settings/imap"
            className="text-accent underline underline-offset-2"
          >
            IMAP settings
          </Link>{" "}
          to import bank receipts.
        </p>
      ) : null}

      <div className="rounded-lg border border-line bg-panel p-5">
        <p className="text-sm text-ink-muted">Total this month</p>
        <p className="mt-1 font-mono text-3xl font-medium">
          {formatIdr(data?.totalIdr ?? 0)}
        </p>
      </div>

      {syncMessage ? (
        <p className="text-sm text-accent">{syncMessage}</p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-line text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Merchant</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(data?.transactions ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-ink-muted"
                >
                  No expenses for this month yet.
                </td>
              </tr>
            ) : (
              data?.transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-line/70">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatTransactionDate(tx.transactionDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div>{tx.merchant ?? "—"}</div>
                    <div className="font-mono text-xs text-ink-muted">
                      {tx.transactionNumber}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                    {tx.referenceNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatIdr(tx.amountIdr)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
