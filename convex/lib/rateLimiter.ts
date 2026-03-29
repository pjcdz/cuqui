/**
 * Rate limiter for Convex mutations (RNF-010).
 *
 * Tracks mutation calls per user per 1-minute window using a sliding window
 * approach. When the configured limit is exceeded, throws an error with a
 * clear rate-limit message.
 *
 * Usage in mutations:
 * ```ts
 * import { checkRateLimit } from "./lib/rateLimiter";
 *
 * export const myMutation = mutation({
 *   args: { ... },
 *   handler: async (ctx, args) => {
 *     const identity = await ctx.auth.getUserIdentity();
 *     if (!identity) throw new Error("Authentication required");
 *     checkRateLimit(ctx, identity.tokenIdentifier);
 *     // ... mutation logic
 *   },
 * });
 * ```
 */

/** Default rate limit: 100 requests per minute per user */
export const DEFAULT_RATE_LIMIT = 100;

/** Window duration in milliseconds (1 minute) */
export const WINDOW_DURATION_MS = 60_000;

/** Error message thrown when rate limit is exceeded */
export const RATE_LIMIT_ERROR_MESSAGE =
  "Rate limit exceeded: too many requests. Please try again in a minute.";

/**
 * In-memory rate limit tracker for testing and standalone use.
 * Maps user identifier -> array of timestamps (ms since epoch).
 */
export class RateLimitTracker {
  private calls: Map<string, number[]> = new Map();
  private limit: number;
  private windowMs: number;

  constructor(limit: number = DEFAULT_RATE_LIMIT, windowMs: number = WINDOW_DURATION_MS) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /**
   * Record a call for the given user and check if the rate limit is exceeded.
   * Returns { allowed: true } if under the limit, { allowed: false, retryAfterMs } if exceeded.
   */
  check(userId: string, now: number = Date.now()): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const calls = this.calls.get(userId) ?? [];
    const windowStart = now - this.windowMs;

    // Remove calls outside the current window (sliding window)
    const activeCalls = calls.filter((ts) => ts > windowStart);

    if (activeCalls.length >= this.limit) {
      // The oldest call in the window determines when a slot opens up
      const oldestInWindow = activeCalls[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }

    // Record this call
    activeCalls.push(now);
    this.calls.set(userId, activeCalls);
    return { allowed: true };
  }

  /** Get the current call count for a user within the active window */
  getCount(userId: string, now: number = Date.now()): number {
    const calls = this.calls.get(userId) ?? [];
    const windowStart = now - this.windowMs;
    return calls.filter((ts) => ts > windowStart).length;
  }

  /** Reset all tracked calls (useful for testing) */
  reset(): void {
    this.calls.clear();
  }

  /** Get the configured limit */
  getLimit(): number {
    return this.limit;
  }

  /** Get the configured window duration in ms */
  getWindowMs(): number {
    return this.windowMs;
  }
}

/** Singleton tracker instance used by the Convex rate limit check */
const globalTracker = new RateLimitTracker();

/**
 * Get the global rate limit tracker (for testing purposes).
 */
export function getRateLimitTracker(): RateLimitTracker {
  return globalTracker;
}

/**
 * Check the rate limit for a user making a Convex mutation call.
 * Uses the in-memory tracker with a sliding 1-minute window.
 *
 * @param _ctx - Convex mutation context (reserved for future table-based tracking)
 * @param userId - Unique user identifier (typically identity.tokenIdentifier)
 * @param limit - Maximum requests per window (default: 100)
 * @param tracker - Optional tracker override (for testing)
 * @throws Error with rate limit message if exceeded
 */
export function checkRateLimit(
  _ctx: unknown,
  userId: string,
  limit: number = DEFAULT_RATE_LIMIT,
  tracker: RateLimitTracker = globalTracker,
): void {
  const now = Date.now();
  const result = tracker.check(userId, now);

  if (!result.allowed) {
    throw new Error(RATE_LIMIT_ERROR_MESSAGE);
  }
}

/**
 * Create a rate-limited wrapper for a mutation handler.
 *
 * Usage:
 * ```ts
 * export const myMutation = mutation({
 *   args: { ... },
 *   handler: withRateLimit(async (ctx, args) => {
 *     // ... mutation logic (already rate-limited)
 *   }),
 * });
 * ```
 *
 * Note: The handler must still check auth and get identity.tokenIdentifier.
 * This wrapper requires the identity to be passed as the third argument,
 * or the mutation handler must call checkRateLimit directly.
 */
export function withRateLimit<
  Ctx extends { auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string } | null> } },
  Args,
  Return,
>(
  handler: (ctx: Ctx, args: Args) => Promise<Return>,
  customLimit: number = DEFAULT_RATE_LIMIT,
): (ctx: Ctx, args: Args) => Promise<Return> {
  return async (ctx: Ctx, args: Args): Promise<Return> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }
    checkRateLimit(ctx, identity.tokenIdentifier, customLimit);
    return handler(ctx, args);
  };
}
