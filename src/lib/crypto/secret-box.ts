import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Resolves the 32-byte AES key from a hex-encoded environment variable.
 * @param secretKeyHex - 64-character hex string (defaults to IMAP_SECRET_KEY).
 * @returns Raw key bytes.
 */
export function resolveImapSecretKey(
  secretKeyHex: string | undefined = process.env.IMAP_SECRET_KEY,
): Buffer {
  if (!secretKeyHex || !/^[0-9a-fA-F]{64}$/.test(secretKeyHex)) {
    throw new Error(
      "IMAP_SECRET_KEY must be a 64-character hex string (32 bytes)",
    );
  }
  return Buffer.from(secretKeyHex, "hex");
}

/**
 * Encrypts a plaintext secret with AES-256-GCM.
 * @param plaintext - Secret to encrypt (e.g. IMAP password).
 * @param key - Optional 32-byte key; defaults to IMAP_SECRET_KEY.
 * @returns Base64 payload: iv + authTag + ciphertext.
 */
export function encryptSecret(
  plaintext: string,
  key: Buffer = resolveImapSecretKey(),
): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypts a payload produced by {@link encryptSecret}.
 * @param payload - Base64 iv + authTag + ciphertext.
 * @param key - Optional 32-byte key; defaults to IMAP_SECRET_KEY.
 * @returns Decrypted plaintext.
 */
export function decryptSecret(
  payload: string,
  key: Buffer = resolveImapSecretKey(),
): string {
  const buffer = Buffer.from(payload, "base64");
  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
