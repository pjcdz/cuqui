import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  }
});

export const create = mutation({
  args: {
    name: v.string(),
    brand: v.string(),
    presentation: v.string(),
    price: v.number(),
    category: v.string(),
    tags: v.array(v.string()),
    providerId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("products", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  }
});

export const getByTags = query({
  args: { tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const products = await ctx.db.query("products").collect();

    if (args.tags.length === 0) {
      return products;
    }

    // Filtrar por todos los tags (AND logic)
    return products.filter(product =>
      args.tags.every(tag => product.tags.includes(tag))
    );
  }
});
