import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit } from "./lib/rateLimiter";

/**
 * List all registered providers (public, used for provider filter on /buscar).
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("providers").collect();
  },
});

/**
 * Get the current authenticated provider's record.
 * Returns null if no provider record exists yet.
 */
export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const provider = await ctx.db
      .query("providers")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.tokenIdentifier))
      .unique();

    return provider ?? null;
  },
});

/**
 * Create or update a provider record from Clerk identity.
 * Called on login/signup to auto-sync provider data.
 * Uses tokenIdentifier as the canonical stable identifier (per Convex guidelines).
 */
export const createOrUpdateProvider = mutation({
  args: {
    businessName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    checkRateLimit(ctx, identity.tokenIdentifier);

    const clerkId = identity.tokenIdentifier;
    const name = identity.name ?? "Proveedor";
    const email = identity.email ?? "";

    const existing = await ctx.db
      .query("providers")
      .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      // Update existing provider — refresh name/email, preserve optional fields
      await ctx.db.patch(existing._id, {
        name,
        email,
        ...(args.businessName !== undefined ? { businessName: args.businessName } : {}),
      });
      return existing._id;
    }

    // Create new provider record
    return await ctx.db.insert("providers", {
      clerkId,
      name,
      email,
      businessName: args.businessName,
      createdAt: Date.now(),
    });
  },
});
