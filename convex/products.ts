import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    limit: v.optional(v.number()), // NEW: Optional limit parameter
  },
  handler: async (ctx, args) => {
    // Validate limit parameter
    const limit = args.limit || 50; // Default to 50 products
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

export const create = mutation({
  args: {
    name: v.string(),
    brand: v.string(),
    presentation: v.string(),
    price: v.number(),
    normalizedPrice: v.optional(v.number()),
    unitOfMeasure: v.optional(v.string()),
    quantity: v.optional(v.number()),
    multiplier: v.optional(v.number()),
    category: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // TODO: Get from auth when implemented
    const providerId = "temp-provider";
    // Runtime validation: enforce unitOfMeasure union type
    const validUnits = new Set(["litro", "ml", "kg", "g", "unidad"]);
    if (args.unitOfMeasure && !validUnits.has(args.unitOfMeasure)) {
      throw new Error(`Invalid unitOfMeasure: ${args.unitOfMeasure}. Must be one of: ${Array.from(validUnits).join(", ")}`);
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

    // Cross-field validation: quantity requires unitOfMeasure for semantic consistency
    if (args.quantity !== undefined && args.unitOfMeasure === undefined) {
      throw new Error(`Invalid state: quantity requires unitOfMeasure to be specified`);
    }

    const now = Date.now();
    return await ctx.db.insert("products", {
      ...args,
      providerId, // Set internally from local variable (auth-based in future)
      imageUrl: undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
});

export const getByTags = query({
  args: {
    tags: v.array(v.string()),
    limit: v.optional(v.number()), // NEW: Optional limit
  },
  handler: async (ctx, args) => {
    // Validate limit parameter
    const limit = args.limit || 500; // Default higher for tag filtering
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

    // TODO: Implement proper index-based filtering in v1.2
    // Current limitation: take(limit) + filter may miss matching products
    // beyond the first 'limit' documents. This is acceptable for current dataset size.
    const products = await ctx.db.query("products").take(limit);

    // Filtrar por todos los tags (AND logic)
    return products.filter(product =>
      args.tags.every(tag => product.tags.includes(tag))
    );
  }
});

// Búsqueda semántica/fuzzy (RF-012)
export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()), // NEW: Optional limit
  },
  handler: async (ctx, args) => {
    // Validate limit parameter
    const limit = args.limit || 500;
    if (args.limit !== undefined) {
      if (!isFinite(args.limit) || args.limit <= 0) {
        throw new Error(`Invalid limit: ${args.limit}. Must be a finite number greater than 0`);
      }
      if (args.limit > 1000) {
        throw new Error(`Invalid limit: ${args.limit}. Must be <= 1000 to prevent abuse`);
      }
    }

    const searchLower = args.query.toLowerCase();

    if (!searchLower || searchLower.trim() === "") {
      return await ctx.db.query("products").take(limit);
    }

    // TODO: Implement proper index-based filtering in v1.2
    // Current limitation: take(limit) + filter may miss matching products
    // beyond the first 'limit' documents. This is acceptable for current dataset size.
    const products = await ctx.db.query("products").take(limit);

    // Búsqueda fuzzy en nombre, marca, categoría y tags
    return products.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(searchLower);
      const brandMatch = product.brand.toLowerCase().includes(searchLower);
      const categoryMatch = product.category.toLowerCase().includes(searchLower);
      const tagsMatch = product.tags.some(tag =>
        tag.toLowerCase().includes(searchLower)
      );

      return nameMatch || brandMatch || categoryMatch || tagsMatch;
    });
  }
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const { id } = args;
    return await ctx.db.delete(id);
  }
});
