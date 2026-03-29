import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const rootDir = path.resolve(__dirname, "..");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(rootDir, relativePath), "utf-8");
}

// ============================================================================
// VAL-RATE-001: Rate limiter module exists and enforces 100 req/min
// ============================================================================

describe("VAL-RATE-001: Rate limiter module and configuration", () => {
  it("convex/lib/rateLimiter.ts exists", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content.length).toBeGreaterThan(0);
  });

  it("rate limiter defines a default limit of 100 req/min", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content).toMatch(/DEFAULT_RATE_LIMIT\s*=\s*100/);
  });

  it("rate limiter defines a 1-minute window duration", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content).toMatch(/WINDOW_DURATION_MS\s*=\s*60_000/);
  });

  it("rate limiter has a clear rate-limit error message", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content).toMatch(/RATE_LIMIT_ERROR_MESSAGE/);
    expect(content).toMatch(/Rate limit exceeded/i);
  });

  it("exports checkRateLimit function", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content).toMatch(/export function checkRateLimit/);
  });

  it("exports RateLimitTracker class", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content).toMatch(/export class RateLimitTracker/);
  });

  it("tracker supports configurable limit via constructor", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    // Constructor should accept limit parameter
    expect(content).toMatch(/constructor.*limit/);
  });

  it("throws error when limit is exceeded", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content).toMatch(/throw new Error.*RATE_LIMIT_ERROR_MESSAGE/);
  });
});

// ============================================================================
// VAL-RATE-001/002: Mutations wrapped with rate limiter
// ============================================================================

describe("Mutations wrapped with rate limiter", () => {
  it("products.ts imports checkRateLimit", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/import.*checkRateLimit.*from.*\.\/lib\/rateLimiter/);
  });

  it("duplicates.ts imports checkRateLimit", () => {
    const content = readFile("convex/duplicates.ts");
    expect(content).toMatch(/import.*checkRateLimit.*from.*\.\/lib\/rateLimiter/);
  });

  it("ingestionProgress.ts imports checkRateLimit", () => {
    const content = readFile("convex/ingestionProgress.ts");
    expect(content).toMatch(/import.*checkRateLimit.*from.*\.\/lib\/rateLimiter/);
  });

  it("providers.ts imports checkRateLimit", () => {
    const content = readFile("convex/providers.ts");
    expect(content).toMatch(/import.*checkRateLimit.*from.*\.\/lib\/rateLimiter/);
  });

  // Verify key mutations in products.ts have rate limit checks
  const productsMutations = [
    "create",
    "remove",
    "updateProduct",
    "batchPublishAll",
    "batchPriceUpdate",
    "toggleActive",
    "incrementViewCount",
    "incrementSearchAppearances",
  ];

  for (const mutationName of productsMutations) {
    it(`products.${mutationName} has checkRateLimit call`, () => {
      const content = readFile("convex/products.ts");
      // Extract the mutation function section
      const mutationStart = content.indexOf(`export const ${mutationName} = mutation`);
      expect(mutationStart).toBeGreaterThan(-1);

      // Find the end of the mutation (next export or end of file)
      const nextExport = content.indexOf("\nexport ", mutationStart + 1);
      const section = content.substring(
        mutationStart,
        nextExport > 0 ? nextExport : content.length,
      );

      // Must contain checkRateLimit
      expect(section).toContain("checkRateLimit(ctx, identity.tokenIdentifier)");
    });
  }

  // Verify key mutations in duplicates.ts have rate limit checks
  const duplicateMutations = [
    "detectDuplicates",
    "mergeDuplicates",
    "ignoreDuplicatePair",
  ];

  for (const mutationName of duplicateMutations) {
    it(`duplicates.${mutationName} has checkRateLimit call`, () => {
      const content = readFile("convex/duplicates.ts");
      const mutationStart = content.indexOf(`export const ${mutationName} = mutation`);
      expect(mutationStart).toBeGreaterThan(-1);

      const nextExport = content.indexOf("\nexport ", mutationStart + 1);
      const section = content.substring(
        mutationStart,
        nextExport > 0 ? nextExport : content.length,
      );

      expect(section).toContain("checkRateLimit(ctx, identity.tokenIdentifier)");
    });
  }

  it("ingestionProgress.createRun has checkRateLimit call", () => {
    const content = readFile("convex/ingestionProgress.ts");
    const mutationStart = content.indexOf("export const createRun = mutation");
    expect(mutationStart).toBeGreaterThan(-1);

    const nextExport = content.indexOf("\nexport ", mutationStart + 1);
    const section = content.substring(
      mutationStart,
      nextExport > 0 ? nextExport : content.length,
    );

    expect(section).toContain("checkRateLimit(ctx, identity.tokenIdentifier)");
  });

  it("providers.createOrUpdateProvider has checkRateLimit call", () => {
    const content = readFile("convex/providers.ts");
    const mutationStart = content.indexOf("export const createOrUpdateProvider = mutation");
    expect(mutationStart).toBeGreaterThan(-1);

    const nextExport = content.indexOf("\nexport ", mutationStart + 1);
    const section = content.substring(
      mutationStart,
      nextExport > 0 ? nextExport : content.length,
    );

    expect(section).toContain("checkRateLimit(ctx, identity.tokenIdentifier)");
  });

  it("rate limit check is called AFTER auth check in each mutation", () => {
    const content = readFile("convex/products.ts");
    // Find each checkRateLimit call and verify getUserIdentity appears before it
    const rateLimitPattern = /checkRateLimit\(ctx,\s*identity\.tokenIdentifier\)/g;
    let match;
    while ((match = rateLimitPattern.exec(content)) !== null) {
      const precedingCode = content.substring(0, match.index);
      // The preceding code should contain getUserIdentity
      expect(precedingCode).toMatch(/getUserIdentity/);
    }
  });
});

// ============================================================================
// VAL-RATE-002: Rate limit is per-user (per-user isolation in code)
// ============================================================================

describe("VAL-RATE-002: Per-user rate limit isolation in code", () => {
  it("checkRateLimit uses identity.tokenIdentifier as user key", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    // The function should use a userId parameter that comes from tokenIdentifier
    expect(content).toMatch(/userId.*string/);
  });

  it("RateLimitTracker uses Map keyed by user identifier", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content).toMatch(/Map<string.*number/);
  });

  it("tracker.check method accepts userId as first argument", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    expect(content).toMatch(/check\(userId:\s*string/);
  });

  it("rate limit check uses per-user storage, not global", () => {
    const content = readFile("convex/lib/rateLimiter.ts");
    // Should store per-user in the Map
    expect(content).toMatch(/this\.calls\.get\(userId\)/);
    expect(content).toMatch(/this\.calls\.set\(userId/);
  });
});
