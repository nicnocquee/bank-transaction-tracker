import { describe, it, expect, afterEach, vi } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hashes and verifies a matching password", async () => {
    // Act
    const hash = await hashPassword("correct-horse", 4);
    const ok = await verifyPassword("correct-horse", hash);

    // Assert
    expect(hash).not.toBe("correct-horse");
    expect(ok).toBe(true);
  });

  it("rejects a non-matching password", async () => {
    // Setup
    const hash = await hashPassword("correct-horse", 4);

    // Act
    const ok = await verifyPassword("wrong-password", hash);

    // Assert
    expect(ok).toBe(false);
  });
});
