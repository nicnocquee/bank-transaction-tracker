import "dotenv/config";
import cron from "node-cron";
import { createPrismaImapConnectionLoader } from "../src/lib/email/prisma-imap-connection-loader";
import { syncAllEnabledUsers } from "../src/lib/email/sync-all-users";
import { createPrismaTransactionStore } from "../src/lib/transactions/prisma-transaction-store";

const schedule = process.env.CRON_SCHEDULE ?? "*/5 * * * *";

/**
 * Runs one full sync pass for all enabled IMAP users and logs the summary.
 */
async function runSyncPass(): Promise<void> {
  const startedAt = new Date().toISOString();
  console.log(`[cron] sync starting at ${startedAt}`);
  try {
    const summary = await syncAllEnabledUsers(
      createPrismaImapConnectionLoader(),
      createPrismaTransactionStore(),
    );
    console.log(
      `[cron] sync finished attempted=${summary.usersAttempted} ok=${summary.usersSucceeded} failed=${summary.usersFailed}`,
    );
  } catch (error) {
    console.error("[cron] sync failed", error);
  }
}

if (!cron.validate(schedule)) {
  console.error(`[cron] invalid CRON_SCHEDULE: ${schedule}`);
  process.exit(1);
}

console.log(`[cron] scheduling IMAP sync with "${schedule}"`);
cron.schedule(schedule, () => {
  void runSyncPass();
});

void runSyncPass();
