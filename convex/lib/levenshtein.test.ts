import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
  levenshteinSimilarity,
  findDuplicatePairs,
} from "./levenshtein";

// ============================================================================
// levenshteinDistance
// ============================================================================

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns length of other string when one is empty", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });

  it("returns 0 for both empty strings", () => {
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("computes single substitution correctly", () => {
    expect(levenshteinDistance("cat", "car")).toBe(1);
  });

  it("computes single insertion correctly", () => {
    expect(levenshteinDistance("cat", "cart")).toBe(1);
  });

  it("computes single deletion correctly", () => {
    expect(levenshteinDistance("cart", "cat")).toBe(1);
  });

  it("computes multiple edits correctly", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });

  it("computes distance for completely different strings", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });

  it("is case sensitive", () => {
    expect(levenshteinDistance("Hello", "hello")).toBe(1);
  });

  it("handles Spanish characters correctly", () => {
    expect(levenshteinDistance("Leche", "Leché")).toBe(1);
  });

  it("handles product names typical in food catalogs", () => {
    // Similar product names
    expect(levenshteinDistance("Leche Entera 1L", "Leche Entera 1L")).toBe(0);
    expect(levenshteinDistance("Leche Entera 1L", "Leche Entera 1 L")).toBe(1);
    expect(levenshteinDistance("Leche Entera", "Leche entera")).toBe(1);
  });

  it("computes distance between similar brand names", () => {
    // Accented characters are different code points, but very close
    expect(levenshteinDistance("Serenisima", "Serenísima")).toBe(1);
    expect(levenshteinDistance("Serenisima", "Serenisima")).toBe(0);
  });

  it("handles long strings efficiently", () => {
    const a = "Producto con nombre muy largo para verificar performance";
    const b = "Producto con nombre muy largo para verificar performances";
    expect(levenshteinDistance(a, b)).toBe(1);
  });
});

// ============================================================================
// levenshteinSimilarity
// ============================================================================

describe("levenshteinSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(levenshteinSimilarity("hello", "hello")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(levenshteinSimilarity("abc", "xyz")).toBe(0);
  });

  it("returns correct ratio for similar strings", () => {
    // "cat" → "car": distance=1, maxLen=3, similarity=1-1/3=0.667
    const sim = levenshteinSimilarity("cat", "car");
    expect(sim).toBeCloseTo(1 - 1 / 3, 2);
  });

  it("returns higher similarity for closer strings", () => {
    const close = levenshteinSimilarity("leche entera", "leche entera 1l");
    const far = levenshteinSimilarity("leche entera", "yogurt natural");
    expect(close).toBeGreaterThan(far);
  });

  it("handles empty strings", () => {
    expect(levenshteinSimilarity("", "")).toBe(1);
    expect(levenshteinSimilarity("", "abc")).toBe(0);
  });
});

// ============================================================================
// findDuplicatePairs
// ============================================================================

describe("findDuplicatePairs", () => {
  const makeProduct = (
    id: string,
    name: string,
    brand = "TestBrand",
    presentation = "1L"
  ) => ({
    _id: id,
    name,
    brand,
    presentation,
    price: 100,
    category: "test",
    tags: [],
    providerId: "provider1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it("returns empty array for no products", () => {
    expect(findDuplicatePairs([])).toEqual([]);
  });

  it("returns empty array for single product", () => {
    expect(findDuplicatePairs([makeProduct("1", "Leche")])).toEqual([]);
  });

  it("detects identical product names as duplicates", () => {
    const products = [
      makeProduct("1", "Leche Entera 1L"),
      makeProduct("2", "Leche Entera 1L"),
    ];
    const pairs = findDuplicatePairs(products);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].productA).toBe("1");
    expect(pairs[0].productB).toBe("2");
    expect(pairs[0].similarity).toBe(1);
  });

  it("detects similar product names as duplicates", () => {
    const products = [
      makeProduct("1", "Leche Entera"),
      makeProduct("2", "Leche entera"), // only case difference
    ];
    const pairs = findDuplicatePairs(products);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag very different product names", () => {
    const products = [
      makeProduct("1", "Leche Entera 1L", "BrandA"),
      makeProduct("2", "Tomate Perita 500g", "BrandB"),
    ];
    const pairs = findDuplicatePairs(products);
    expect(pairs).toHaveLength(0);
  });

  it("sorts pairs by similarity descending", () => {
    const products = [
      makeProduct("1", "Leche Entera"),
      makeProduct("2", "Leche Entera 1L"),
      makeProduct("3", "Leche Descremada"),
    ];
    const pairs = findDuplicatePairs(products);
    if (pairs.length >= 2) {
      expect(pairs[0].similarity).toBeGreaterThanOrEqual(pairs[1].similarity);
    }
  });

  it("flags products with small name distance regardless of brand", () => {
    const products = [
      makeProduct("1", "Yogurt Natural", "BrandA"),
      makeProduct("2", "Yogurt Natural", "BrandB"),
    ];
    const pairs = findDuplicatePairs(products);
    // Names are identical, so nameDistance=0, similarity=1, should be flagged
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });

  it("handles products with different brands but very similar names", () => {
    const products = [
      makeProduct("1", "Queso Crema", "BrandA"),
      makeProduct("2", "Queso crem", "BrandB"),
    ];
    const pairs = findDuplicatePairs(products);
    // nameDistance is small (2), similarity high enough
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });
});
