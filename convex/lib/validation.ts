/**
 * File validation and JSON parsing helpers for the ingestion pipeline.
 *
 * These are pure functions with no Node.js built-in dependencies,
 * so this file does not need "use node";
 */

// Magic bytes for file type verification
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK.. (ZIP) — also DOCX, PPTX
const XLS_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]; // OLE2 compound doc

// Gemini Files API limit (50 MB)
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/**
 * Check if buffer starts with the given magic bytes within the first `searchWindow` bytes.
 */
function startsWithMagic(buffer: Buffer, magic: number[], searchWindow: number): boolean {
  for (let offset = 0; offset <= searchWindow - magic.length; offset++) {
    let match = true;
    for (let i = 0; i < magic.length; i++) {
      if (buffer[offset + i] !== magic[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

/**
 * Validate an uploaded file's integrity:
 * 1. MIME type must be supported (PDF, XLS, XLSX)
 * 2. File must not be empty
 * 3. Magic bytes must match declared MIME type
 * 4. XLSX files must contain "xl/" directory (distinguishes from generic ZIP/DOCX)
 * 5. File must not exceed 50 MB
 */
export function validateUploadedFile(buffer: Buffer, declaredMime: string): void {
  // 1. MIME type check
  if (!SUPPORTED_MIME_TYPES.has(declaredMime)) {
    throw new Error(
      `Tipo de archivo no soportado: ${declaredMime}. Solo se aceptan PDF y Excel (.xls, .xlsx)`
    );
  }

  // 2. Empty file check
  if (buffer.byteLength === 0) {
    throw new Error("El archivo está vacío (0 bytes)");
  }

  // 3. Magic byte validation
  if (declaredMime === "application/pdf") {
    if (!startsWithMagic(buffer, PDF_MAGIC, 10)) {
      throw new Error("El archivo no es un PDF válido. Verificá que el archivo no esté corrupto.");
    }
  } else if (declaredMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    // XLSX is a ZIP — check PK magic first
    if (!startsWithMagic(buffer, XLSX_MAGIC, 4)) {
      throw new Error("El archivo no es un XLSX válido. Verificá que sea un archivo Excel real.");
    }
    // Secondary check: XLSX ZIP must contain "xl/" directory
    const xlsxSignature = Buffer.from("xl/");
    if (!buffer.includes(xlsxSignature)) {
      throw new Error(
        "El archivo parece ser un ZIP genérico, no es un archivo Excel real. " +
        "Verificá que sea un archivo .xlsx y no un .zip o .docx renombrado."
      );
    }
  } else if (declaredMime === "application/vnd.ms-excel") {
    // XLS (old binary format)
    if (!startsWithMagic(buffer, XLS_MAGIC, 6)) {
      throw new Error("El archivo no es un XLS válido. Verificá que sea un archivo Excel real.");
    }
  }

  // 4. Size limit (applies to all types)
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `El archivo supera el límite de ${MAX_FILE_BYTES / (1024 * 1024)} MB`
    );
  }
}

/**
 * Check that the GEMINI_API_KEY environment variable exists and is set.
 */
export function validateGeminiApiKey(): void {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está configurada. Contactá al administrador");
  }
}

/**
 * Wraps JSON.parse with descriptive error messages.
 * If Gemini returns non-JSON (error message, truncated output, etc.),
 * this produces an actionable error instead of a cryptic SyntaxError.
 */
export function safeJsonParse(text: string, stageLabel: string): unknown {
  try {
    return JSON.parse(text);
  } catch (parseError) {
    const preview = text.length > 200 ? text.slice(0, 200) + "..." : text;
    throw new Error(
      `${stageLabel}: Gemini devolvió una respuesta que no es JSON válido. ` +
      `Error: ${parseError instanceof Error ? parseError.message : String(parseError)}. ` +
      `Response: ${preview}`
    );
  }
}
