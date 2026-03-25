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

export const ingestCatalog = action({
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
