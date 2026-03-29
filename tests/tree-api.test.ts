/**
 * Tests for the Tree API endpoint and tree builder utility.
 * Covers: VAL-TREE-001 (valid JSON tree), VAL-TREE-002 (cache headers, ETag, 304).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildTreeStructure,
  computeETag,
  type TreeProduct,
} from "@/lib/tree-builder";
import { NextRequest } from "next/server";

// Shared mock query function — tests can override this per-test
const mockQuery = vi.fn().mockResolvedValue([]);

// Mock ConvexHttpClient so route handler tests don't need a real Convex deployment
vi.mock("convex/browser", () => {
  return {
    ConvexHttpClient: vi.fn().mockImplementation(function (this: unknown, _url: unknown) {
      return { query: mockQuery };
    }),
  };
});

// Set required env var for route handler
process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";

// Import after mock setup
import { GET } from "@/app/api/tree/structure/route";

// ============================================================================
// Tree Builder Unit Tests
// ============================================================================

describe("buildTreeStructure", () => {
  it("returns correct tree levels array", () => {
    const result = buildTreeStructure([]);
    expect(result.levels).toEqual([
      "category",
      "subcategory",
      "brand",
      "presentation",
    ]);
  });

  it("returns nextLevel as 'category'", () => {
    const result = buildTreeStructure([]);
    expect(result.nextLevel).toBe("category");
  });

  it("returns empty options for no products", () => {
    const result = buildTreeStructure([]);
    expect(result.options).toEqual([]);
  });

  it("groups products by category with correct counts", () => {
    const products: TreeProduct[] = [
      { category: "Lácteos", brand: "Marca A", presentation: "1L" },
      { category: "Lácteos", brand: "Marca B", presentation: "500ml" },
      { category: "Carnes", brand: "Marca C", presentation: "1kg" },
      { category: "Lácteos", brand: "Marca A", presentation: "2L" },
    ];
    const result = buildTreeStructure(products);
    expect(result.options).toEqual([
      { name: "Carnes", productCount: 1 },
      { name: "Lácteos", productCount: 3 },
    ]);
  });

  it("filters out inactive products", () => {
    const products: TreeProduct[] = [
      { category: "Lácteos", brand: "Marca A", presentation: "1L", active: true },
      { category: "Carnes", brand: "Marca B", presentation: "1kg", active: false },
      { category: "Bebidas", brand: "Marca C", presentation: "2L" },
    ];
    const result = buildTreeStructure(products);
    expect(result.options).toEqual([
      { name: "Bebidas", productCount: 1 },
      { name: "Lácteos", productCount: 1 },
    ]);
  });

  it("uses 'Sin categoría' for products without category", () => {
    const products: TreeProduct[] = [
      { category: "", brand: "Marca A", presentation: "1L" },
    ];
    const result = buildTreeStructure(products);
    expect(result.options).toEqual([
      { name: "Sin categoría", productCount: 1 },
    ]);
  });

  it("sorts options alphabetically", () => {
    const products: TreeProduct[] = [
      { category: "Zapatos", brand: "M", presentation: "1" },
      { category: "Abarrotes", brand: "M", presentation: "1" },
      { category: "Lácteos", brand: "M", presentation: "1" },
    ];
    const result = buildTreeStructure(products);
    const names = result.options.map((o) => o.name);
    expect(names).toEqual(["Abarrotes", "Lácteos", "Zapatos"]);
  });
});

// ============================================================================
// ETag Tests
// ============================================================================

describe("computeETag", () => {
  it("returns a quoted string", () => {
    const etag = computeETag({ foo: "bar" });
    expect(etag).toMatch(/^"[0-9a-f]+"$/);
  });

  it("returns the same ETag for the same data", () => {
    const data = { options: [{ name: "test", productCount: 5 }] };
    expect(computeETag(data)).toBe(computeETag(data));
  });

  it("returns different ETags for different data", () => {
    const data1 = { options: [{ name: "test1", productCount: 5 }] };
    const data2 = { options: [{ name: "test2", productCount: 3 }] };
    expect(computeETag(data1)).not.toBe(computeETag(data2));
  });
});

// ============================================================================
// Route Handler Tests (VAL-TREE-001, VAL-TREE-002)
// ============================================================================

describe("GET /api/tree/structure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: return empty array
    mockQuery.mockResolvedValue([]);
  });

  it("returns 200 with valid JSON tree structure", async () => {
    // Mock Convex query to return sample products
    mockQuery.mockResolvedValue([
      { category: "Lácteos", brand: "Marca A", presentation: "1L", active: true },
      { category: "Lácteos", brand: "Marca B", presentation: "500ml", active: true },
      { category: "Carnes", brand: "Marca C", presentation: "1kg", active: true },
    ]);

    const request = new NextRequest("http://localhost:3000/api/tree/structure");
    const response = await GET(request);
    const data = await response.json();

    // VAL-TREE-001: Response status is 200
    expect(response.status).toBe(200);

    // VAL-TREE-001: Root object contains nextLevel field
    expect(data).toHaveProperty("nextLevel");
    expect(data.nextLevel).toBe("category");

    // VAL-TREE-001: options array exists with items containing product counts
    expect(data).toHaveProperty("options");
    expect(Array.isArray(data.options)).toBe(true);
    expect(data.options.length).toBeGreaterThan(0);
    for (const option of data.options) {
      expect(option).toHaveProperty("name");
      expect(option).toHaveProperty("productCount");
      expect(typeof option.productCount).toBe("number");
    }

    // VAL-TREE-001: Hierarchy follows category→subcategory→brand→presentation ordering
    expect(data).toHaveProperty("levels");
    expect(data.levels).toEqual([
      "category",
      "subcategory",
      "brand",
      "presentation",
    ]);
  });

  it("response includes Cache-Control with s-maxage=300", async () => {
    const request = new NextRequest("http://localhost:3000/api/tree/structure");
    const response = await GET(request);

    // VAL-TREE-002: Response includes Cache-Control header with s-maxage=300
    const cacheControl = response.headers.get("Cache-Control");
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("s-maxage=300");
    expect(cacheControl).toContain("stale-while-revalidate");
  });

  it("response includes ETag header", async () => {
    const request = new NextRequest("http://localhost:3000/api/tree/structure");
    const response = await GET(request);

    // VAL-TREE-002: Response includes ETag header
    const etag = response.headers.get("ETag");
    expect(etag).toBeTruthy();
    expect(etag).toMatch(/^"[0-9a-f]+"$/);
  });

  it("If-None-Match matching ETag returns 304", async () => {
    // First request to get ETag
    const request1 = new NextRequest("http://localhost:3000/api/tree/structure");
    const response1 = await GET(request1);
    const etag = response1.headers.get("ETag");
    expect(etag).toBeTruthy();

    // Second request with If-None-Match
    const request2 = new NextRequest("http://localhost:3000/api/tree/structure", {
      headers: { "If-None-Match": etag! },
    });
    const response2 = await GET(request2);

    // VAL-TREE-002: Request with If-None-Match matching ETag returns 304 Not Modified
    expect(response2.status).toBe(304);
  });

  it("If-None-Match with non-matching ETag returns 200", async () => {
    const request = new NextRequest("http://localhost:3000/api/tree/structure", {
      headers: { "If-None-Match": '"non-matching-etag"' },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
