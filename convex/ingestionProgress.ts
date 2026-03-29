import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createRun = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const now = Date.now();
    return await ctx.db.insert("ingestionRuns", {
      providerId: identity.tokenIdentifier,
      status: "pending",
      progressPercent: 0,
      message: "Preparando archivo...",
      startedAt: now,
      updatedAt: now,
    });
  },
});

export const get = query({
  args: {
    ingestionId: v.id("ingestionRuns"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const run = await ctx.db.get(args.ingestionId);
    if (!run || run.providerId !== identity.tokenIdentifier) {
      return null;
    }

    return run;
  },
});

export const getIngestionState = internalQuery({
  args: { ingestionId: v.id("ingestionRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ingestionId);
  },
});

export const updateInternal = internalMutation({
  args: {
    ingestionId: v.id("ingestionRuns"),
    providerId: v.string(),
    status: v.optional(v.string()),
    progressPercent: v.optional(v.number()),
    message: v.optional(v.string()),
    currentBatch: v.optional(v.number()),
    totalBatches: v.optional(v.number()),
    processedRows: v.optional(v.number()),
    totalRows: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    fileSha256: v.optional(v.string()),
    geminiFileName: v.optional(v.string()),
    geminiFileUri: v.optional(v.string()),
    geminiFileMimeType: v.optional(v.string()),
    metadataJson: v.optional(v.string()),
    rowsJson: v.optional(v.string()),
    // Result counters
    processedCount: v.optional(v.number()),
    needsReviewCount: v.optional(v.number()),
    failedProductsCount: v.optional(v.number()),
    failedBatchesJson: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.ingestionId);
    if (!run) {
      throw new Error("Ingestion run not found");
    }

    if (run.providerId !== args.providerId) {
      throw new Error("Ingestion run does not belong to provider");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(args)) {
      if (key !== "ingestionId" && key !== "providerId" && value !== undefined) {
        patch[key] = value;
      }
    }

    await ctx.db.patch(args.ingestionId, patch);

    // Return the updated run so callers get fresh state
    return await ctx.db.get(args.ingestionId);
  },
});

export const findByProviderAndHash = internalQuery({
  args: {
    providerId: v.string(),
    fileSha256: v.string(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    // Check if any recent ingestion run exists for this file (24h window)
    const recent = await ctx.db
      .query("ingestionRuns")
      .withIndex("by_provider_hash", (q) =>
        q.eq("providerId", args.providerId).eq("fileSha256", args.fileSha256)
      )
      .first();

    if (recent && recent.startedAt > cutoff) {
      return [recent];
    }
    return [];
  },
});
