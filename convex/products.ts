import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { checkRateLimit } from "./lib/rateLimiter";
import { createLogger } from "./lib/logger";

// ============================================================================
// Public catalog queries (RF-006, RF-007, RF-008) — comercio sees ALL products
// ============================================================================

/**
 * List active products from the public catalog with optional limit.
 * Only returns products where `active !== false`.
 * @param args.limit - Maximum number of products to return (default 50, max 1000)
 * @returns Array of active product documents
 */
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    if (args.limit !== undefined) {
      if (!isFinite(args.limit) || args.limit <= 0) {
        throw new Error(`Invalid limit: ${args.limit}. Must be a finite number greater than 0`);
      }
      if (args.limit > 1000) {
        throw new Error(`Invalid limit: ${args.limit}. Must be <= 1000 to prevent abuse`);
      }
    }
    // Public catalog — only show active products (VAL-CROSS-003)
    const all = await ctx.db.query("products").take(limit);
    return all.filter((p) => p.active !== false);
  }
});

/**
 * List products filtered by tags using AND logic.
 * Uses the `by_tags` index for the first tag, then filters remaining tags in memory.
 * @param args.tags - Array of tags to filter by (all must match)
 * @param args.limit - Maximum number of products to return (default 500, max 1000)
 * @returns Array of active products matching all specified tags
 */
export const getByTags = query({
  args: {
    tags: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 500;
    if (args.limit !== undefined) {
      if (!isFinite(args.limit) || args.limit <= 0) {
        throw new Error(`Invalid limit: ${args.limit}. Must be a finite number greater than 0`);
      }
      if (args.limit > 1000) {
        throw new Error(`Invalid limit: ${args.limit}. Must be <= 1000 to prevent abuse`);
      }
    }

    if (args.tags.length === 0) {
      const all = await ctx.db.query("products").take(limit);
      return all.filter((p) => p.active !== false);
    }

    // Use array index for the first tag (element-wise match), filter remaining in memory
    const firstTag = args.tags[0];
    const products = await ctx.db
      .query("products")
      .withIndex("by_tags", (q) => q.eq("tags", firstTag as unknown as string[]))
      .collect();

    // AND logic for remaining tags + active filter (VAL-CROSS-003)
    return products
      .filter((product) => product.active !== false)
      .filter((product) => args.tags.every((tag) => product.tags.includes(tag)))
      .slice(0, limit);
  }
});

/**
 * Search products by name using full-text search with optional category and brand filters.
 * Uses Convex searchIndex for efficient text matching.
 * @param args.query - Search query string
 * @param args.limit - Maximum number of results (default 500, max 1000)
 * @param args.category - Optional category filter
 * @param args.brand - Optional brand filter
 * @returns Array of active products matching the search query
 */
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
    category: v.optional(v.string()),
    brand: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 500;
    if (args.limit !== undefined) {
      if (!isFinite(args.limit) || args.limit <= 0) {
        throw new Error(`Invalid limit: ${args.limit}. Must be a finite number greater than 0`);
      }
      if (args.limit > 1000) {
        throw new Error(`Invalid limit: ${args.limit}. Must be <= 1000 to prevent abuse`);
      }
    }

    const searchQuery = args.query.trim();

    if (!searchQuery) {
      const all = await ctx.db.query("products").take(limit);
      return all.filter((p) => p.active !== false);
    }

    // Use Convex searchIndex for full-text search on product name
    const results = await ctx.db
      .query("products")
      .withSearchIndex("search", (q) => {
        let search = q.search("name", searchQuery);
        if (args.category) {
          search = search.eq("category", args.category);
        }
        if (args.brand) {
          search = search.eq("brand", args.brand);
        }
        return search;
      })
      .take(limit);

    // Filter out deactivated products from search results (VAL-CROSS-003)
    return results.filter((p) => p.active !== false);
  }
});

// ============================================================================
// Provider catalog management (RF-004, RNF-007) — provider sees ONLY their products
// ============================================================================

/**
 * List products belonging to the authenticated provider.
 * Only returns the provider's own products, with optional inactive product inclusion.
 * @param args.limit - Maximum number of products to return (default 500, max 1000)
 * @param args.includeInactive - Whether to include deactivated products (default: false)
 * @returns Array of the provider's products (empty array if unauthenticated)
 */
export const listOwn = query({
  args: {
    limit: v.optional(v.number()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const limit = args.limit || 500;
    if (args.limit !== undefined) {
      if (!isFinite(args.limit) || args.limit <= 0) {
        throw new Error(`Invalid limit: ${args.limit}. Must be a finite number greater than 0`);
      }
      if (args.limit > 1000) {
        throw new Error(`Invalid limit: ${args.limit}. Must be <= 1000 to prevent abuse`);
      }
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_provider", (q) => q.eq("providerId", identity.tokenIdentifier))
      .take(limit);

    // By default only return active products; includeInactive returns all
    if (!args.includeInactive) {
      return products.filter((p) => p.active !== false);
    }
    return products;
  }
});

/**
 * Search within the authenticated provider's own product catalog.
 * Performs case-insensitive matching against name, brand, and sourceRowId.
 * @param args.query - Search query string
 * @returns Array of matching active products belonging to the provider
 */
export const searchOwn = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const searchQuery = args.query.trim().toLowerCase();
    if (!searchQuery) {
      return await ctx.db
        .query("products")
        .withIndex("by_provider", (q) => q.eq("providerId", identity.tokenIdentifier))
        .take(500);
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_provider", (q) => q.eq("providerId", identity.tokenIdentifier))
      .collect();

    return products.filter((p) => {
      // Only show active products in search
      if (p.active === false) return false;
      const name = (p.name ?? "").toLowerCase();
      const brand = (p.brand ?? "").toLowerCase();
      const sourceRowId = (p.sourceRowId ?? "").toLowerCase();
      return (
        name.includes(searchQuery) ||
        brand.includes(searchQuery) ||
        sourceRowId.includes(searchQuery)
      );
    });
  },
});

// ============================================================================
// Mutations (RF-004) — require auth, products scoped to provider
// ============================================================================

/**
 * Create a new product for the authenticated provider.
 * Validates all fields including runtime checks for enum values, price ranges, and cross-field consistency.
 * @param args - Product fields (name, brand, presentation, price, category, tags, etc.)
 * @returns The ID of the newly created product document
 */
export const create = mutation({
  args: {
    name: v.string(),
    brand: v.string(),
    presentation: v.string(),
    price: v.number(),
    category: v.string(),
    tags: v.array(v.string()),
    // Normalización de precios (RF-016)
    normalizedPrice: v.optional(v.number()),
    unitOfMeasure: v.optional(v.string()),
    quantity: v.optional(v.number()),
    multiplier: v.optional(v.number()),
    // Campos del pipeline Files API-only de 3 etapas
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const providerId = identity.tokenIdentifier;

    // Runtime validation: enforce unitOfMeasure union type
    const validUnits = new Set(["litro", "ml", "kg", "g", "unidad"]);
    if (args.unitOfMeasure && !validUnits.has(args.unitOfMeasure)) {
      throw new Error(`Invalid unitOfMeasure: ${args.unitOfMeasure}. Must be one of: ${Array.from(validUnits).join(", ")}`);
    }

    // Runtime validation: enforce reviewStatus enum type (simplified to two values)
    const validStatuses = new Set(["ok", "needs_review"]);
    if (args.reviewStatus && !validStatuses.has(args.reviewStatus)) {
      throw new Error(`Invalid reviewStatus: ${args.reviewStatus}. Must be one of: ${Array.from(validStatuses).join(", ")}`);
    }

    // Runtime validation: enforce priceType enum type
    const validPriceTypes = new Set(["per-pack", "per-unit", "per-kg", "per-liter", "wholesale", "retail", "unknown"]);
    if (args.priceType && !validPriceTypes.has(args.priceType)) {
      throw new Error(`Invalid priceType: ${args.priceType}. Must be one of: ${Array.from(validPriceTypes).join(", ")}`);
    }

    // Validate price (required field)
    if (!isFinite(args.price) || args.price <= 0) {
      throw new Error(`Invalid price: ${args.price}. Must be a finite number greater than 0`);
    }

    // Validate quantity (optional field)
    if (args.quantity !== undefined) {
      if (!isFinite(args.quantity) || args.quantity <= 0) {
        throw new Error(`Invalid quantity: ${args.quantity}. Must be a finite number greater than 0`);
      }
    }

    // Validate multiplier (optional field)
    if (args.multiplier !== undefined) {
      if (!isFinite(args.multiplier) || args.multiplier <= 0) {
        throw new Error(`Invalid multiplier: ${args.multiplier}. Must be a finite number greater than 0`);
      }
      // Validate multiplier range to prevent false positives on years/product codes
      if (args.multiplier > 100) {
        throw new Error(`Invalid multiplier: ${args.multiplier}. Must be <= 100 to prevent false positives on product codes`);
      }
      // Cross-field validation: multiplier requires both quantity and unitOfMeasure for semantic consistency
      if (args.quantity === undefined || args.unitOfMeasure === undefined) {
        throw new Error(`Invalid state: multiplier requires both quantity and unitOfMeasure to be specified`);
      }
    }

    // Validate normalizedPrice (optional field)
    if (args.normalizedPrice !== undefined) {
      if (!isFinite(args.normalizedPrice) || args.normalizedPrice <= 0) {
        throw new Error(`Invalid normalizedPrice: ${args.normalizedPrice}. Must be a finite number greater than 0`);
      }
      // Cross-field validation: normalizedPrice requires both quantity and unitOfMeasure
      if (args.quantity === undefined || args.unitOfMeasure === undefined) {
        throw new Error(`Invalid state: normalizedPrice requires both quantity and unitOfMeasure to be specified`);
      }
    }

    // Validate confidence (optional field)
    if (args.confidence !== undefined) {
      if (!isFinite(args.confidence) || args.confidence < 0 || args.confidence > 1) {
        throw new Error(`Invalid confidence: ${args.confidence}. Must be a finite number between 0 and 1`);
      }
    }

    if (args.ambiguityNotes !== undefined) {
      if (args.ambiguityNotes.length > 16) {
        throw new Error("Invalid ambiguityNotes: must contain at most 16 entries");
      }
    }

    // Cross-field validation: quantity requires unitOfMeasure for semantic consistency
    if (args.quantity !== undefined && args.unitOfMeasure === undefined) {
      throw new Error(`Invalid state: quantity requires unitOfMeasure to be specified`);
    }

    const now = Date.now();
    return await ctx.db.insert("products", {
      ...args,
      providerId,
      createdAt: now,
      updatedAt: now,
    });
  }
});

// ============================================================================
// Internal queries (used by ingestion pipeline)
// ============================================================================

/**
 * List all products belonging to a specific ingestion run (internal query).
 * Used by the pipeline to determine which batches have already been processed.
 * @param args.ingestionRunId - The ingestion run ID to filter by
 * @returns Array of product documents from the specified ingestion run
 */
export const listByIngestionRun = internalQuery({
  args: {
    ingestionRunId: v.id("ingestionRuns"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("products")
      .withIndex("by_ingestion_run", (q) => q.eq("ingestionRunId", args.ingestionRunId))
      .collect();
  },
});

/**
 * Get a single product by ID for public product detail view.
 * Only returns active products; returns null for missing or deactivated products.
 * @param args.id - The product document ID
 * @returns The product document or null if not found or inactive
 */
export const getProduct = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    // Public detail — only return active products (VAL-CROSS-003)
    if (!product || product.active === false) {
      return null;
    }
    return product;
  },
});

/**
 * Delete a product owned by the authenticated provider.
 * Validates ownership before deletion. Logs the operation via structured logger.
 * @param args.id - The product document ID to delete
 * @returns The result of the delete operation
 */
export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.providerId !== identity.tokenIdentifier) {
      throw new Error("Not authorized to delete this product");
    }

    const log = createLogger("products", { userId: identity.tokenIdentifier, productId: args.id });
    log.info("Product deleted", { operation: "remove", productId: args.id, productName: product.name });

    return await ctx.db.delete(args.id);
  },
});

// ============================================================================
// Inline edit — provider updates individual product fields (VAL-CATALOG-002, VAL-CATALOG-005)
// ============================================================================

/**
 * Update individual fields on a product owned by the authenticated provider.
 * Only modifies fields that are explicitly provided in the arguments.
 * Logs the operation via structured logger.
 * @param args.id - The product document ID to update
 * @param args - Partial product fields to update (name, brand, presentation, price, category, subcategory, tags)
 * @returns Object with success status
 */
export const updateProduct = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    presentation: v.optional(v.string()),
    price: v.optional(v.number()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.providerId !== identity.tokenIdentifier) {
      throw new Error("Not authorized to update this product");
    }

    // Validate individual fields if provided
    if (args.price !== undefined) {
      if (!isFinite(args.price) || args.price <= 0) {
        throw new Error("Invalid price: must be a finite number greater than 0");
      }
    }
    if (args.name !== undefined && args.name.trim().length === 0) {
      throw new Error("El nombre es obligatorio");
    }
    if (args.brand !== undefined && args.brand.trim().length === 0) {
      throw new Error("La marca es obligatoria");
    }
    if (args.presentation !== undefined && args.presentation.trim().length === 0) {
      throw new Error("La presentación es obligatoria");
    }
    if (args.category !== undefined && args.category.trim().length === 0) {
      throw new Error("La categoría es obligatoria");
    }

    // Build patch object from provided fields only
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.brand !== undefined) patch.brand = args.brand.trim();
    if (args.presentation !== undefined) patch.presentation = args.presentation.trim();
    if (args.price !== undefined) patch.price = args.price;
    if (args.category !== undefined) patch.category = args.category.trim();
    if (args.subcategory !== undefined) patch.subcategory = args.subcategory.trim();
    if (args.tags !== undefined) patch.tags = args.tags;

    await ctx.db.patch(args.id, patch);
    const log = createLogger("products", { userId: identity.tokenIdentifier, productId: args.id });
    log.info("Product updated", { operation: "updateProduct", productId: args.id, fields: Object.keys(patch) });
    return { success: true };
  },
});

// ============================================================================
// Batch publish — set all needs_review products to ok (VAL-CATALOG-004)
// ============================================================================

/**
 * Batch publish all products with "needs_review" status to "ok" for the authenticated provider.
 * Sets reviewStatus to "ok" and updates the updatedAt timestamp for each product.
 * @returns Object with published count and total needs_review count
 */
export const batchPublishAll = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const providerId = identity.tokenIdentifier;

    // Fetch all needs_review products for this provider
    const products = await ctx.db
      .query("products")
      .withIndex("by_provider", (q) => q.eq("providerId", providerId))
      .collect();

    const needsReview = products.filter(
      (p) => p.reviewStatus === "needs_review"
    );

    const now = Date.now();
    let published = 0;
    for (const product of needsReview) {
      await ctx.db.patch(product._id, {
        reviewStatus: "ok",
        updatedAt: now,
      });
      published++;
    }

    return { published, total: needsReview.length };
  },
});

// ============================================================================
// Internal mutations for pipeline batch operations
// ============================================================================

/**
 * Batch insert products from the pipeline (internal mutation).
 * Used by the ingestion pipeline to persist normalized product data.
 * @param args.products - Array of product objects to insert
 * @returns Array of newly created product document IDs
 */
export const batchInsertProducts = internalMutation({
  args: {
    products: v.array(v.object({
      name: v.string(),
      brand: v.string(),
      presentation: v.string(),
      price: v.number(),
      category: v.string(),
      tags: v.array(v.string()),
      providerId: v.string(),
      ingestionRunId: v.optional(v.id("ingestionRuns")),
      sourceRowId: v.optional(v.string()),
      rawText: v.optional(v.string()),
      canonicalName: v.optional(v.string()),
      subcategory: v.optional(v.string()),
      packagingType: v.optional(v.string()),
      saleFormat: v.optional(v.string()),
      priceType: v.optional(v.string()),
      confidence: v.optional(v.number()),
      reviewStatus: v.optional(v.string()),
      ambiguityNotes: v.optional(v.array(v.string())),
      normalizedPrice: v.optional(v.number()),
      unitOfMeasure: v.optional(v.string()),
      quantity: v.optional(v.number()),
      multiplier: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids: Id<"products">[] = [];
    for (const product of args.products) {
      const id = await ctx.db.insert("products", {
        ...product,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }
    return ids;
  },
});

/**
 * Delete all products belonging to a specific ingestion run (internal mutation).
 * Used for cleanup when retrying or rolling back an ingestion.
 * @param args.ingestionRunId - The ingestion run ID whose products should be deleted
 * @returns The number of products deleted
 */
export const deleteByIngestionRun = internalMutation({
  args: {
    ingestionRunId: v.id("ingestionRuns"),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_ingestion_run", (q) => q.eq("ingestionRunId", args.ingestionRunId))
      .collect();

    let deleted = 0;
    for (const product of products) {
      await ctx.db.delete(product._id);
      deleted++;
    }
    return deleted;
  },
});

// ============================================================================
// Batch price update — update prices for multiple products at once (VAL-CATALOG-006)
// ============================================================================

/**
 * Batch update prices for multiple products owned by the authenticated provider.
 * Supports percentage adjustment or fixed price replacement.
 * @param args.productIds - Array of product document IDs to update (max 500)
 * @param args.mode - "percentage" for relative change or "fixed" for absolute value
 * @param args.value - Percentage change (e.g., 10 for +10%, -5 for -5%) or fixed price amount
 * @returns Object with the number of products actually updated
 */
export const batchPriceUpdate = mutation({
  args: {
    productIds: v.array(v.id("products")),
    mode: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    if (args.productIds.length === 0) {
      throw new Error("No products selected");
    }
    if (args.productIds.length > 500) {
      throw new Error("Too many products selected (max 500)");
    }
    if (!isFinite(args.value)) {
      throw new Error("Invalid value");
    }
    if (args.mode === "percentage" && args.value <= -100) {
      throw new Error("Percentage decrease cannot exceed -100%");
    }
    if (args.mode === "fixed" && args.value <= 0) {
      throw new Error("Fixed price must be greater than 0");
    }

    const now = Date.now();
    let updated = 0;

    for (const productId of args.productIds) {
      const product = await ctx.db.get(productId);
      if (!product) continue;
      if (product.providerId !== identity.tokenIdentifier) continue;

      let newPrice: number;
      if (args.mode === "percentage") {
        newPrice = product.price * (1 + args.value / 100);
      } else {
        newPrice = args.value;
      }

      // Round to 2 decimal places
      newPrice = Math.round(newPrice * 100) / 100;
      if (newPrice <= 0) continue;

      await ctx.db.patch(productId, {
        price: newPrice,
        updatedAt: now,
      });
      updated++;
    }

    return { updated };
  },
});

// ============================================================================
// Toggle active — soft delete / reactivate (VAL-CATALOG-007, VAL-CATALOG-008)
// ============================================================================

/**
 * Toggle a product's active status for soft delete / reactivation.
 * Only the product owner can change the active status.
 * @param args.id - The product document ID to toggle
 * @param args.active - The new active status (true = active, false = soft-deleted)
 * @returns Object with success status and the new active value
 */
export const toggleActive = mutation({
  args: {
    id: v.id("products"),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.providerId !== identity.tokenIdentifier) {
      throw new Error("Not authorized to update this product");
    }

    await ctx.db.patch(args.id, {
      active: args.active,
      updatedAt: Date.now(),
    });

    return { success: true, active: args.active };
  },
});

// ============================================================================
// Export catalog — get all active products for export (VAL-CATALOG-011)
// ============================================================================

/**
 * Export the authenticated provider's active product catalog as flat data.
 * Returns simplified product records suitable for CSV/Excel export.
 * @returns Array of simplified product objects with export-friendly field names
 */
export const getExportData = query({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_provider", (q) => q.eq("providerId", identity.tokenIdentifier))
      .collect();

    // Only export active products
    return products
      .filter((p) => p.active !== false)
      .map((p) => ({
        name: p.name,
        category: p.category,
        subcategory: p.subcategory ?? "",
        brand: p.brand,
        price: p.price,
        unit: p.unitOfMeasure ?? "",
        presentation: p.presentation,
        provider: p.providerId,
        tags: p.tags.join(", "),
        reviewStatus: p.reviewStatus ?? "",
      }));
  },
});

// ============================================================================
// Statistics tracking — view count and search appearance increments
// ============================================================================

/**
 * Increment the view count for a single product.
 * Used to track product popularity for statistics.
 * @param args.id - The product document ID
 * @returns Object with success status and the new view count
 */
export const incrementViewCount = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new Error("Product not found");
    }
    const currentCount = product.viewCount ?? 0;
    await ctx.db.patch(args.id, { viewCount: currentCount + 1 });
    return { success: true, viewCount: currentCount + 1 };
  },
});

/**
 * Increment the search appearance count for multiple products.
 * Used to track how often products appear in search results.
 * @param args.ids - Array of product document IDs to increment
 * @returns Object with success status and the number of products updated
 */
export const incrementSearchAppearances = mutation({
  args: { ids: v.array(v.id("products")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    for (const id of args.ids) {
      const product = await ctx.db.get(id);
      if (!product) continue;
      const currentCount = product.searchAppearances ?? 0;
      await ctx.db.patch(id, { searchAppearances: currentCount + 1 });
    }
    return { success: true, updated: args.ids.length };
  },
});
