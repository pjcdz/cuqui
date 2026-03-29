import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  providers: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    businessName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk", ["clerkId"]),

  products: defineTable({
    name: v.string(),
    brand: v.string(),
    presentation: v.string(),
    price: v.number(),
    category: v.string(),
    tags: v.array(v.string()),
    providerId: v.string(),
    imageUrl: v.optional(v.string()),
    active: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Normalized pricing (RF-016)
    normalizedPrice: v.optional(v.number()),
    unitOfMeasure: v.optional(v.string()),
    quantity: v.optional(v.number()),
    multiplier: v.optional(v.number()),
    // Pipeline extraction fields
    rawText: v.optional(v.string()),
    canonicalName: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    packagingType: v.optional(v.string()),
    saleFormat: v.optional(v.string()),
    priceType: v.optional(v.string()),
    confidence: v.optional(v.number()),
    reviewStatus: v.optional(v.string()),
    ambiguityNotes: v.optional(v.array(v.string())),
    // Idempotency + source rowId
    ingestionRunId: v.optional(v.id("ingestionRuns")),
    sourceRowId: v.optional(v.string()),
  })
    .index("by_provider", ["providerId"])
    .index("by_tags", ["tags"])
    .index("by_category", ["category"])
    .index("by_review_status", ["reviewStatus"])
    .index("by_ingestion_run", ["ingestionRunId"])
    .searchIndex("search", {
      searchField: "name",
      filterFields: ["category", "brand", "providerId"],
    }),

  ingestionRuns: defineTable({
    providerId: v.string(),
    status: v.string(),
    progressPercent: v.number(),
    message: v.string(),
    currentBatch: v.optional(v.number()),
    totalBatches: v.optional(v.number()),
    processedRows: v.optional(v.number()),
    totalRows: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    fileSha256: v.optional(v.string()),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    geminiFileName: v.optional(v.string()),
    geminiFileUri: v.optional(v.string()),
    geminiFileMimeType: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    rowsJson: v.optional(v.string()),
    // Result counters (accumulated across action invocations)
    processedCount: v.optional(v.number()),
    needsReviewCount: v.optional(v.number()),
    failedProductsCount: v.optional(v.number()),
    failedBatchesJson: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  })
    .index("by_provider", ["providerId"])
    .index("by_provider_hash", ["providerId", "fileSha256"]),
});
