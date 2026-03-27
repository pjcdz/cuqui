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
  parsePresentation,
  calculateNormalizedPrice,
} from "./lib/normalization";
import { z } from "zod";

/**
 * Zod schemas para validación robusta de respuestas de Gemini
 * Pattern recomendado en: https://ai.google.dev/gemini-api/docs/structured-output
 */

// Esquema para un producto individual
const ProductSchema = z.object({
  name: z.string().describe("Nombre del producto"),
  brand: z.string().describe("Marca del producto"),
  presentation: z.string().describe("Presentación del producto (ej: 'BID X 5 LTS')"),
  price: z.number().positive().describe("Precio del producto"),
  category: z.string().describe("Categoría del producto"),
  tags: z.array(z.string()).describe("Lista de tags del producto"),
});

// Esquema para la respuesta completa (catálogo)
const CatalogResponseSchema = z.object({
  items: z.array(ProductSchema).describe("Lista de productos"),
});

// Tipo inferido del esquema (para TypeScript autocomplete)
type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

/**
 * JSON Schema para Gemini responseJsonSchema (definido manualmente para evitar conflictos de versiones de Zod)
 * Basado en el patrón oficial: https://ai.google.dev/gemini-api/docs/structured-output#json_schema_support
 */
const CATALOG_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      description: "Lista de productos",
      items: {
        type: "object" as const,
        properties: {
          name: {
            type: "string" as const,
            description: "Nombre del producto",
          },
          brand: {
            type: "string" as const,
            description: "Marca del producto",
          },
          presentation: {
            type: "string" as const,
            description: "Presentación del producto (ej: 'BID X 5 LTS')",
          },
          price: {
            type: "number" as const,
            description: "Precio del producto",
            minimum: 0,
            exclusiveMinimum: true,
          },
          category: {
            type: "string" as const,
            description: "Categoría del producto",
          },
          tags: {
            type: "array" as const,
            description: "Lista de tags del producto",
            items: {
              type: "string" as const,
            },
          },
        },
        required: ["name", "brand", "presentation", "price", "category", "tags"],
      },
    },
  },
  required: ["items"],
};

const EXTRACT_PROMPT = `Eres un experto en extraer datos de catálogos de productos en formato JSON.

EXTRAE cada producto con la siguiente información:
- name: Nombre completo del producto (nunca null o vacío)
- brand: Marca del producto (nunca null, usar "GENÉRICO" si no tiene marca)
- presentation: Presentación completa tal como aparece (ej: "BIDON X 5 LTS", "BOT X 250 ML", "CAJ X 12 UNIDADES")
- price: Precio total del empaque como número (sin formato de moneda, solo el valor numérico)
- category: Categoría principal del producto (ej: "aceites", "lacteos", "limpieza", "condimentos")
- tags: Array COMPLETO de tags para navegación de árbol. Debe incluir:
  * Categoría principal (ej: "aceites")
  * Subcategoría si aplica (ej: "girasol", "oliva", "maiz")
  * Marca (ej: "cañuelas", "natura", "la toscana")
  * Tipo de contenedor (ej: "bidon", "botella", "caja")
  * Características importantes (ej: "alto oleico", "extra virgen", "refinado")

IMPORTANTE:
- TODOS los campos deben tener valores válidos, nunca null
- El price es el PRECIO TOTAL del empaque (ej: 27507.00 para "$ 27.507,00")
- Los tags deben ser comprehensivos para permitir navegación de árbol progresiva
- Responde SOLAMENTE con JSON válido, sin texto adicional
- Formato requerido:
{
  "items": [
    {
      "name": "string",
      "brand": "string",
      "presentation": "string",
      "price": number,
      "category": "string",
      "tags": ["tag1", "tag2", "tag3", ...]
    }
  ]
}`;

export const ingestCatalog = action({
  args: {
    fileBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    // TODO: Get from auth when implemented: const providerId = ctx.auth.user.providerId;
    const providerId = "temp-provider"; // Backward compatible fallback
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

      // 3. Generar contenido con JSON response + schema validation
      // Pattern oficial de Google: https://ai.google.dev/gemini-api/docs/structured-output
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: createUserContent([
          createPartFromUri(myfile.uri, myfile.mimeType),
          EXTRACT_PROMPT,
        ]),
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: CATALOG_JSON_SCHEMA,
        },
      });

      // Validate response text before parsing
      if (!response.text) {
        throw new Error("Gemini response did not contain text");
      }

      // Parse JSON con Zod (type-safe + errores claros)
      let parsedResponse: CatalogResponse;
      try {
        const jsonData = JSON.parse(response.text);
        parsedResponse = CatalogResponseSchema.parse(jsonData);
      } catch (parseError) {
        if (parseError instanceof Error) {
          throw new Error(`Failed to parse or validate Gemini response: ${parseError.message}`);
        }
        throw new Error(`Failed to parse Gemini response as JSON`);
      }

      // 4. Guardar productos con validación y normalización
      let processedCount = 0;
      for (const product of parsedResponse.items) {
        // Zod ya garantizó que estos campos son strings válidos
        // Solo sanitización mínima (trim)
        const sanitizedName = product.name.trim() || "SIN NOMBRE";
        const sanitizedBrand = product.brand.trim() || "GENÉRICO";
        const sanitizedPresentation = product.presentation.trim() || "UNIDAD";
        const sanitizedCategory = product.category.trim() || "varios";

        // Zod ya garantizó que price es un número positivo
        const sanitizedPrice = product.price;

        // Zod ya garantizó que tags es un array de strings
        const sanitizedTags = product.tags.map(tag => tag.trim()).filter(tag => tag.length > 0);

        // Solo procesar productos con nombre válido
        if (sanitizedName !== "SIN NOMBRE") {
          // Intentar normalizar precio (RF-016)
          const parsed = parsePresentation(sanitizedPresentation);

          if (parsed === null) {
            // No se pudo parsear la presentación - guardar sin normalización
            await ctx.runMutation(api.products.create, {
              name: sanitizedName,
              brand: sanitizedBrand,
              presentation: sanitizedPresentation,
              price: sanitizedPrice,
              normalizedPrice: undefined,
              unitOfMeasure: undefined,
              quantity: undefined,
              category: sanitizedCategory,
              tags: sanitizedTags,
            });
            processedCount++;
            continue;
          }

          // Calcular precio normalizado con validación
          const normalizedPrice = calculateNormalizedPrice(
            sanitizedPrice,
            parsed.quantity,
            parsed.unitOfMeasure,
            parsed.multiplier
          );

          // Validar que el precio normalizado sea válido
          if (!isFinite(normalizedPrice) || normalizedPrice <= 0) {
            // Precio normalizado inválido - guardar sin normalización
            await ctx.runMutation(api.products.create, {
              name: sanitizedName,
              brand: sanitizedBrand,
              presentation: sanitizedPresentation,
              price: sanitizedPrice,
              normalizedPrice: undefined,
              unitOfMeasure: undefined,
              quantity: undefined,
              category: sanitizedCategory,
              tags: sanitizedTags,
            });
            processedCount++;
            continue;
          }

          // Determinar unidad de medida estándar para display
          let standardUnit = parsed.unitOfMeasure;
          if (parsed.unitOfMeasure === "ml") standardUnit = "litro";
          else if (parsed.unitOfMeasure === "g") standardUnit = "kg";

          // FIX: Calculate total quantity (considering multiplier for multi-pack)
          // For "CAJ 12 X 1,5 LT": totalQuantity = 1.5 * 12 = 18 liters
          const totalQuantity = parsed.multiplier
            ? parsed.quantity * parsed.multiplier
            : parsed.quantity;

          await ctx.runMutation(api.products.create, {
            name: sanitizedName,
            brand: sanitizedBrand,
            presentation: sanitizedPresentation,
            price: sanitizedPrice,
            normalizedPrice,
            unitOfMeasure: standardUnit,
            quantity: totalQuantity, // FIXED: Store total quantity, not single unit quantity
            multiplier: parsed.multiplier,
            category: sanitizedCategory,
            tags: sanitizedTags,
          });
          processedCount++;
        }
      }

      return { processed: processedCount };
    } finally {
      // 5. Cleanup
      await fs.unlink(tempPath);
    }
  },
});
