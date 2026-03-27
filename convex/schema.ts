import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    name: v.string(),
    brand: v.string(),
    presentation: v.string(),
    price: v.number(),
    // Normalización de precios (RF-016)
    normalizedPrice: v.optional(v.number()), // Precio por unidad estándar (litro, kg, unidad)
    unitOfMeasure: v.optional(v.string()), // "litro", "kg", "unidad", "ml", "g"
    quantity: v.optional(v.number()), // Cantidad en el empaque original
    multiplier: v.optional(v.number()), // Para multi-pack (ej: 12 X 1,5 LT → multiplier=12)
    category: v.string(),
    tags: v.array(v.string()),
    providerId: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider", ["providerId"])
    .index("by_tags", ["tags"])
    .index("by_category", ["category"]),
});
