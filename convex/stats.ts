import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get statistics for the current provider's dashboard.
 * Returns: active count, top 10 viewed, search appearances total, last update date.
 * Supports optional date range filter (startDate / endDate as epoch ms).
 */
export const getDashboardStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const providerId = identity.tokenIdentifier;

    // Fetch all products for this provider
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_provider", (q) => q.eq("providerId", providerId))
      .collect();

    // Apply date range filter if provided
    let products = allProducts;
    if (args.startDate !== undefined || args.endDate !== undefined) {
      products = allProducts.filter((p) => {
        // updatedAt is always present
        if (args.startDate !== undefined && p.updatedAt < args.startDate) {
          return false;
        }
        if (args.endDate !== undefined && p.updatedAt > args.endDate) {
          return false;
        }
        return true;
      });
    }

    // Active products count
    const activeProducts = products.filter((p) => p.active !== false);
    const activeCount = activeProducts.length;

    // Total products (including inactive)
    const totalCount = products.length;

    // Top 10 most viewed products
    const topViewed = [...activeProducts]
      .sort(
        (a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0)
      )
      .slice(0, 10)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        brand: p.brand,
        presentation: p.presentation,
        price: p.price,
        viewCount: p.viewCount ?? 0,
      }));

    // Total search appearances across all products
    const totalSearchAppearances = activeProducts.reduce(
      (sum, p) => sum + (p.searchAppearances ?? 0),
      0
    );

    // Average search appearances per product
    const avgSearchAppearances =
      activeCount > 0
        ? Math.round((totalSearchAppearances / activeCount) * 100) / 100
        : 0;

    // Last catalog update date (most recent updatedAt across ALL products, not just filtered)
    const lastUpdate =
      allProducts.length > 0
        ? Math.max(...allProducts.map((p) => p.updatedAt))
        : null;

    // Products needing review
    const needsReviewCount = products.filter(
      (p) => p.reviewStatus === "needs_review"
    ).length;

    // Inactive products count
    const inactiveCount = products.filter((p) => p.active === false).length;

    return {
      activeCount,
      totalCount,
      inactiveCount,
      needsReviewCount,
      topViewed,
      totalSearchAppearances,
      avgSearchAppearances,
      lastUpdate,
    };
  },
});

/**
 * Get product-level statistics for the provider (used for PDF export detail).
 * Returns all active products with their view counts and search appearances.
 */
export const getProductStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const providerId = identity.tokenIdentifier;

    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_provider", (q) => q.eq("providerId", providerId))
      .collect();

    // Filter active only
    let products = allProducts.filter((p) => p.active !== false);

    // Apply date range
    if (args.startDate !== undefined || args.endDate !== undefined) {
      products = products.filter((p) => {
        if (args.startDate !== undefined && p.updatedAt < args.startDate) {
          return false;
        }
        if (args.endDate !== undefined && p.updatedAt > args.endDate) {
          return false;
        }
        return true;
      });
    }

    return products.map((p) => ({
      name: p.name,
      brand: p.brand,
      presentation: p.presentation,
      price: p.price,
      category: p.category,
      subcategory: p.subcategory ?? "",
      viewCount: p.viewCount ?? 0,
      searchAppearances: p.searchAppearances ?? 0,
      updatedAt: p.updatedAt,
    }));
  },
});
