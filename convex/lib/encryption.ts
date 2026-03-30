/**
 * AES-256-GCM encryption/decryption utility (RNF-008).
 *
 * Provides `encrypt()` and `decrypt()` functions using Node.js built-in
 * `crypto` module. The encryption key is read from the `ENCRYPTION_KEY`
 * environment variable (64-character hex string = 32 bytes = 256 bits).
 *
 * When the key is missing or invalid, functions log a warning and pass
 * data through unchanged — the application never crashes due to missing
 * encryption configuration.
 *
 * Cipher: AES-256-GCM (authenticated encryption)
 * IV:     12 random bytes per encryption call (hex-encoded)
 * Tag:    16-byte authentication tag (hex-encoded)
 *
 * @module encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// ============================================================================
// Types
// ============================================================================

/** Encrypted payload returned by `encrypt()`. */
export interface EncryptedPayload {
  /** Initialization vector as hex string (24 chars = 12 bytes) */
  iv: string;
  /** Ciphertext as hex string */
  ciphertext: string;
  /** GCM authentication tag as hex string (32 chars = 16 bytes) */
  authTag: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Algorithm used for encryption and decryption. */
const ALGORITHM = "aes-256-gcm";

/** IV length in bytes (standard for AES-GCM). */
const IV_BYTES = 12;

/** Authentication tag length in bytes (default for AES-GCM). */
const AUTH_TAG_BYTES = 16;

/** Expected key length in hex characters (32 bytes = 64 hex). */
const KEY_HEX_LENGTH = 64;

// ============================================================================
// Key validation
// ============================================================================

/** Hex character regex (case-insensitive). */
const HEX_REGEX = /^[0-9a-f]+$/i;

/**
 * Check whether a valid encryption key is available in the environment.
 *
 * A valid key is a 64-character hexadecimal string (32 bytes / 256 bits).
 *
 * @returns `true` when `ENCRYPTION_KEY` is set and valid, `false` otherwise
 */
export function isEncryptionAvailable(): boolean {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== KEY_HEX_LENGTH) {
    return false;
  }
  return HEX_REGEX.test(key);
}

/**
 * Retrieve the encryption key as a Buffer, or `null` if unavailable/invalid.
 * Logs a warning when the key is missing or malformed.
 */
function getKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== KEY_HEX_LENGTH || !HEX_REGEX.test(key)) {
    console.warn(
      JSON.stringify({
        level: "warn",
        module: "encryption",
        message: `ENCRYPTION_KEY is missing or invalid. Expected ${KEY_HEX_LENGTH}-char hex string. Data will be stored unencrypted.`,
        timestamp: Date.now(),
      })
    );
    return null;
  }
  return Buffer.from(key, "hex");
}

// ============================================================================
// Encrypt
// ============================================================================

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * When no valid `ENCRYPTION_KEY` is configured, the function logs a warning
 * and returns the plaintext unchanged (with empty `iv` and `authTag`).
 *
 * @param plaintext - The string to encrypt
 * @returns An {@link EncryptedPayload} with hex-encoded iv, ciphertext, and authTag.
 *          If the key is missing, returns `{ iv: "", ciphertext: plaintext, authTag: "" }`.
 *
 * @example
 * ```ts
 * const encrypted = encrypt("proveedor@ejemplo.com");
 * // { iv: "a1b2c3...", ciphertext: "d4e5f6...", authTag: "789abc..." }
 * ```
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey();
  if (!key) {
    return { iv: "", ciphertext: plaintext, authTag: "" };
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

// ============================================================================
// Decrypt
// ============================================================================

/**
 * Decrypt an {@link EncryptedPayload} back to the original plaintext.
 *
 * When no valid `ENCRYPTION_KEY` is configured, the function logs a warning
 * and returns `payload.ciphertext` as-is (passthrough mode).
 *
 * @param payload - The encrypted payload with iv, ciphertext, and authTag
 * @returns The original plaintext string
 * @throws Error if the payload has been tampered with (GCM auth failure)
 *
 * @example
 * ```ts
 * const plaintext = decrypt({ iv: "a1b2...", ciphertext: "d4e5...", authTag: "789a..." });
 * // "proveedor@ejemplo.com"
 * ```
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getKey();
  if (!key) {
    return payload.ciphertext;
  }

  const iv = Buffer.from(payload.iv, "hex");
  const ciphertext = Buffer.from(payload.ciphertext, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
