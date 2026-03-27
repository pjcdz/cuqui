"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import * as fs from "node:fs/promises";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import {
  DocumentMetadataSchema,
  type DocumentMetadata,
  DOCUMENT_METADATA_JSON_SCHEMA,
  DOCUMENT_METADATA_PROMPT,
  PRODUCT_EXTRACTION_JSON_SCHEMA,
  PRODUCT_CHUNK_JSON_SCHEMA,
  PRODUCT_EXTRACTION_PROMPT,
} from "./lib/schemas";
import { buildChunksFromMetadata } from "./lib/chunking";

const EXTRACT_PROMPT = `Extrae productos de este catálogo en JSON:
{
  "items": [
    {
      "name": "string",
      "brand": "string",
      "presentation": "string",
      "price": number,
      "category": "string",
      "tags": ["string"]
    }
  ]
}`;

/**
 * Stage 1: Extract document metadata using high-capacity model
 * Analyzes global document structure, formatting, and ambiguities
 *
 * @param ai - GoogleGenAI client instance
 * @param fileUri - URI of uploaded file in Gemini Files API
 * @param mimeType - MIME type of the file
 * @returns Validated document metadata
 */
async function extractDocumentMetadata(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string
): Promise<DocumentMetadata> {
  console.log("Stage 1: Starting document metadata extraction with gemini-3.1-pro");

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Stage 1: Attempt ${attempt}/${maxRetries}`);

      // Use gemini-3.1-pro for high-capacity analysis
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro",
        contents: createUserContent([
          createPartFromUri(fileUri, mimeType),
          DOCUMENT_METADATA_PROMPT,
        ]),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: DOCUMENT_METADATA_JSON_SCHEMA,
        },
      });

      // Validate response
      if (!response.text) {
        throw new Error("Stage 1: Gemini response did not contain text");
      }

      console.log("Stage 1: Raw response received, parsing JSON");

      // Parse JSON response
      const parsed = JSON.parse(response.text);

      // Validate with Zod schema
      const validated = DocumentMetadataSchema.parse(parsed);

      console.log("Stage 1: Metadata extraction successful");
      console.log(`  - Document type: ${validated.documentType}`);
      console.log(`  - Language: ${validated.language}`);
      console.log(`  - Currency: ${validated.currency}`);
      console.log(`  - Pages: ${validated.pages.length}`);
      console.log(`  - Sections: ${validated.sections?.length || 0}`);

      const tablesCount = validated.pages.reduce((sum, page) => sum + (page.tables?.length || 0), 0);
      console.log(`  - Tables: ${tablesCount}`);

      if (validated.ambiguityNotes && validated.ambiguityNotes.length > 0) {
        console.log(`  - Ambiguities: ${validated.ambiguityNotes.length}`);
        console.log("  ⚠️  Ambiguities detected:");
        validated.ambiguityNotes.forEach((ambiguity, i) => {
          console.log(`    ${i + 1}. ${ambiguity}`);
        });
      }

      return validated;
    } catch (error) {
      lastError = error as Error;
      console.error(`Stage 1: Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff: 2^attempt seconds
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Stage 1: Retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Stage 1: Failed after ${maxRetries} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Stage 2: Extract products from a specific chunk
 * Uses fast model with metadata-guided prompting
 *
 * @param ai - GoogleGenAI client instance
 * @param fileUri - URI of uploaded file in Gemini Files API
 * @param mimeType - MIME type of the file
 * @param metadata - Document metadata from Stage 1
 * @param chunk - Chunk information
 * @returns Extracted products with context
 */
async function extractProductsFromChunk(
  ai: GoogleGenAI,
  fileUri: string,
  mimeType: string,
  metadata: DocumentMetadata,
  chunk: any
) {
  const prompt = PRODUCT_EXTRACTION_PROMPT(metadata, chunk);

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: createUserContent([
      createPartFromUri(fileUri, mimeType),
      prompt,
    ]),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: PRODUCT_CHUNK_JSON_SCHEMA,
    },
  });

  if (!response.text) {
    throw new Error("Stage 2: Gemini response did not contain text");
  }

  const parsed = JSON.parse(response.text);
  return parsed;
}

/**
 * Validate and process extracted product
 * Performs local validation and arithmetic conversions
 *
 * @param ctx - Action context
 * @param extraction - Extracted product from AI
 * @param metadata - Document metadata
 * @returns Validated product data
 */
async function processExtractedProduct(
  ctx: any,
  extraction: any,
  metadata: DocumentMetadata
) {
  // Validate ranges
  if (extraction.price?.amount <= 0) {
    throw new Error(`Invalid price: ${extraction.price?.amount}`);
  }

  if (extraction.confidence < 0 || extraction.confidence > 1) {
    throw new Error(`Invalid confidence: ${extraction.confidence}`);
  }

  // Calculate normalized price (arithmetic only - model already interpreted semantics)
  let normalizedPrice: number | undefined;
  if (extraction.packaging && extraction.price) {
    const totalQuantity = extraction.packaging.unitsPerPack || 1;
    normalizedPrice = extraction.price.amount / totalQuantity;
  }

  // Mark as needs_review if confidence is low or ambiguities exist
  const needsReview =
    extraction.confidence < 0.7 ||
    (extraction.ambiguityNotes && extraction.ambiguityNotes.length > 0);

  // Build tags from model output
  const tags = extraction.tags || [];

  // Persist to database
  await ctx.runMutation(api.products.create, {
    name: extraction.canonicalName || extraction.rawText?.split(" ").slice(0, 5).join(" ") || "Unknown",
    brand: extraction.brand || "unknown",
    presentation: extraction.packaging
      ? `${extraction.packaging.packagingType} ${extraction.packaging.netQuantity} ${extraction.packaging.netUnit}`
      : "N/A",
    price: extraction.price?.amount || 0,
    category: extraction.category || "uncategorized",
    tags,
    ...(normalizedPrice && { normalizedPrice }),
    ...(extraction.packaging?.netUnit && { unitOfMeasure: extraction.packaging.netUnit }),
  });

  return {
    success: true,
    needsReview,
  };
}

/**
 * Hybrid Pipeline: Two-stage ingestion with metadata-guided chunking
 * Stage 1: Extract document metadata with gemini-3.1-pro
 * Stage 2: Extract products from chunks with gemini-3.1-flash-lite-preview
 */
export const ingestCatalogHybrid = action({
  args: {
    fileBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Save temp file
    const buffer = Buffer.from(args.fileBase64, "base64");
    const tempPath = `/tmp/${Date.now()}.pdf`;
    await fs.writeFile(tempPath, buffer);

    try {
      // Upload to Gemini Files API
      const myfile = await ai.files.upload({
        file: tempPath,
        config: { mimeType: args.mimeType },
      });

      if (!myfile.uri || !myfile.mimeType) {
        throw new Error("File upload did not return required URI or mimeType");
      }

      // === STAGE 1: Extract document metadata ===
      const metadata = await extractDocumentMetadata(
        ai,
        myfile.uri,
        myfile.mimeType
      );

      // === Build chunks ===
      const chunks = buildChunksFromMetadata(metadata, 5);

      console.log(`Pipeline: Created ${chunks.length} chunks from document`);

      // === STAGE 2: Extract products from each chunk ===
      let processed = 0;
      let needsReview = 0;
      const failedChunks: number[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.description}`);

        try {
          const chunkResult = await extractProductsFromChunk(
            ai,
            myfile.uri,
            myfile.mimeType,
            metadata,
            chunk
          );

          // Validate and persist each product
          for (const item of chunkResult.items || []) {
            try {
              const result = await processExtractedProduct(ctx, item, metadata);
              processed++;

              if (result.needsReview) {
                needsReview++;
              }
            } catch (err) {
              console.error(`Failed to process product: ${err}`);
              // Continue with next product
            }
          }
        } catch (err) {
          console.error(`Chunk ${i + 1} failed: ${err}`);
          failedChunks.push(i + 1);
          // Continue with next chunk
        }
      }

      const duration = Date.now() - startTime;

      console.log(`Pipeline complete:`);
      console.log(`  - Processed: ${processed}`);
      console.log(`  - Needs review: ${needsReview}`);
      console.log(`  - Failed chunks: ${failedChunks.length}`);
      console.log(`  - Duration: ${duration}ms`);

      return {
        processed,
        needsReview,
        failedChunks,
        totalChunks: chunks.length,
        duration,
        metadata: {
          documentType: metadata.documentType,
          pages: metadata.pages.length,
          sections: metadata.sections?.length || 0,
          ambiguities: metadata.ambiguityNotes?.length || 0,
        },
      };
    } finally {
      // Cleanup
      await fs.unlink(tempPath);
    }
  },
});

/**
 * Original single-stage ingestion (kept as fallback)
 * Processes entire catalog in one pass with gemini-3.1-flash-lite-preview
 */
export const ingestCatalogSingleStage = action({
  args: {
    fileBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // 1. Guardar archivo temporalmente
    const buffer = Buffer.from(args.fileBase64, "base64");
    const tempPath = `/tmp/${Date.now()}.pdf`;
    await fs.writeFile(tempPath, buffer);

    try {
      // 2. Upload a Gemini Files API
      const myfile = await ai.files.upload({
        file: tempPath,
        config: { mimeType: args.mimeType },
      });

      // Validate required file properties
      if (!myfile.uri || !myfile.mimeType) {
        throw new Error("File upload did not return required URI or mimeType");
      }

      // 3. Generar contenido con JSON response
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: createUserContent([
          createPartFromUri(myfile.uri, myfile.mimeType),
          EXTRACT_PROMPT,
        ]),
        config: {
          responseMimeType: "application/json",
        },
      });

      // Validate response text before parsing
      if (!response.text) {
        throw new Error("Gemini response did not contain text");
      }

      const result = JSON.parse(response.text);

      // 4. Guardar todo de una vez (SIN BATCHES)
      for (const product of result.items) {
        await ctx.runMutation(api.products.create, {
          name: product.name,
          brand: product.brand,
          presentation: product.presentation,
          price: product.price,
          category: product.category,
          tags: product.tags,
          // Note: providerId removed - not in schema, will be added in Unit 7
        });
      }

      return { processed: result.items.length };
    } finally {
      // 5. Cleanup
      await fs.unlink(tempPath);
    }
  },
});

/**
 * Main ingestion action
 * Uses hybrid pipeline by default
 */
export const ingestCatalog = ingestCatalogHybrid;
