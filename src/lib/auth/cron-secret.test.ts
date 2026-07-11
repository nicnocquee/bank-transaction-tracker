import { describe, it, expect, afterEach, vi } from "vitest";
import { isAuthorizedCronRequest } from "./cron-secret";

describe("isAuthorizedCronRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("accepts a matching bearer token", () => {
    // Act / Assert
    expect(isAuthorizedCronRequest("Bearer secret-1", "secret-1")).toBe(true);
  });

  it("rejects missing header, wrong scheme, or wrong token", () => {
    // Act / Assert
    expect(isAuthorizedCronRequest(null, "secret-1")).toBe(false);
    expect(isAuthorizedCronRequest("Basic secret-1", "secret-1")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer other", "secret-1")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer", "secret-1")).toBe(false);
  });

  it("rejects when CRON_SECRET is unset", () => {
    // Act / Assert
    expect(isAuthorizedCronRequest("Bearer secret-1", undefined)).toBe(false);
  });

  it("reads CRON_SECRET from the environment by default", () => {
    // Setup
    process.env.CRON_SECRET = "env-secret";

    // Act / Assert
    expect(isAuthorizedCronRequest("Bearer env-secret")).toBe(true);
  });
});
