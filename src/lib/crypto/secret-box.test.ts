import { describe, it, expect, afterEach, vi } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  resolveImapSecretKey,
} from "./secret-box";

const VALID_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("secret-box", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.IMAP_SECRET_KEY;
  });

  describe("resolveImapSecretKey", () => {
    it("returns a 32-byte buffer for a valid hex key", () => {
      // Act
      const key = resolveImapSecretKey(VALID_KEY);

      // Assert
      expect(key).toHaveLength(32);
    });

    it("reads IMAP_SECRET_KEY from the environment by default", () => {
      // Setup
      process.env.IMAP_SECRET_KEY = VALID_KEY;

      // Act
      const key = resolveImapSecretKey();

      // Assert
      expect(key).toHaveLength(32);
    });

    it("throws when the key is missing or malformed", () => {
      // Act / Assert
      expect(() => resolveImapSecretKey(undefined)).toThrow(/64-character/);
      expect(() => resolveImapSecretKey("short")).toThrow(/64-character/);
    });
  });

  describe("encryptSecret / decryptSecret", () => {
    it("round-trips a plaintext secret", () => {
      // Setup
      const key = resolveImapSecretKey(VALID_KEY);

      // Act
      const encrypted = encryptSecret("app-password", key);
      const decrypted = decryptSecret(encrypted, key);

      // Assert
      expect(decrypted).toBe("app-password");
      expect(encrypted).not.toContain("app-password");
    });

    it("rejects truncated payloads", () => {
      // Setup
      const key = resolveImapSecretKey(VALID_KEY);

      // Act / Assert
      expect(() => decryptSecret("YQ==", key)).toThrow(/Invalid encrypted/);
    });

    it("uses the environment key when none is provided", () => {
      // Setup
      process.env.IMAP_SECRET_KEY = VALID_KEY;

      // Act
      const encrypted = encryptSecret("secret-value");
      const decrypted = decryptSecret(encrypted);

      // Assert
      expect(decrypted).toBe("secret-value");
    });
  });
});
