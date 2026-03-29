import { describe, it, expect, afterEach } from "vitest";
import { validateUploadedFile, validateGeminiApiKey, safeJsonParse } from "./validation";

// Helper: create a buffer with specific magic bytes
function magicBuffer(magic: number[], size: number = 1024): Buffer {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < magic.length; i++) {
    buf[i] = magic[i];
  }
  return buf;
}

// Helper: create a valid-ish PDF buffer
function pdfBuffer(size: number = 1024): Buffer {
  return magicBuffer([0x25, 0x50, 0x44, 0x46], size); // %PDF
}

// Helper: create a valid-ish XLSX buffer (ZIP magic + "xl/" directory indicator)
function xlsxBuffer(size: number = 1024): Buffer {
  const buf = magicBuffer([0x50, 0x4b, 0x03, 0x04], size); // PK..
  // Write "xl/" after magic bytes so the XLSX structure check passes
  const xlSignature = Buffer.from("xl/");
  xlSignature.copy(buf, 8);
  return buf;
}

// Helper: create a ZIP buffer WITHOUT "xl/" (generic ZIP / DOCX)
function genericZipBuffer(size: number = 1024): Buffer {
  return magicBuffer([0x50, 0x4b, 0x03, 0x04], size); // PK.. but no xl/
}

// Helper: create a valid-ish XLS buffer
function xlsBuffer(size: number = 1024): Buffer {
  return magicBuffer([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1], size);
}

// ============================================================================
// validateUploadedFile
// ============================================================================

describe("validateUploadedFile", () => {
  it("rejects unsupported MIME type", () => {
    expect(() => validateUploadedFile(pdfBuffer(), "image/png")).toThrow(
      /no soportado/i
    );
  });

  it("rejects empty buffer", () => {
    expect(() => validateUploadedFile(Buffer.alloc(0), "application/pdf")).toThrow(
      /vacío/i
    );
  });

  it("rejects PDF with wrong magic bytes", () => {
    const fake = Buffer.from("this is not a pdf at all");
    expect(() => validateUploadedFile(fake, "application/pdf")).toThrow(
      /PDF válido/i
    );
  });

  it("rejects XLSX with wrong magic bytes", () => {
    const fake = Buffer.from("this is not an xlsx file");
    expect(() => validateUploadedFile(fake, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toThrow(
      /XLSX válido/i
    );
  });

  it("rejects XLS with wrong magic bytes", () => {
    const fake = Buffer.from("this is not an xls file");
    expect(() => validateUploadedFile(fake, "application/vnd.ms-excel")).toThrow(
      /XLS válido/i
    );
  });

  it("accepts valid PDF buffer", () => {
    expect(() => validateUploadedFile(pdfBuffer(), "application/pdf")).not.toThrow();
  });

  it("accepts valid XLSX buffer", () => {
    expect(() =>
      validateUploadedFile(xlsxBuffer(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ).not.toThrow();
  });

  it("accepts valid XLS buffer", () => {
    expect(() =>
      validateUploadedFile(xlsBuffer(), "application/vnd.ms-excel")
    ).not.toThrow();
  });

  it("rejects PDF exceeding 50 MB", () => {
    const oversized = pdfBuffer(51 * 1024 * 1024);
    expect(() => validateUploadedFile(oversized, "application/pdf")).toThrow(
      /límite/i
    );
  });

  it("rejects XLSX exceeding 50 MB", () => {
    const oversized = xlsxBuffer(51 * 1024 * 1024);
    expect(() =>
      validateUploadedFile(oversized, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ).toThrow(/límite/i);
  });

  it("handles PDF with BOM prefix (magic bytes within first 10)", () => {
    // BOM (EF BB BF) followed by %PDF
    const buf = Buffer.alloc(1024);
    buf[0] = 0xef;
    buf[1] = 0xbb;
    buf[2] = 0xbf;
    buf[3] = 0x25; // %
    buf[4] = 0x50; // P
    buf[5] = 0x44; // D
    buf[6] = 0x46; // F
    expect(() => validateUploadedFile(buf, "application/pdf")).not.toThrow();
  });

  it("rejects XLSX that is a generic ZIP without xl/ directory", () => {
    expect(() =>
      validateUploadedFile(genericZipBuffer(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ).toThrow(/ZIP genérico/i);
  });
});

// ============================================================================
// validateGeminiApiKey
// ============================================================================

describe("validateGeminiApiKey", () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it("throws when GEMINI_API_KEY is not set", () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => validateGeminiApiKey()).toThrow(/GEMINI_API_KEY no está configurada/i);
  });

  it("passes when GEMINI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "test-key";
    expect(() => validateGeminiApiKey()).not.toThrow();
  });
});

// ============================================================================
// safeJsonParse
// ============================================================================

describe("safeJsonParse", () => {
  it("parses valid JSON", () => {
    const result = safeJsonParse('{"key": "value"}', "Test");
    expect(result).toEqual({ key: "value" });
  });

  it("throws descriptive error for invalid JSON", () => {
    expect(() => safeJsonParse("not json at all", "Stage 1")).toThrow(
      /Stage 1.*no es JSON/i
    );
  });

  it("includes stage label in error", () => {
    expect(() => safeJsonParse("{broken", "MyStage")).toThrow(/MyStage/);
  });

  it("includes response preview in error", () => {
    const badResponse = "Error: file is password protected";
    expect(() => safeJsonParse(badResponse, "Test")).toThrow(
      /password protected/
    );
  });

  it("truncates long previews", () => {
    const longResponse = "x".repeat(500);
    try {
      safeJsonParse(longResponse, "Test");
    } catch (error) {
      const message = (error as Error).message;
      // Preview should be truncated to ~200 chars + "..."
      expect(message).toContain("...");
      // Full 500 chars should NOT be in the message
      expect(message.length).toBeLessThan(500);
    }
  });

  it("preserves JSON parse error details", () => {
    try {
      safeJsonParse("{invalid", "Test");
    } catch (error) {
      // Error message should contain the original parse error info
      expect((error as Error).message).toMatch(/position 1/i);
    }
  });
});
