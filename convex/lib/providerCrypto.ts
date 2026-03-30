/**
 * Provider field-level encryption/decryption (RNF-008).
 *
 * Provides `encryptField()` and `decryptField()` functions for transparently
 * encrypting sensitive provider fields (email, businessName) before storage
 * and decrypting them on read.
 *
 * Uses AES-256-GCM via the Web Crypto API (`crypto.subtle`) which is
 * available in both the Convex V8 runtime and Node.js test environments.
 *
 * Encrypted fields are stored as JSON strings with a versioned format:
 * ```json
 * {"enc":"v1","iv":"<hex>","ct":"<base64>","tag":"<base64>"}
 * ```
 *
 * The `"enc":"v1"` marker allows backward-compatible detection of encrypted
 * values vs. plaintext values written before encryption was enabled.
 *
 * Key is read from the `ENCRYPTION_KEY` environment variable (64-char hex = 32 bytes).
 * If missing, functions log a warning and pass data through unchanged.
 *
 * @module providerCrypto
 */

// ============================================================================
// Types
// ============================================================================

/** Serialized encrypted field stored in the database. */
interface SerializedEncryptedField {
  /** Version marker for format detection. Always "v1". */
  enc: "v1";
  /** Initialization vector as hex string (24 chars = 12 bytes). */
  iv: string;
  /** Ciphertext as base64 string. */
  ct: string;
  /** GCM authentication tag as base64 string. */
  tag: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Algorithm identifier for AES-GCM. */
const ALGORITHM = "AES-GCM";

/** IV length in bytes (standard for AES-GCM). */
const IV_BYTES = 12;

/** Expected key length in hex characters (32 bytes = 64 hex). */
const KEY_HEX_LENGTH = 64;

/** Version marker for serialized encrypted fields. */
const ENC_VERSION = "v1" as const;

// ============================================================================
// Key management
// ============================================================================

/** Hex character regex (case-insensitive). */
const HEX_REGEX = /^[0-9a-f]+$/i;

/**
 * Check whether a valid encryption key is available in the environment.
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
 * Import the encryption key from env var as a CryptoKey for Web Crypto API.
 * Logs a warning and returns null if the key is missing or invalid.
 */
async function getKey(): Promise<CryptoKey | null> {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== KEY_HEX_LENGTH || !HEX_REGEX.test(keyHex)) {
    console.warn(
      JSON.stringify({
        level: "warn",
        module: "providerCrypto",
        message: `ENCRYPTION_KEY is missing or invalid. Expected ${KEY_HEX_LENGTH}-char hex string. Data will be stored unencrypted.`,
        timestamp: Date.now(),
      })
    );
    return null;
  }

  // Convert hex string to ArrayBuffer
  const keyBytes = new Uint8Array(keyHex.length / 2);
  for (let i = 0; i < keyHex.length; i += 2) {
    keyBytes[i / 2] = parseInt(keyHex.substring(i, i + 2), 16);
  }

  return crypto.subtle.importKey("raw", keyBytes, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// ============================================================================
// Encryption / Decryption helpers
// ============================================================================

/**
 * Convert a Uint8Array to a hex string.
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a Uint8Array to a base64 string.
 */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string to a Uint8Array.
 */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// Cache the imported key for performance
// ============================================================================

let cachedKey: CryptoKey | null = null;
let cachedKeyEnvValue: string | undefined = undefined;

/**
 * Reset the cached key. Useful for testing when the env var changes.
 * @internal
 */
export function resetKeyCache(): void {
  cachedKey = null;
  cachedKeyEnvValue = undefined;
}

/**
 * Get the cached crypto key, importing it if necessary.
 * Re-imports if the env var changes.
 */
async function getCachedKey(): Promise<CryptoKey | null> {
  const currentEnvValue = process.env.ENCRYPTION_KEY;
  if (currentEnvValue !== cachedKeyEnvValue) {
    cachedKey = await getKey();
    cachedKeyEnvValue = currentEnvValue;
  }
  return cachedKey;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Detect whether a stored value is an encrypted payload.
 *
 * Checks for the `{"enc":"v1",...}` format marker.
 *
 * @param value - The stored string value to check
 * @returns `true` if the value is an encrypted payload
 */
export function isEncryptedPayload(value: string | undefined): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && parsed.enc === ENC_VERSION;
  } catch {
    return false;
  }
}

/**
 * Encrypt a plaintext string for storage in the database.
 *
 * Returns a JSON string with the encrypted payload. If no valid
 * `ENCRYPTION_KEY` is configured, returns the plaintext unchanged.
 *
 * Returns `undefined` if the input is `undefined` (for optional fields).
 *
 * @param plaintext - The string to encrypt (or undefined for optional fields)
 * @returns JSON-encoded encrypted payload, plaintext (if no key), or undefined
 *
 * @example
 * ```ts
 * const encrypted = encryptField("proveedor@ejemplo.com");
 * // '{"enc":"v1","iv":"a1b2...","ct":"d4e5...","tag":"789a..."}'
 * ```
 */
export async function encryptField(
  plaintext: string | undefined
): Promise<string | undefined> {
  if (plaintext === undefined) {
    return undefined;
  }

  const key = await getCachedKey();
  if (!key) {
    return plaintext;
  }

  // Generate random IV
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(iv);

  // Encode plaintext to bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Encrypt with AES-GCM (tag is appended to ciphertext by Web Crypto)
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: 128 },
    key,
    plaintextBytes
  );

  // Web Crypto returns ciphertext + tag concatenated (last 16 bytes = tag)
  const encrypted = new Uint8Array(encryptedBuffer);
  const ciphertext = encrypted.slice(0, encrypted.length - 16);
  const tag = encrypted.slice(encrypted.length - 16);

  const payload: SerializedEncryptedField = {
    enc: ENC_VERSION,
    iv: toHex(iv),
    ct: toBase64(ciphertext),
    tag: toBase64(tag),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt an encrypted field value back to plaintext.
 *
 * If the value is not an encrypted payload (e.g., stored before encryption
 * was enabled), returns it unchanged for backward compatibility.
 * If no valid `ENCRYPTION_KEY` is configured, logs a warning and returns
 * the value as-is.
 *
 * @param value - The stored string value (encrypted JSON or plaintext)
 * @returns The decrypted plaintext string
 *
 * @example
 * ```ts
 * const plaintext = decryptField('{"enc":"v1","iv":"a1b2...","ct":"d4e5...","tag":"789a..."}');
 * // "proveedor@ejemplo.com"
 * ```
 */
export async function decryptField(value: string | undefined): Promise<string | undefined> {
  if (value === undefined) {
    return undefined;
  }

  // If not encrypted format, return as-is (backward compatibility)
  if (!isEncryptedPayload(value)) {
    return value;
  }

  const key = await getCachedKey();
  if (!key) {
    return value;
  }

  try {
    const payload: SerializedEncryptedField = JSON.parse(value);

    // Parse IV from hex
    const iv = new Uint8Array(payload.iv.length / 2);
    for (let i = 0; i < payload.iv.length; i += 2) {
      iv[i / 2] = parseInt(payload.iv.substring(i, i + 2), 16);
    }

    // Parse ciphertext and tag from base64
    const ciphertext = fromBase64(payload.ct);
    const tag = fromBase64(payload.tag);

    // Reconstruct the buffer that Web Crypto expects (ciphertext + tag concatenated)
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: 128 },
      key,
      combined
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch {
    // If decryption fails (tampered data), throw
    throw new Error("Failed to decrypt field: data may be tampered or corrupted");
  }
}
