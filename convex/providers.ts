import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit } from "./lib/rateLimiter";
import {
  encryptField,
  decryptField,
} from "./lib/providerCrypto";

/**
 * List all registered providers (public, used for provider filter on /buscar).
 * Returns decrypted email and businessName for the results.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const providers = await ctx.db.query("providers").collect();
    // Decrypt sensitive fields for all providers
    return Promise.all(
      providers.map(async (p) => ({
        ...p,
        email: await decryptField(p.email),
        businessName: await decryptField(p.businessName),
      }))
    );
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

    if (!provider) {
      return null;
    }

    // Decrypt sensitive fields before returning
    return {
      ...provider,
      email: await decryptField(provider.email),
      businessName: await decryptField(provider.businessName),
    };
  },
});

/**
 * Create or update a provider record from Clerk identity.
 * Called on login/signup to auto-sync provider data.
 * Uses tokenIdentifier as the canonical stable identifier (per Convex guidelines).
 * Email and businessName are encrypted on write, decrypted on read (RNF-008).
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
      // Update existing provider — encrypt sensitive fields
      await ctx.db.patch(existing._id, {
        name,
        email: await encryptField(email),
        ...(args.businessName !== undefined
          ? { businessName: await encryptField(args.businessName) }
          : {}),
      });
      return existing._id;
    }

    // Create new provider record — encrypt sensitive fields
    return await ctx.db.insert("providers", {
      clerkId,
      name,
      email: await encryptField(email),
      businessName: args.businessName !== undefined
        ? await encryptField(args.businessName)
        : undefined,
      createdAt: Date.now(),
    });
  },
});
