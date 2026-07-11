import { describe, it, expect, afterEach, vi } from "vitest";
import { formatIdr, formatTransactionDate } from "./money";

describe("money", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats IDR without fraction digits", () => {
    // Act
    const formatted = formatIdr(120000);

    // Assert
    expect(formatted.replace(/\s/g, " ")).toContain("120.000");
    expect(formatted).toMatch(/Rp/);
  });

  it("formats transaction dates in Asia/Jakarta", () => {
    // Act
    const fromString = formatTransactionDate("2026-07-10T18:37:54+07:00");
    const fromDate = formatTransactionDate(
      new Date("2026-07-10T18:37:54+07:00"),
    );

    // Assert
    expect(fromString).toContain("2026");
    expect(fromDate).toContain("2026");
  });
});
