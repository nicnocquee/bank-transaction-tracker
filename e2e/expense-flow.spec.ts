import { expect, test } from "@playwright/test";
import path from "node:path";

const evidenceDir = path.join(process.cwd(), "evidence");

test.describe("Bank transaction tracker e2e", () => {
  test("register → IMAP settings → fixture sync → see expense", async ({
    page,
  }) => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = "password123";

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/Password/).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Expenses" })).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({
      path: path.join(evidenceDir, "browser-dashboard-empty.png"),
      fullPage: true,
    });

    await page.getByRole("link", { name: "IMAP" }).click();
    await expect(
      page.getByRole("heading", { name: "IMAP settings" }),
    ).toBeVisible();
    await expect(
      page.getByText("Bank Transaction Tracker").first(),
    ).toBeVisible();
    await expect(
      page.getByText("Need help finding these values?"),
    ).toBeVisible();
    await expect(page.getByText("Enable")).toBeHidden();
    await page.screenshot({
      path: path.join(evidenceDir, "browser-imap-settings.png"),
      fullPage: true,
    });

    await page.getByText("Need help finding these values?").click();
    await expect(page.getByRole("heading", { name: "Gmail" })).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "browser-imap-help-expanded.png"),
      fullPage: true,
    });

    await page.getByLabel("IMAP host").fill("imap.example.com");
    await page.getByLabel("Username").fill(email);
    await page.getByLabel(/Password \/ app password/).fill("app-password");
    await page.getByRole("button", { name: "Save IMAP settings" }).click();
    await expect(page.getByText(/IMAP settings saved/i)).toBeVisible({
      timeout: 10_000,
    });
    await page.screenshot({
      path: path.join(evidenceDir, "browser-imap-saved.png"),
      fullPage: true,
    });

    await page.getByRole("link", { name: "Expenses" }).click();
    await page.getByLabel("Year").fill("2026");
    await page.locator("#month").selectOption("7");
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByText(/FIESTA STEAK/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("cell", { name: /120\.000/ })).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "browser-expense-synced.png"),
      fullPage: true,
    });
  });
});
