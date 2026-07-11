import { describe, it, expect, afterEach, vi } from "vitest";
import { fromMonthValue, toMonthValue } from "./period";

describe("period", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats and parses month values", () => {
    // Act / Assert
    expect(toMonthValue(2026, 7)).toBe("2026-07");
    expect(fromMonthValue("2026-07")).toEqual({ year: 2026, month: 7 });
  });

  it("rejects invalid month values", () => {
    // Act / Assert
    expect(fromMonthValue("2026-13")).toBeNull();
    expect(fromMonthValue("nope")).toBeNull();
  });
});
