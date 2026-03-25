import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    name: v.string(),
    brand: v.string(),
    presentation: v.string(),
    price: v.number(),
    category: v.string(),
    tags: v.array(v.string()),
    providerId: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider", ["providerId"])
    .index("by_tags", ["tags"]),
});
