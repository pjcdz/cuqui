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
} from "./lib/schemas";

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
      console.log(`  - Pages: ${validated.pages}`);
      console.log(`  - Sections: ${validated.sections.length}`);
      console.log(`  - Tables: ${validated.tables}`);
      console.log(`  - Ambiguities: ${validated.ambiguities.length}`);

      if (validated.ambiguities.length > 0) {
        console.log("  ⚠️  Ambiguities detected:");
        validated.ambiguities.forEach((ambiguity, i) => {
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
          providerId: "temp-provider", // TODO: Get from auth
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
 * Alias for backward compatibility
 * Points to single-stage implementation (original behavior)
 */
export const ingestCatalog = ingestCatalogSingleStage;
