import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ============================================================================
// Public catalog queries (RF-006, RF-007, RF-008) — comercio sees ALL products
// ============================================================================

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
    return await ctx.db.query("products").take(limit);
  }
});

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
      return await ctx.db.query("products").take(limit);
    }

    // Use array index for the first tag (element-wise match), filter remaining in memory
    const firstTag = args.tags[0];
    const products = await ctx.db
      .query("products")
      .withIndex("by_tags", (q) => q.eq("tags", firstTag as unknown as string[]))
      .collect();

    // AND logic for remaining tags
    return products
      .filter((product) => args.tags.every((tag) => product.tags.includes(tag)))
      .slice(0, limit);
  }
});

// Búsqueda semántica/fuzzy (RF-012)
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
      return await ctx.db.query("products").take(limit);
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

    return results;
  }
});

// ============================================================================
// Provider catalog management (RF-004, RNF-007) — provider sees ONLY their products
// ============================================================================

export const listOwn = query({
  args: {
    limit: v.optional(v.number()),
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

    return await ctx.db
      .query("products")
      .withIndex("by_provider", (q) => q.eq("providerId", identity.tokenIdentifier))
      .take(limit);
  }
});

// ============================================================================
// Mutations (RF-004) — require auth, products scoped to provider
// ============================================================================

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

// ============================================================================
// Product detail (RF-008) — public, any authenticated user can view
// ============================================================================

export const getProduct = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new Error("Product not found");
    }
    if (product.providerId !== identity.tokenIdentifier) {
      throw new Error("Not authorized to delete this product");
    }

    return await ctx.db.delete(args.id);
  },
});

// ============================================================================
// Inline edit — provider updates individual product fields (VAL-CATALOG-002, VAL-CATALOG-005)
// ============================================================================

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
    return { success: true };
  },
});

// ============================================================================
// Batch publish — set all needs_review products to ok (VAL-CATALOG-004)
// ============================================================================

export const batchPublishAll = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

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
