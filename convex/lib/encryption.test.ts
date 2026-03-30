import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt, isEncryptionAvailable } from "./encryption";

// ============================================================================
// Helpers
// ============================================================================

/** Generate a valid 32-byte hex encryption key (64 hex chars) */
function generateTestKey(): string {
  return randomBytes(32).toString("hex");
}

/** Capture all calls to console.warn */
function captureWarns() {
  const warns: string[] = [];
  const origWarn = console.warn;
  console.warn = (...args: unknown[]) => warns.push(String(args[0]));
  return {
    warns,
    restore() {
      console.warn = origWarn;
    },
  };
}

// ============================================================================
// encrypt / decrypt round-trip tests
// ============================================================================

describe("encryption utility (RNF-008)", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    // Set a valid encryption key for tests
    process.env.ENCRYPTION_KEY = generateTestKey();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  // ------------------------------------------------------------------
  // Round-trip: encrypt then decrypt returns original plaintext
  // ------------------------------------------------------------------
  it("encrypts and decrypts plaintext round-trip", () => {
    const plaintext = "proveedor@ejemplo.com";
    const encrypted = encrypt(plaintext);

    // Encrypted result should have the expected shape
    expect(encrypted).toHaveProperty("iv");
    expect(encrypted).toHaveProperty("ciphertext");
    expect(encrypted).toHaveProperty("authTag");
    expect(typeof encrypted.iv).toBe("string");
    expect(typeof encrypted.ciphertext).toBe("string");
    expect(typeof encrypted.authTag).toBe("string");

    // Decrypt should return the original plaintext
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("round-trips a short string", () => {
    const plaintext = "a";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("round-trips an empty string", () => {
    const plaintext = "";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("round-trips a long multi-line string", () => {
    const plaintext = "línea 1\nlínea 2\nlínea 3\n".repeat(50);
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("round-trips unicode and special characters", () => {
    const plaintext = "Ñoño — café ☕️ 中文 🇦🇷";
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  // ------------------------------------------------------------------
  // Different plaintexts produce different ciphertexts (IV randomization)
  // ------------------------------------------------------------------
  it("different plaintexts produce different ciphertexts", () => {
    const encrypted1 = encrypt("hello");
    const encrypted2 = encrypt("world");

    // Ciphertexts should differ (different plaintexts, random IVs)
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    // IVs should differ (randomly generated each time)
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
  });

  it("same plaintext produces different ciphertexts each time (random IV)", () => {
    const encrypted1 = encrypt("same input");
    const encrypted2 = encrypt("same input");

    // Even with the same input, different IVs mean different ciphertexts
    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);

    // But both should decrypt to the same plaintext
    expect(decrypt(encrypted1)).toBe("same input");
    expect(decrypt(encrypted2)).toBe("same input");
  });

  // ------------------------------------------------------------------
  // Tamper detection: AES-GCM auth tag catches modifications
  // ------------------------------------------------------------------
  it("rejects tampered ciphertext", () => {
    const encrypted = encrypt("sensitive data");

    // Tamper with the ciphertext (flip a bit)
    const tamperedCiphertext =
      encrypted.ciphertext.slice(0, -2) +
      (encrypted.ciphertext.endsWith("00") ? "ff" : "00");

    expect(() =>
      decrypt({ ...encrypted, ciphertext: tamperedCiphertext })
    ).toThrow();
  });

  it("rejects tampered auth tag", () => {
    const encrypted = encrypt("sensitive data");

    // Tamper with the auth tag
    const tamperedAuthTag =
      encrypted.authTag.slice(0, -2) +
      (encrypted.authTag.endsWith("00") ? "ff" : "00");

    expect(() =>
      decrypt({ ...encrypted, authTag: tamperedAuthTag })
    ).toThrow();
  });

  it("rejects tampered IV", () => {
    const encrypted = encrypt("sensitive data");

    // Tamper with the IV
    const tamperedIv =
      encrypted.iv.slice(0, -2) +
      (encrypted.iv.endsWith("00") ? "ff" : "00");

    expect(() =>
      decrypt({ ...encrypted, iv: tamperedIv })
    ).toThrow();
  });

  // ------------------------------------------------------------------
  // Hex string output validation
  // ------------------------------------------------------------------
  it("returns iv, ciphertext, and authTag as hex strings", () => {
    const encrypted = encrypt("test data");

    // All should be valid hex strings
    expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.ciphertext).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.authTag).toMatch(/^[0-9a-f]+$/);

    // IV should be 12 bytes = 24 hex chars (AES-GCM standard IV)
    expect(encrypted.iv).toHaveLength(24);

    // Auth tag should be 16 bytes = 32 hex chars (AES-GCM default tag length)
    expect(encrypted.authTag).toHaveLength(32);
  });
});

// ============================================================================
// Missing ENCRYPTION_KEY handling (VAL-ENC-003)
// ============================================================================

describe("encryption missing key handling (VAL-ENC-003)", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  it("isEncryptionAvailable returns false when key is missing", () => {
    expect(isEncryptionAvailable()).toBe(false);
  });

  it("encrypt returns plaintext unchanged when key is missing", () => {
    const capture = captureWarns();
    try {
      const result = encrypt("test@example.com");
      expect(result).toEqual({
        iv: "",
        ciphertext: "test@example.com",
        authTag: "",
      });
    } finally {
      capture.restore();
    }
  });

  it("decrypt returns ciphertext unchanged when key is missing", () => {
    const capture = captureWarns();
    try {
      const result = decrypt({
        iv: "",
        ciphertext: "test@example.com",
        authTag: "",
      });
      expect(result).toBe("test@example.com");
    } finally {
      capture.restore();
    }
  });

  it("logs a warning when encrypting without a key", () => {
    const capture = captureWarns();
    try {
      encrypt("some data");
      expect(capture.warns.length).toBeGreaterThanOrEqual(1);
      // The warning should mention encryption key
      expect(capture.warns[0]).toMatch(/ENCRYPTION_KEY|encryption/i);
    } finally {
      capture.restore();
    }
  });

  it("logs a warning when decrypting without a key", () => {
    const capture = captureWarns();
    try {
      decrypt({ iv: "", ciphertext: "some data", authTag: "" });
      expect(capture.warns.length).toBeGreaterThanOrEqual(1);
      expect(capture.warns[0]).toMatch(/ENCRYPTION_KEY|encryption/i);
    } finally {
      capture.restore();
    }
  });
});

// ============================================================================
// isEncryptionAvailable
// ============================================================================

describe("isEncryptionAvailable", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  it("returns true when a valid 64-char hex key is set", () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    expect(isEncryptionAvailable()).toBe(true);
  });

  it("returns false when key is missing", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(isEncryptionAvailable()).toBe(false);
  });

  it("returns false when key is empty string", () => {
    process.env.ENCRYPTION_KEY = "";
    expect(isEncryptionAvailable()).toBe(false);
  });

  it("returns false when key is too short", () => {
    process.env.ENCRYPTION_KEY = "abcdef0123456789";
    expect(isEncryptionAvailable()).toBe(false);
  });

  it("returns false when key contains non-hex characters", () => {
    process.env.ENCRYPTION_KEY = "g".repeat(64);
    expect(isEncryptionAvailable()).toBe(false);
  });
});
