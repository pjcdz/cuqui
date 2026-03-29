"use node";

import { action, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import * as fs from "node:fs/promises";
import * as crypto from "node:crypto";
import {
  GoogleGenAI,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import {
  DocumentMetadataSchema,
  DocumentRowsSchema,
  ProductBatchResponseSchema,
  type DocumentMetadata,
  type DocumentRow,
  type DocumentRows,
  type PageMetadata,
  type ProductBatchContext,
  type ProductBatchResponse,
  type ProductExtraction,
  DOCUMENT_METADATA_JSON_SCHEMA,
  DOCUMENT_ROWS_JSON_SCHEMA,
  PRODUCT_BATCH_JSON_SCHEMA,
  DOCUMENT_METADATA_PROMPT,
  DOCUMENT_ROWS_PROMPT,
  PRODUCT_BATCH_PROMPT,
} from "./lib/schemas";
import { validateUploadedFile, validateGeminiApiKey, safeJsonParse } from "./lib/validation";
import { createLogger } from "./lib/logger";

// Model configuration
const STAGE_1_MODEL = "gemini-3.1-pro";
const STAGE_2_MODEL = "gemini-3.1-pro";
const STAGE_3_MODEL = "gemini-3.1-flash-lite-preview";
const MAX_RETRIES = 3;
const BATCH_SIZE = 10;
const GEMINI_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 120; // 4 minutes max wait for file ACTIVE
const MIN_CONFIDENCE_FOR_AUTO_OK = 0.5;

// ============================================================================
// Progress helper
// ============================================================================

async function updateIngestionProgress(
  ctx: ActionCtx,
  ingestionId: Id<"ingestionRuns">,
  providerId: string,
  patch: {
    status?: string;
    progressPercent?: number;
    message?: string;
    currentBatch?: number;
    totalBatches?: number;
    processedRows?: number;
    totalRows?: number;
    errorMessage?: string;
    completedAt?: number;
    fileSha256?: string;
    geminiFileName?: string;
    geminiFileUri?: string;
    geminiFileMimeType?: string;
    metadataJson?: string;
    rowsJson?: string;
    // Result counters
    processedCount?: number;
    needsReviewCount?: number;
    failedProductsCount?: number;
    failedBatchesJson?: string;
    durationMs?: number;
  }
) {
  await ctx.runMutation(internal.ingestionProgress.updateInternal, {
    ingestionId,
    providerId,
    ...patch,
  });
}

// ============================================================================
// Timeout wrapper for Gemini API calls
// ============================================================================

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ============================================================================
// Generic retry helper
// ============================================================================

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(
    `${label} failed after ${MAX_RETRIES} attempts: ${lastError?.message ?? "unknown error"}`
  );
}

// ============================================================================
// Gemini Files API polling
// ============================================================================

async function pollUntilActive(
  ai: GoogleGenAI,
  fileName: string,
): Promise<{ name: string; uri: string; mimeType: string }> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const file = await ai.files.get({ name: fileName });

    if (file.state === "ACTIVE" && file.uri && file.mimeType) {
      return { name: file.name!, uri: file.uri, mimeType: file.mimeType };
    }

    if (file.state === "FAILED") {
      throw new Error(
        `Gemini Files API upload failed: ${file.error ?? "unknown error"}`
      );
    }

    // Still PROCESSING — wait and retry
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Gemini Files API file did not become ACTIVE after ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`
  );
}

// ============================================================================
// Stage 1: Extract Document Metadata
// ============================================================================

async function extractDocumentMetadata(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string
): Promise<DocumentMetadata> {
  return withRetry("Stage 1", async () => {
    const response = await withTimeout(
      ai.models.generateContent({
        model: STAGE_1_MODEL,
        contents: createUserContent([
          createPartFromUri(fileUri, mimeType),
          DOCUMENT_METADATA_PROMPT,
        ]),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: DOCUMENT_METADATA_JSON_SCHEMA,
        },
      }),
      GEMINI_TIMEOUT_MS,
      "Stage 1"
    );

    if (!response.text) {
      throw new Error("Stage 1 did not return text");
    }

    return DocumentMetadataSchema.parse(safeJsonParse(response.text, "Stage 1"));
  });
}

// ============================================================================
// Stage 2: Extract Row-Based Representation
// ============================================================================

async function extractDocumentRows(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string,
  metadata: DocumentMetadata
): Promise<DocumentRows> {
  return withRetry("Stage 2", async () => {
    const response = await withTimeout(
      ai.models.generateContent({
        model: STAGE_2_MODEL,
        contents: createUserContent([
          createPartFromUri(fileUri, mimeType),
          DOCUMENT_ROWS_PROMPT(metadata),
        ]),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: DOCUMENT_ROWS_JSON_SCHEMA,
        },
      }),
      GEMINI_TIMEOUT_MS,
      "Stage 2"
    );

    if (!response.text) {
      throw new Error("Stage 2 did not return text");
    }

    const result = DocumentRowsSchema.parse(safeJsonParse(response.text, "Stage 2"));
    const flattenedRows = flattenDocumentRows(result);

    if (flattenedRows.length !== result.totalRowCount) {
      throw new Error(
        `Stage 2 returned mismatched totalRowCount: expected ${result.totalRowCount}, got ${flattenedRows.length}`
      );
    }

    const rowIds = new Set(flattenedRows.map((row) => row.rowId));
    if (rowIds.size !== flattenedRows.length) {
      throw new Error("Stage 2 returned duplicate row IDs");
    }

    return result;
  });
}

// ============================================================================
// Stage 3: Process Batches of Rows
// ============================================================================

function flattenDocumentRows(documentRows: DocumentRows): DocumentRow[] {
  return documentRows.pages.flatMap((page) => page.rows);
}

function createBatches(rows: DocumentRow[], batchSize: number = BATCH_SIZE): DocumentRow[][] {
  const batches: DocumentRow[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }
  return batches;
}

function getPageMetadataForBatch(
  metadata: DocumentMetadata,
  batchRows: DocumentRow[]
): PageMetadata[] {
  const batchPageNumbers = new Set(batchRows.map((row) => row.pageNumber));
  return metadata.pages.filter((page) => batchPageNumbers.has(page.pageNumber));
}

function buildBatchContext(
  batchRows: DocumentRow[],
  batchIndex: number,
  totalBatches: number
): ProductBatchContext {
  const rowIds = batchRows.map((row) => row.rowId);
  const pageNumbers = [...new Set(batchRows.map((row) => row.pageNumber))].sort(
    (a, b) => a - b
  );

  return {
    batchId: `batch-${batchIndex}-${rowIds[0] ?? "empty"}-${rowIds[rowIds.length - 1] ?? "empty"}`,
    batchIndex,
    totalBatches,
    rowIds,
    pageNumbers,
  };
}

function arraysEqual<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateBatchContext(
  result: ProductBatchResponse,
  expectedBatchContext: ProductBatchContext
) {
  const { batchContext } = result;

  if (batchContext.batchId !== expectedBatchContext.batchId) {
    throw new Error(
      `Stage 3 batch ${expectedBatchContext.batchIndex} returned mismatched batchId: ${batchContext.batchId}`
    );
  }

  if (batchContext.batchIndex !== expectedBatchContext.batchIndex) {
    throw new Error(
      `Stage 3 batch ${expectedBatchContext.batchIndex} returned mismatched batchIndex: ${batchContext.batchIndex}`
    );
  }

  if (batchContext.totalBatches !== expectedBatchContext.totalBatches) {
    throw new Error(
      `Stage 3 batch ${expectedBatchContext.batchIndex} returned mismatched totalBatches: ${batchContext.totalBatches}`
    );
  }

  if (!arraysEqual(batchContext.rowIds, expectedBatchContext.rowIds)) {
    throw new Error(
      `Stage 3 batch ${expectedBatchContext.batchIndex} returned mismatched rowIds`
    );
  }

  if (!arraysEqual(batchContext.pageNumbers, expectedBatchContext.pageNumbers)) {
    throw new Error(
      `Stage 3 batch ${expectedBatchContext.batchIndex} returned mismatched pageNumbers`
    );
  }
}

async function processBatch(
  ai: GoogleGenAI,
  metadata: DocumentMetadata,
  batchRows: DocumentRow[],
  batchIndex: number,
  totalBatches: number
): Promise<ProductBatchResponse> {
  const batchContext = buildBatchContext(batchRows, batchIndex, totalBatches);
  const pageMetadata = getPageMetadataForBatch(metadata, batchRows);

  return withRetry(`Stage 3 batch ${batchIndex}`, async () => {
    const response = await withTimeout(
      ai.models.generateContent({
        model: STAGE_3_MODEL,
        contents: createUserContent([
          PRODUCT_BATCH_PROMPT(metadata, pageMetadata, batchContext, batchRows),
        ]),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: PRODUCT_BATCH_JSON_SCHEMA,
        },
      }),
      GEMINI_TIMEOUT_MS,
      `Stage 3 batch ${batchIndex}`
    );

    if (!response.text) {
      throw new Error(`Stage 3 batch ${batchIndex} did not return text`);
    }

    const result = ProductBatchResponseSchema.parse(safeJsonParse(response.text, `Stage 3 batch ${batchIndex}`));
    validateBatchContext(result, batchContext);

    const validRowIds = new Set(batchRows.map((row) => row.rowId));
    for (const item of result.items) {
      if (!validRowIds.has(item.sourceRowId)) {
        throw new Error(
          `Stage 3 batch ${batchIndex} returned item with invalid sourceRowId: ${item.sourceRowId}`
        );
      }
    }

    return result;
  });
}

// ============================================================================
// Normalization & Persistence
// ============================================================================

type NormalizedFields = {
  normalizedPrice?: number;
  quantity?: number;
  unitOfMeasure?: "litro" | "ml" | "kg" | "g" | "unidad";
  multiplier?: number;
};

function calculateNormalizedFields(extraction: ProductExtraction): NormalizedFields {
  if (!extraction.packaging) {
    return {};
  }

  const { price, packaging } = extraction;
  const { amount, type } = price;
  const { netQuantity, netUnit, unitsPerPack } = packaging;

  if (!Number.isFinite(amount) || amount <= 0) {
    return {};
  }

  if (netQuantity === undefined || netUnit === undefined) {
    return {};
  }

  const multiplier = unitsPerPack && unitsPerPack > 1 ? unitsPerPack : undefined;
  const totalQuantity = multiplier ? netQuantity * multiplier : netQuantity;

  if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) {
    return {};
  }

  switch (type) {
    case "per-unit":
      if (netUnit !== "unidad") {
        return {};
      }
      return {
        normalizedPrice: amount,
        quantity: 1,
        unitOfMeasure: "unidad",
        multiplier,
      };
    case "per-pack":
    case "retail":
    case "wholesale":
      if (netUnit === "ml") {
        const quantityInLiters = totalQuantity / 1000;
        return quantityInLiters > 0
          ? {
              normalizedPrice: amount / quantityInLiters,
              quantity: quantityInLiters,
              unitOfMeasure: "litro",
              multiplier,
            }
          : {};
      }
      if (netUnit === "g") {
        const quantityInKg = totalQuantity / 1000;
        return quantityInKg > 0
          ? {
              normalizedPrice: amount / quantityInKg,
              quantity: quantityInKg,
              unitOfMeasure: "kg",
              multiplier,
            }
          : {};
      }
      return {
        normalizedPrice: amount / totalQuantity,
        quantity: totalQuantity,
        unitOfMeasure: netUnit,
        multiplier,
      };
    case "per-kg":
      return {
        normalizedPrice: amount,
        quantity: 1,
        unitOfMeasure: "kg",
      };
    case "per-liter":
      return {
        normalizedPrice: amount,
        quantity: 1,
        unitOfMeasure: "litro",
      };
    default:
      return {};
  }
}

function buildPresentation(extraction: ProductExtraction): string {
  if (!extraction.packaging) {
    return "N/A";
  }

  const { packagingType, netQuantity, netUnit, unitsPerPack } = extraction.packaging;
  if (netQuantity === undefined || netUnit === undefined) {
    return packagingType;
  }
  const multiPackPrefix = unitsPerPack && unitsPerPack > 1 ? `${unitsPerPack} x ` : "";
  return `${packagingType} ${multiPackPrefix}${netQuantity} ${netUnit}`;
}

function sanitizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 32);
}

function normalizeProduct(
  extraction: ProductExtraction,
  ingestionRunId: Id<"ingestionRuns">,
  providerId: string
): { product: Record<string, unknown>; needsReview: boolean } | { error: string } {
  if (extraction.price.amount <= 0) {
    return { error: `Invalid price amount: ${extraction.price.amount}` };
  }

  if (extraction.confidence < 0 || extraction.confidence > 1) {
    return { error: `Invalid confidence: ${extraction.confidence}` };
  }

  const forcedReasons: string[] = [];

  if (extraction.confidence < MIN_CONFIDENCE_FOR_AUTO_OK) {
    forcedReasons.push(`Low confidence: ${extraction.confidence.toFixed(2)} < ${MIN_CONFIDENCE_FOR_AUTO_OK}`);
  }

  if (!extraction.packaging) {
    forcedReasons.push("Missing packaging information");
  }

  const normalized = calculateNormalizedFields(extraction);

  if (extraction.packaging && normalized.normalizedPrice === undefined) {
    forcedReasons.push("Could not calculate normalized price");
  }

  const cleanName = extraction.canonicalName?.trim();
  if (!cleanName || cleanName.toLowerCase() === "unknown" || cleanName.length < 3) {
    forcedReasons.push(`Generic or empty product name: "${cleanName}"`);
  }

  const reviewStatus: "ok" | "needs_review" =
    forcedReasons.length > 0 ? "needs_review" : extraction.status;

  const ambiguityNotes = [
    ...(extraction.ambiguityNotes ?? []),
    ...forcedReasons,
  ].slice(0, 16);

  const product: Record<string, unknown> = {
    name: cleanName || extraction.rawText.trim() || "Unknown product",
    brand: extraction.brand.trim() || "unknown",
    presentation: buildPresentation(extraction),
    price: extraction.price.amount,
    category: extraction.category.trim() || "uncategorized",
    tags: sanitizeTags(extraction.tags),
    providerId,
    ingestionRunId,
    sourceRowId: extraction.sourceRowId,
    rawText: extraction.rawText,
    ...(cleanName ? { canonicalName: cleanName } : {}),
    ...(extraction.subcategory ? { subcategory: extraction.subcategory.trim() } : {}),
    ...(extraction.packaging?.packagingType ? { packagingType: extraction.packaging.packagingType } : {}),
    ...(extraction.packaging?.saleFormat ? { saleFormat: extraction.packaging.saleFormat } : {}),
    priceType: extraction.price.type,
    confidence: extraction.confidence,
    reviewStatus,
    ...(ambiguityNotes.length ? { ambiguityNotes } : {}),
    ...(normalized.normalizedPrice !== undefined && Number.isFinite(normalized.normalizedPrice) && normalized.normalizedPrice > 0
      ? { normalizedPrice: normalized.normalizedPrice }
      : {}),
    ...(normalized.unitOfMeasure ? { unitOfMeasure: normalized.unitOfMeasure } : {}),
    ...(normalized.quantity !== undefined ? { quantity: normalized.quantity } : {}),
    ...(normalized.multiplier !== undefined ? { multiplier: normalized.multiplier } : {}),
  };

  return {
    product,
    needsReview: reviewStatus === "needs_review",
  };
}

// ============================================================================
// Action 1: ingestCatalog
//   Upload file, poll until ACTIVE, run Stage 1 + Stage 2,
//   store intermediate state. Does NOT process batches.
// ============================================================================

export const ingestCatalog = action({
  args: {
    ingestionId: v.id("ingestionRuns"),
    fileBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    // Early check: GEMINI_API_KEY must be configured
    validateGeminiApiKey();

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const startTime = Date.now();
    const providerId = identity.tokenIdentifier;
    const buffer = Buffer.from(args.fileBase64, "base64");
    const tempPath = `/tmp/${Date.now()}-${Math.random().toString(16).slice(2)}.upload`;

    // Validate file integrity (magic bytes, size, emptiness)
    validateUploadedFile(buffer, args.mimeType);

    // Compute hash for duplicate detection
    const fileSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Check for recent duplicate uploads
    const duplicates = await ctx.runQuery(internal.ingestionProgress.findByProviderAndHash, {
      providerId,
      fileSha256,
    });

    if (duplicates.length > 0) {
      throw new Error(
        `Este archivo ya fue procesado recientemente. ` +
        `Si creés que es un error, esperá 24 horas o contactá soporte.`
      );
    }

    await updateIngestionProgress(ctx, args.ingestionId, providerId, {
      status: "uploading",
      progressPercent: 5,
      message: "Subiendo archivo a Gemini Files API...",
      processedRows: 0,
      fileSha256,
    });

    let uploadedFileName: string | undefined;

    const log = createLogger("pipeline", { runId: args.ingestionId, providerId });

    await fs.writeFile(tempPath, buffer);

    try {
      // Upload to Gemini Files API
      const uploadedFile = await ai.files.upload({
        file: tempPath,
        config: { mimeType: args.mimeType },
      });

      uploadedFileName = uploadedFile.name;

      if (!uploadedFile.name || !uploadedFile.mimeType) {
        throw new Error("File upload did not return required name or mimeType");
      }

      log.info("File uploaded to Gemini Files API", { geminiFileName: uploadedFile.name });

      // Poll until the file is ACTIVE
      await updateIngestionProgress(ctx, args.ingestionId, providerId, {
        status: "polling",
        progressPercent: 10,
        message: "Esperando que Gemini procese el archivo...",
        geminiFileName: uploadedFile.name,
        geminiFileMimeType: uploadedFile.mimeType,
      });

      const activeFile = await pollUntilActive(ai, uploadedFile.name);
      log.info("File ACTIVE on Gemini Files API", { uri: activeFile.uri });

      await updateIngestionProgress(ctx, args.ingestionId, providerId, {
        status: "stage_1",
        progressPercent: 15,
        message: "Extrayendo metadatos del documento...",
        geminiFileUri: activeFile.uri,
      });

      // Stage 1: Extract document metadata
      log.info("Stage 1 started — extracting metadata");
      const metadata = await extractDocumentMetadata(ai, activeFile.uri, activeFile.mimeType);
      log.info("Stage 1 complete", { pages: metadata.pages.length });

      await updateIngestionProgress(ctx, args.ingestionId, providerId, {
        status: "stage_2",
        progressPercent: 35,
        message: "Extrayendo filas del documento...",
      });

      // Stage 2: Extract row-based representation
      log.info("Stage 2 started — extracting row representation");
      const documentRows = await extractDocumentRows(ai, activeFile.uri, activeFile.mimeType, metadata);
      const flattenedRows = flattenDocumentRows(documentRows);
      log.info("Stage 2 complete — rows extracted", { totalRows: flattenedRows.length });

      // Handle documents with no recognizable product rows
      if (flattenedRows.length === 0) {
        const duration = Date.now() - startTime;
        log.info("No product rows found in document");

        await updateIngestionProgress(ctx, args.ingestionId, providerId, {
          status: "completed",
          progressPercent: 100,
          message: "El documento no contiene filas de productos reconocibles",
          processedRows: 0,
          totalRows: 0,
          completedAt: Date.now(),
          processedCount: 0,
          needsReviewCount: 0,
          failedProductsCount: 0,
          failedBatchesJson: "[]",
          durationMs: duration,
        });

        return {
          ingestionId: args.ingestionId,
          totalBatches: 0,
          totalRows: 0,
          metadata: {
            documentType: metadata.documentType,
            pages: metadata.pages.length,
            ambiguities: metadata.ambiguityNotes?.length || 0,
          },
        };
      }

      // Store intermediate state in ingestionRuns so processBatches can pick it up
      const batches = createBatches(flattenedRows, BATCH_SIZE);
      log.info("Stage 2 complete — batches ready for processing", { totalBatches: batches.length, totalRows: documentRows.totalRowCount });

      await updateIngestionProgress(ctx, args.ingestionId, providerId, {
        status: "ready_for_batch",
        progressPercent: 50,
        message: `Listo para procesar ${batches.length} batches...`,
        currentBatch: 0,
        totalBatches: batches.length,
        processedRows: 0,
        totalRows: documentRows.totalRowCount,
        metadataJson: JSON.stringify(metadata),
        rowsJson: JSON.stringify(documentRows),
      });

      return {
        ingestionId: args.ingestionId,
        totalBatches: batches.length,
        totalRows: documentRows.totalRowCount,
        metadata: {
          documentType: metadata.documentType,
          pages: metadata.pages.length,
          ambiguities: metadata.ambiguityNotes?.length || 0,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de ingesta";
      await updateIngestionProgress(ctx, args.ingestionId, providerId, {
        status: "failed",
        progressPercent: 100,
        message: "La ingesta falló",
        errorMessage: message,
        completedAt: Date.now(),
      });
      throw error;
    } finally {
      await fs.unlink(tempPath).catch(() => null);

      if (uploadedFileName) {
        try {
          await ai.files.delete({ name: uploadedFileName });
        } catch (error) {
          log.error("Failed to delete remote file from Gemini", { geminiFileName: uploadedFileName, error: String(error) });
        }
      }
    }
  },
});

// ============================================================================
// Action 2: processBatches
//   Reads stored metadata/rows from ingestionRun, processes all Stage 3 batches.
//   Supports starting from a specific batch index for resume.
// ============================================================================

export const processBatches = action({
  args: {
    ingestionId: v.id("ingestionRuns"),
    startFromBatch: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    ingestionId: Id<"ingestionRuns">;
    processed: number;
    needsReview: number;
    failedProducts: number;
    failedBatches: number[];
    totalBatches: number;
    totalRows: number;
    duration: number;
    metadata: { documentType: string; pages: number; ambiguities: number };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    validateGeminiApiKey();

    const providerId = identity.tokenIdentifier;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    // Read stored state from ingestionRun
    const run = await ctx.runQuery(internal.ingestionProgress.getIngestionState, {
      ingestionId: args.ingestionId,
    });

    if (!run) {
      throw new Error("Ingestion run not found");
    }

    if (run.providerId !== providerId) {
      throw new Error("Not authorized to process this ingestion run");
    }

    if (!run.metadataJson || !run.rowsJson) {
      throw new Error("Ingestion run has no stored metadata or rows — run ingestCatalog first");
    }

    const metadata = DocumentMetadataSchema.parse(safeJsonParse(run.metadataJson, "Restore metadata"));
    const documentRows = DocumentRowsSchema.parse(safeJsonParse(run.rowsJson, "Restore rows"));
    const flattenedRows = flattenDocumentRows(documentRows);
    const batches = createBatches(flattenedRows, BATCH_SIZE);
    const startFrom = args.startFromBatch ?? 0;

    if (startFrom >= batches.length) {
      throw new Error(`startFromBatch ${startFrom} exceeds total batches ${batches.length}`);
    }

    const log = createLogger("pipeline", { runId: args.ingestionId, providerId });

    log.info("Processing batches", { startFromBatch: startFrom, totalBatches: batches.length });

    let processed = 0;
    let needsReview = 0;
    let failedProducts = 0;
    const failedBatches: number[] = [];
    let processedRows = 0;

    // If resuming, count already-processed rows
    if (startFrom > 0) {
      for (let i = 0; i < startFrom; i++) {
        processedRows += batches[i].length;
      }
    }

    for (let batchIndex = startFrom; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      try {
        const batchResult = await processBatch(
          ai,
          metadata,
          batch,
          batchIndex,
          batches.length
        );

        const productsToInsert: Record<string, unknown>[] = [];
        for (const item of batchResult.items) {
          const result = normalizeProduct(item, args.ingestionId, providerId);
          if ("error" in result) {
            failedProducts += 1;
            log.error("Skipping product — normalization failed", { batchIndex, sourceRowId: item.sourceRowId, reason: result.error });
            continue;
          }
          productsToInsert.push(result.product);
          if (result.needsReview) {
            needsReview += 1;
          }
        }

        if (productsToInsert.length > 0) {
          await ctx.runMutation(internal.products.batchInsertProducts, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- product shape built dynamically from normalizeProduct
            products: productsToInsert as any,
          });
          processed += productsToInsert.length;
        }
      } catch (error) {
        failedBatches.push(batchIndex + 1);
        log.error("Batch processing failed", { batchIndex: batchIndex + 1, error: String(error) });
      }

      processedRows += batch.length;
      const batchProgress = 50 + Math.round(((batchIndex + 1) / Math.max(batches.length, 1)) * 40);
      await updateIngestionProgress(ctx, args.ingestionId, providerId, {
        status: "stage_3",
        progressPercent: batchProgress,
        message: `Procesando batch ${Math.min(batchIndex + 2, batches.length)} de ${batches.length}...`,
        currentBatch: batchIndex + 1,
        totalBatches: batches.length,
        processedRows,
        totalRows: documentRows.totalRowCount,
      });
    }

    const duration = Date.now() - (run.startedAt ?? Date.now());

    await updateIngestionProgress(ctx, args.ingestionId, providerId, {
      status: "completed",
      progressPercent: 100,
      message: "Procesamiento completado",
      currentBatch: batches.length,
      totalBatches: batches.length,
      processedRows: documentRows.totalRowCount,
      totalRows: documentRows.totalRowCount,
      completedAt: Date.now(),
      processedCount: processed,
      needsReviewCount: needsReview,
      failedProductsCount: failedProducts,
      failedBatchesJson: JSON.stringify(failedBatches),
      durationMs: duration,
    });

    return {
      ingestionId: args.ingestionId,
      processed,
      needsReview,
      failedProducts,
      failedBatches,
      totalBatches: batches.length,
      totalRows: documentRows.totalRowCount,
      duration,
      metadata: {
        documentType: metadata.documentType,
        pages: metadata.pages.length,
        ambiguities: metadata.ambiguityNotes?.length || 0,
      },
    };
  },
});

// ============================================================================
// Action 3: resumeIngestion
//   Resumes a failed/stalled ingestion from the last unprocessed batch.
// ============================================================================

export const resumeIngestion = action({
  args: {
    ingestionId: v.id("ingestionRuns"),
  },
  handler: async (ctx, args): Promise<{
    ingestionId: Id<"ingestionRuns">;
    processed: number;
    needsReview: number;
    failedProducts: number;
    failedBatches: number[];
    totalBatches: number;
    totalRows: number;
    duration: number;
    metadata: { documentType: string; pages: number; ambiguities: number };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const providerId = identity.tokenIdentifier;

    const run = await ctx.runQuery(internal.ingestionProgress.getIngestionState, {
      ingestionId: args.ingestionId,
    });

    if (!run) {
      throw new Error("Ingestion run not found");
    }

    if (run.providerId !== providerId) {
      throw new Error("Not authorized to resume this ingestion run");
    }

    if (run.status !== "failed" && run.status !== "stage_3") {
      throw new Error(`Cannot resume ingestion with status "${run.status}". Only "failed" or "stage_3" can be resumed.`);
    }

    if (!run.metadataJson || !run.rowsJson) {
      throw new Error("No stored metadata or rows found — cannot resume");
    }

    // Determine where to resume: count existing products for this run
    const existingProducts = await ctx.runQuery(internal.products.listByIngestionRun, {
      ingestionRunId: args.ingestionId,
    });

    DocumentMetadataSchema.parse(safeJsonParse(run.metadataJson, "Resume metadata")); // validate stored metadata
    const documentRows = DocumentRowsSchema.parse(safeJsonParse(run.rowsJson, "Resume rows"));
    const flattenedRows = flattenDocumentRows(documentRows);
    const batches = createBatches(flattenedRows, BATCH_SIZE);

    // Calculate which batches still need processing
    const processedSourceRowIds = new Set(existingProducts.map((p) => p.sourceRowId));
    let startFromBatch = 0;
    for (let i = 0; i < batches.length; i++) {
      const batchRowIds = batches[i].map((r) => r.rowId);
      const allProcessed = batchRowIds.every((id) => processedSourceRowIds.has(id));
      if (allProcessed) {
        startFromBatch = i + 1;
      } else {
        break;
      }
    }

    const log = createLogger("pipeline", { runId: args.ingestionId, providerId });
    log.info("Resuming ingestion", { startFromBatch, totalBatches: batches.length });

    // Delegate to processBatches
    const result: {
      ingestionId: Id<"ingestionRuns">;
      processed: number;
      needsReview: number;
      failedProducts: number;
      failedBatches: number[];
      totalBatches: number;
      totalRows: number;
      duration: number;
      metadata: { documentType: string; pages: number; ambiguities: number };
    } = await ctx.runAction(api.ingest.processBatches, {
      ingestionId: args.ingestionId,
      startFromBatch,
    });
    return result;
  },
});
