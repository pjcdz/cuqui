"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import fs from "node:fs/promises";

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
    // 1. Guardar archivo temporalmente
    const buffer = Buffer.from(args.fileBase64, "base64");
    const tempPath = `/tmp/${Date.now()}.pdf`;
    await fs.writeFile(tempPath, buffer);

    try {
      // 2. Usar Files API de Gemini via fetch
      const uploadResponse = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "X-Goog-Upload-Protocol": "raw",
          },
          body: buffer,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      const uploadResult = await uploadResponse.json();
      const fileUri = uploadResult.file?.uri;

      if (!fileUri) {
        throw new Error("No file URI returned from upload");
      }

      // 3. Generar contenido con el archivo
      const generateResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                { file_data: { mime_type: args.mimeType, file_uri: fileUri } },
                { text: EXTRACT_PROMPT }
              ]
            }],
            generationConfig: {
              response_mime_type: "application/json",
            }
          }),
        }
      );

      if (!generateResponse.ok) {
        throw new Error(`Failed to generate content: ${generateResponse.statusText}`);
      }

      const result = await generateResponse.json();
      const parsed = JSON.parse(result.candidates[0].content.parts[0].text);

      // 4. Guardar todo de una vez (SIN BATCHES)
      for (const product of parsed.items) {
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

      return { processed: parsed.items.length };

    } finally {
      // 5. Cleanup
      await fs.unlink(tempPath);
    }
  }
});
