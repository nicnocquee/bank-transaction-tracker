import { CRON_SYNC_BUDGET_MS_DEFAULT } from "@/lib/email/imap-sync";

/**
 * Resolves the cron sync wall-clock budget from an env value.
 * Falls back to {@link CRON_SYNC_BUDGET_MS_DEFAULT} when unset or invalid.
 * @param raw - Raw `CRON_SYNC_BUDGET_MS` env string.
 * @param fallbackMs - Fallback budget in milliseconds.
 */
export function resolveCronSyncBudgetMs(
  raw: string | undefined = process.env.CRON_SYNC_BUDGET_MS,
  fallbackMs: number = CRON_SYNC_BUDGET_MS_DEFAULT,
): number {
  if (raw == null || raw.trim() === "") {
    return fallbackMs;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }
  return Math.floor(parsed);
}
