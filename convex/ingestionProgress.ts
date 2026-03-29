import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit } from "./lib/rateLimiter";

/**
 * Create a new ingestion run record for the authenticated provider.
 * Initializes with "pending" status and 0% progress.
 * @returns The ID of the newly created ingestionRun document
 */
export const createRun = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

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

/**
 * Get an ingestion run by ID for the authenticated provider.
 * Only returns the run if it belongs to the requesting provider.
 * @param args.ingestionId - The ingestion run document ID
 * @returns The ingestion run document or null if not found or unauthorized
 */
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

/**
 * Get the full ingestion state including stored metadata and rows JSON (internal query).
 * Used by the batch processing pipeline to retrieve intermediate state.
 * @param args.ingestionId - The ingestion run document ID
 * @returns The full ingestion run document with all stored fields
 */
export const getIngestionState = internalQuery({
  args: { ingestionId: v.id("ingestionRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ingestionId);
  },
});

/**
 * Update an ingestion run's progress and state fields (internal mutation).
 * Validates that the run belongs to the specified provider before updating.
 * @param args.ingestionId - The ingestion run document ID
 * @param args.providerId - The provider ID for ownership verification
 * @param args - Partial fields to update (status, progressPercent, message, batch info, result counters, etc.)
 * @returns The updated ingestion run document
 */
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

/**
 * Find recent ingestion runs by provider and file hash (internal query).
 * Used for duplicate upload detection within a 24-hour window.
 * @param args.providerId - The provider ID to search for
 * @param args.fileSha256 - The SHA-256 hash of the uploaded file
 * @returns Array of matching ingestion run documents (empty if no recent duplicates)
 */
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
