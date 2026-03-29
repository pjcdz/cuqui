/**
 * Duplicate detection for products within the same provider (RF-018).
 *
 * Uses Levenshtein distance to find similar product names, then presents
 * potential duplicate pairs for the provider to review. Supports:
 * - "Fusionar" (merge): combines two duplicates into one product
 * - "Son diferentes, ignorar": dismisses the alert, pair won't be shown again
 *
 * Validates: VAL-CATALOG-012, VAL-CATALOG-013, VAL-CATALOG-014
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { levenshteinDistance, levenshteinSimilarity } from "./lib/levenshtein";
import { checkRateLimit } from "./lib/rateLimiter";
import { createLogger } from "./lib/logger";

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all pending duplicate pairs for the authenticated provider.
 * VAL-CATALOG-012: Shows "Posibles duplicados" warning badge with merge/ignore options.
 */
export const listPending = query({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const pairs = await ctx.db
      .query("duplicatePairs")
      .withIndex("by_provider_status", (q) =>
        q.eq("providerId", identity.tokenIdentifier).eq("status", "pending")
      )
      .collect();

    // Enrich each pair with full product data for side-by-side comparison
    const enriched = await Promise.all(
      pairs.map(async (pair) => {
        const productA = await ctx.db.get(pair.productA);
        const productB = await ctx.db.get(pair.productB);
        // Skip pairs where either product has been deleted
        if (!productA || !productB) {
          return null;
        }
        return {
          ...pair,
          productAData: productA,
          productBData: productB,
        };
      })
    );

    return enriched.filter((p) => p !== null);
  },
});

/**
 * Get the count of pending duplicate pairs for the authenticated provider.
 * Used for badge count display.
 */
export const getPendingCount = query({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const pairs = await ctx.db
      .query("duplicatePairs")
      .withIndex("by_provider_status", (q) =>
        q.eq("providerId", identity.tokenIdentifier).eq("status", "pending")
      )
      .collect();

    // Filter out pairs where either product was deleted
    let count = 0;
    for (const pair of pairs) {
      const a = await ctx.db.get(pair.productA);
      const b = await ctx.db.get(pair.productB);
      if (a && b) {
        count++;
      }
    }
    return count;
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Run duplicate detection for the authenticated provider's products.
 * Compares all products by name using Levenshtein distance within the same provider.
 * VAL-CATALOG-012: System detects and alerts on duplicate or highly similar products.
 *
 * This is an on-demand operation — run after catalog upload or when the provider
 * wants to check for duplicates.
 */
export const detectDuplicates = mutation({
  args: {
    nameThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const providerId = identity.tokenIdentifier;
    const nameThreshold = args.nameThreshold ?? 3;

    // Fetch all active products for this provider
    const products = await ctx.db
      .query("products")
      .withIndex("by_provider", (q) => q.eq("providerId", providerId))
      .collect();

    const activeProducts = products.filter((p) => p.active !== false);

    // Get existing duplicate pairs to avoid re-detecting
    const existingPairs = await ctx.db
      .query("duplicatePairs")
      .withIndex("by_provider", (q) => q.eq("providerId", providerId))
      .collect();

    // Build a set of already-known pairs (both pending and ignored)
    const knownPairs = new Set<string>();
    for (const pair of existingPairs) {
      const key = [pair.productA, pair.productB].sort().join("|");
      knownPairs.add(key);
    }

    // Compare all pairs of products
    const now = Date.now();
    let newPairs = 0;

    for (let i = 0; i < activeProducts.length; i++) {
      for (let j = i + 1; j < activeProducts.length; j++) {
        const a = activeProducts[i];
        const b = activeProducts[j];

        const nameA = a.name.toLowerCase().trim();
        const nameB = b.name.toLowerCase().trim();

        const nameDistance = levenshteinDistance(nameA, nameB);

        // Only flag if name distance is within threshold
        if (nameDistance <= nameThreshold) {
          const pairKey = [a._id, b._id].sort().join("|");

          // Skip if already known
          if (knownPairs.has(pairKey)) {
            continue;
          }

          const similarity = levenshteinSimilarity(nameA, nameB);

          // Insert the pair (sorted IDs for consistency)
          const [firstId, secondId] = [a._id, b._id].sort() as [Id<"products">, Id<"products">];

          await ctx.db.insert("duplicatePairs", {
            providerId,
            productA: firstId,
            productB: secondId,
            nameDistance,
            similarity,
            status: "pending",
            detectedAt: now,
          });

          knownPairs.add(pairKey);
          newPairs++;
        }
      }
    }

    return { newPairs, totalProducts: activeProducts.length };
  },
});

/**
 * Merge two duplicate products into one.
 * VAL-CATALOG-013: Provider can merge two duplicate products.
 * The surviving product gets the chosen fields from each product.
 */
export const mergeDuplicates = mutation({
  args: {
    pairId: v.id("duplicatePairs"),
    // For each field, specify which product to keep the value from: "a" or "b"
    fieldChoices: v.object({
      name: v.string(),         // "a" or "b"
      brand: v.string(),        // "a" or "b"
      presentation: v.string(), // "a" or "b"
      price: v.string(),        // "a" or "b"
      category: v.string(),     // "a" or "b"
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const pair = await ctx.db.get(args.pairId);
    if (!pair) {
      throw new Error("Duplicate pair not found");
    }
    if (pair.providerId !== identity.tokenIdentifier) {
      throw new Error("Not authorized to modify this pair");
    }

    const productA = await ctx.db.get(pair.productA);
    const productB = await ctx.db.get(pair.productB);
    if (!productA || !productB) {
      throw new Error("One or both products no longer exist");
    }

    const choices = args.fieldChoices;

    // Validate field choices
    const validChoices = ["a", "b"];
    for (const [field, choice] of Object.entries(choices)) {
      if (!validChoices.includes(choice)) {
        throw new Error(`Invalid choice for ${field}: must be "a" or "b"`);
      }
    }

    // Determine which product survives and which gets deleted
    // Product A is always the survivor (we'll update it with chosen fields)
    const survivorId = pair.productA;
    const removedId = pair.productB;

    // Build the merged product data
    const mergedData: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    // For each field, pick from the chosen product
    const fieldsToMerge = ["name", "brand", "presentation", "price", "category"] as const;
    for (const field of fieldsToMerge) {
      const source = choices[field] === "a" ? productA : productB;
      mergedData[field] = source[field];
    }

    // Update the surviving product with merged data
    await ctx.db.patch(survivorId, mergedData);

    // Delete the removed product
    await ctx.db.delete(removedId);

    // Delete the duplicate pair
    await ctx.db.delete(args.pairId);

    // Also delete any other duplicate pairs that reference the removed product
    const allPairs = await ctx.db
      .query("duplicatePairs")
      .withIndex("by_provider", (q) => q.eq("providerId", identity.tokenIdentifier))
      .collect();

    for (const p of allPairs) {
      if (p.productA === removedId || p.productB === removedId) {
        await ctx.db.delete(p._id);
      }
    }

    const log = createLogger("duplicates", { userId: identity.tokenIdentifier });
    log.info("Duplicates merged", {
      operation: "mergeDuplicates",
      duplicateIds: [pair.productA, pair.productB],
      survivorId,
      removedId,
    });

    return {
      success: true,
      survivorId,
      removedId,
    };
  },
});

/**
 * Ignore a duplicate pair — marks it as not a duplicate.
 * VAL-CATALOG-014: Provider can dismiss a duplicate alert.
 * The pair remains in the database with status "ignored" so it won't be flagged again.
 */
export const ignoreDuplicatePair = mutation({
  args: {
    pairId: v.id("duplicatePairs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const pair = await ctx.db.get(args.pairId);
    if (!pair) {
      throw new Error("Duplicate pair not found");
    }
    if (pair.providerId !== identity.tokenIdentifier) {
      throw new Error("Not authorized to modify this pair");
    }

    await ctx.db.patch(args.pairId, {
      status: "ignored",
      ignoredAt: Date.now(),
    });

    return { success: true };
  },
});
