import bcrypt from "bcryptjs";

const DEFAULT_ROUNDS = 12;

/**
 * Hashes a plaintext password with bcrypt.
 * @param password - Plaintext password.
 * @param rounds - bcrypt cost factor (default 12).
 * @returns Password hash string.
 */
export async function hashPassword(
  password: string,
  rounds: number = DEFAULT_ROUNDS,
): Promise<string> {
  return bcrypt.hash(password, rounds);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 * @param password - Plaintext password.
 * @param passwordHash - Stored bcrypt hash.
 * @returns True when the password matches.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
