import { afterEach, describe, expect, it } from "vitest";
import { CRON_SYNC_BUDGET_MS_DEFAULT } from "@/lib/email/imap-sync";
import { resolveCronSyncBudgetMs } from "@/lib/email/resolve-cron-sync-budget";

describe("resolveCronSyncBudgetMs", () => {
  afterEach(() => {
    delete process.env.CRON_SYNC_BUDGET_MS;
  });

  it("returns the default when env is unset", () => {
    // Act
    const budget = resolveCronSyncBudgetMs(undefined);

    // Assert
    expect(budget).toBe(CRON_SYNC_BUDGET_MS_DEFAULT);
  });

  it("parses a positive integer env value", () => {
    // Act
    const budget = resolveCronSyncBudgetMs("12500");

    // Assert
    expect(budget).toBe(12_500);
  });

  it("falls back when the env value is invalid", () => {
    // Act
    const empty = resolveCronSyncBudgetMs("  ");
    const negative = resolveCronSyncBudgetMs("-1");
    const nan = resolveCronSyncBudgetMs("nope");

    // Assert
    expect(empty).toBe(CRON_SYNC_BUDGET_MS_DEFAULT);
    expect(negative).toBe(CRON_SYNC_BUDGET_MS_DEFAULT);
    expect(nan).toBe(CRON_SYNC_BUDGET_MS_DEFAULT);
  });

  it("reads CRON_SYNC_BUDGET_MS from the environment by default", () => {
    // Setup
    process.env.CRON_SYNC_BUDGET_MS = "9000";

    // Act
    const budget = resolveCronSyncBudgetMs();

    // Assert
    expect(budget).toBe(9_000);
  });
});
