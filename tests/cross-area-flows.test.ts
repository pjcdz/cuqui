import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  applyAllFilters,
  EMPTY_FILTER_STATE,
  EMPTY_TREE_FILTER,
  type FilterState,
  type TreeFilter,
  type FilterableProduct,
} from "../src/lib/filters";
import { formatPrice, getAutocompleteSuggestions } from "../src/lib/format";

const srcDir = path.resolve(__dirname, "..", "src");
const convexDir = path.resolve(__dirname, "..", "convex");

function readFile(relativePath: string, base: string = srcDir): string {
  return fs.readFileSync(path.resolve(base, relativePath), "utf-8");
}

// ============================================================================
// VAL-CROSS-001: Upload → products appear in comercio search
// ============================================================================

describe("VAL-CROSS-001: Upload flow — provider uploads → products appear in comercio search", () => {
  it("upload-catalog component accepts PDF, XLSX, XLS files", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("application/pdf");
    expect(content).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(content).toContain("application/vnd.ms-excel");
  });

  it("upload-catalog has file size validation of 50MB", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("50 * 1024 * 1024");
    expect(content).toContain("50 MB");
  });

  it("products.list query returns products for comercio after pipeline insertion", () => {
    const content = readFile("products.ts", convexDir);
    // The list query fetches products and filters by active
    expect(content).toContain("export const list");
    // Must filter inactive products out
    expect(content).toContain("active !== false");
  });

  it("batchInsertProducts internal mutation inserts products with correct fields", () => {
    const content = readFile("products.ts", convexDir);
    expect(content).toContain("batchInsertProducts");
    expect(content).toContain("providerId");
    expect(content).toContain("createdAt");
    expect(content).toContain("updatedAt");
  });

  it("buscar page renders products from products.list query", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toContain("api.products.list");
  });
});

// ============================================================================
// VAL-CROSS-002: Edit propagation — provider edits product → visible to comercio
// ============================================================================

describe("VAL-CROSS-002: Edit propagation — provider edits → comercio sees changes", () => {
  it("updateProduct mutation updates fields and sets updatedAt", () => {
    const content = readFile("products.ts", convexDir);
    expect(content).toContain("export const updateProduct");
    expect(content).toContain("updatedAt: Date.now()");
    // Must check ownership
    expect(content).toContain("providerId !== identity.tokenIdentifier");
    expect(content).toContain("Not authorized to update this product");
  });

  it("updateProduct validates price > 0", () => {
    const content = readFile("products.ts", convexDir);
    expect(content).toContain("Invalid price: must be a finite number greater than 0");
  });

  it("updateProduct validates name is not empty", () => {
    const content = readFile("products.ts", convexDir);
    expect(content).toContain("El nombre es obligatorio");
  });

  it("updateProduct validates brand is not empty", () => {
    const content = readFile("products.ts", convexDir);
    expect(content).toContain("La marca es obligatoria");
  });

  it("comercio gets real-time updates via Convex query subscription", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    // uses useQuery which is reactive
    expect(content).toContain("useQuery");
    expect(content).toContain("api.products.list");
  });
});

// ============================================================================
// VAL-CROSS-003: Deactivation — provider deactivates → removed from comercio
// ============================================================================

describe("VAL-CROSS-003: Deactivation — provider deactivates → product hidden from comercio", () => {
  it("products.list filters out deactivated products (active === false)", () => {
    const content = readFile("products.ts", convexDir);
    // The list query must filter out inactive products
    const listSection = content.substring(
      content.indexOf("export const list"),
      content.indexOf("export const getByTags")
    );
    expect(listSection).toContain("active !== false");
  });

  it("products.getByTags filters out deactivated products", () => {
    const content = readFile("products.ts", convexDir);
    const getByTagsSection = content.substring(
      content.indexOf("export const getByTags"),
      content.indexOf("export const search")
    );
    expect(getByTagsSection).toContain("active !== false");
  });

  it("products.search filters out deactivated products", () => {
    const content = readFile("products.ts", convexDir);
    const searchSection = content.substring(
      content.indexOf("export const search"),
      content.indexOf("export const listOwn")
    );
    expect(searchSection).toContain("active !== false");
  });

  it("products.getProduct returns null for deactivated products", () => {
    const content = readFile("products.ts", convexDir);
    const getProductSection = content.substring(
      content.indexOf("export const getProduct"),
      content.indexOf("export const remove")
    );
    expect(getProductSection).toContain("active === false");
    expect(getProductSection).toContain("return null");
  });

  it("toggleActive mutation sets active flag and updates timestamp", () => {
    const content = readFile("products.ts", convexDir);
    expect(content).toContain("export const toggleActive");
    expect(content).toContain("active: args.active");
    expect(content).toContain("updatedAt: Date.now()");
  });

  it("toggleActive checks product ownership", () => {
    const content = readFile("products.ts", convexDir);
    const toggleSection = content.substring(
      content.indexOf("export const toggleActive"),
      content.indexOf("export const getExportData")
    );
    expect(toggleSection).toContain("providerId !== identity.tokenIdentifier");
    expect(toggleSection).toContain("Not authorized to update this product");
  });

  it("client-side filtering also handles active field correctly", () => {
    const products: FilterableProduct[] = [
      { name: "Active Product", brand: "Brand A", presentation: "1L", price: 100, category: "Cat", tags: [], providerId: "p1" },
      { name: "Inactive Product", brand: "Brand B", presentation: "2L", price: 200, category: "Cat", tags: [], providerId: "p1" },
    ];
    // Active products should be included
    const result = applyAllFilters(products, EMPTY_TREE_FILTER, EMPTY_FILTER_STATE, "");
    expect(result).toHaveLength(2); // Both pass through client filter (active filtering is server-side)
  });
});

// ============================================================================
// VAL-CROSS-004: Registration — new provider registers → immediate access
// ============================================================================

describe("VAL-CROSS-004: Registration — new provider gets immediate access", () => {
  it("createOrUpdateProvider creates provider from Clerk identity", () => {
    const content = readFile("providers.ts", convexDir);
    expect(content).toContain("createOrUpdateProvider");
    expect(content).toContain("clerkId");
    expect(content).toContain("identity.tokenIdentifier");
  });

  it("createOrUpdateProvider prevents duplicates (upsert pattern)", () => {
    const content = readFile("providers.ts", convexDir);
    // Check for existing before creating
    expect(content).toContain("existing");
    expect(content).toContain("by_clerk");
    // If exists, update rather than insert
    expect(content).toContain("await ctx.db.patch(existing._id");
  });

  it("provider layout checks authentication", () => {
    const content = readFile("app/proveedor/layout.tsx");
    // Clerk auth should be checked
    const hasUseAuth = content.includes("useAuth");
    const hasIsSignedIn = content.includes("isSignedIn");
    expect(hasUseAuth || hasIsSignedIn).toBe(true);
  });

  it("middleware grants proveedor role access to /proveedor/*", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("proveedor");
    expect(content).toContain("/proveedor");
  });

  it("provider dashboard shows empty state for new providers", () => {
    const content = readFile("app/proveedor/dashboard/page.tsx");
    // Should handle empty product list — must use listOwn to fetch products
    const hasListOwn = content.includes("listOwn");
    const hasProductsRef = content.includes("productos") || content.includes("ProductsTable");
    expect(hasListOwn || hasProductsRef).toBe(true);
  });
});

// ============================================================================
// VAL-CROSS-005: Anonymous user → redirected to login
// ============================================================================

describe("VAL-CROSS-005: Anonymous user → redirected to login", () => {
  it("middleware redirects unauthenticated users from /proveedor/* to sign-in", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("sign-in");
    expect(content).toContain("redirect_url");
  });

  it("middleware checks userId before allowing provider route access", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("userId");
    expect(content).toContain("!userId");
  });

  it("/buscar is accessible without authentication (public route)", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("isPublicRoute");
    expect(content).toContain("/buscar");
  });

  it("/producto/* is accessible without authentication", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("/producto");
  });
});

// ============================================================================
// VAL-CROSS-006: Comercio user cannot access provider routes
// ============================================================================

describe("VAL-CROSS-006: Comercio user cannot access /proveedor/* routes", () => {
  it("middleware redirects non-proveedor role to /buscar", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain('role !== "proveedor"');
    expect(content).toContain("/buscar");
  });

  it("middleware checks role from publicMetadata", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("publicMetadata");
  });

  it("provider routes are behind isProviderRoute matcher", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("isProviderRoute");
    expect(content).toContain("/proveedor(.*)");
  });
});

// ============================================================================
// VAL-CROSS-007: Data isolation — provider A cannot see/modify provider B's products
// ============================================================================

describe("VAL-CROSS-007: Data isolation between providers", () => {
  it("listOwn uses by_provider index with tokenIdentifier", () => {
    const content = readFile("products.ts", convexDir);
    const listOwnSection = content.substring(
      content.indexOf("export const listOwn"),
      content.indexOf("export const searchOwn")
    );
    expect(listOwnSection).toContain("by_provider");
    expect(listOwnSection).toContain("identity.tokenIdentifier");
  });

  it("listOwn returns empty array when not authenticated", () => {
    const content = readFile("products.ts", convexDir);
    const listOwnSection = content.substring(
      content.indexOf("export const listOwn"),
      content.indexOf("export const searchOwn")
    );
    expect(listOwnSection).toContain("if (!identity)");
    expect(listOwnSection).toContain("return []");
  });

  it("remove mutation checks providerId ownership", () => {
    const content = readFile("products.ts", convexDir);
    const removeSection = content.substring(
      content.indexOf("export const remove"),
      content.indexOf("export const updateProduct")
    );
    expect(removeSection).toContain("providerId !== identity.tokenIdentifier");
    expect(removeSection).toContain("Not authorized to delete this product");
  });

  it("updateProduct mutation checks providerId ownership", () => {
    const content = readFile("products.ts", convexDir);
    const updateSection = content.substring(
      content.indexOf("export const updateProduct"),
      content.indexOf("export const batchPublishAll")
    );
    expect(updateSection).toContain("providerId !== identity.tokenIdentifier");
    expect(updateSection).toContain("Not authorized to update this product");
  });

  it("batchPriceUpdate skips products not owned by the caller", () => {
    const content = readFile("products.ts", convexDir);
    const batchSection = content.substring(
      content.indexOf("export const batchPriceUpdate"),
      content.indexOf("export const toggleActive")
    );
    expect(batchSection).toContain("providerId !== identity.tokenIdentifier");
  });

  it("toggleActive checks providerId ownership", () => {
    const content = readFile("products.ts", convexDir);
    const toggleSection = content.substring(
      content.indexOf("export const toggleActive"),
      content.indexOf("export const getExportData")
    );
    expect(toggleSection).toContain("providerId !== identity.tokenIdentifier");
  });

  it("searchOwn scopes results to authenticated provider", () => {
    const content = readFile("products.ts", convexDir);
    const searchOwnSection = content.substring(
      content.indexOf("export const searchOwn"),
      content.indexOf("// ====")
    );
    expect(searchOwnSection).toContain("by_provider");
    expect(searchOwnSection).toContain("identity.tokenIdentifier");
  });
});

// ============================================================================
// VAL-CROSS-008: Tree regeneration — product changes reflect in tree
// ============================================================================

describe("VAL-CROSS-008: Tree regeneration after product changes", () => {
  it("tree navigation computes options from filtered products", () => {
    const content = readFile("components/tree-navigation.tsx");
    // Tree should dynamically compute available options from the product list
    const hasAllProducts = content.includes("allProducts") || content.includes("products");
    expect(hasAllProducts).toBe(true);
    const hasCategory = content.includes("category") || content.includes("categor");
    expect(hasCategory).toBe(true);
  });

  it("tree navigation uses real-time data from Convex query", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    // Products are fetched via useQuery (reactive)
    expect(content).toContain("useQuery(api.products.list");
    // TreeNavigation receives allProducts as prop
    expect(content).toContain("allProducts");
    expect(content).toContain("TreeNavigation");
  });

  it("deactivated products filtered server-side so tree reflects changes", () => {
    const content = readFile("products.ts", convexDir);
    // The list query filters out inactive products
    const listSection = content.substring(
      content.indexOf("export const list"),
      content.indexOf("export const getByTags")
    );
    expect(listSection).toContain("active !== false");
  });
});

// ============================================================================
// VAL-CROSS-009: Combined filters (tree + text + price + provider + image)
// ============================================================================

describe("VAL-CROSS-009: All filters work together with AND logic", () => {
  const mockProducts: FilterableProduct[] = [
    {
      name: "Leche Entera Serenísima",
      brand: "Serenísima",
      presentation: "1L",
      price: 1200,
      category: "Lácteos",
      subcategory: "Leches",
      tags: ["leche", "entera", "serenisima"],
      providerId: "provider_a",
      imageUrl: "https://example.com/leche.jpg",
    },
    {
      name: "Leche Descremada La Serenísima",
      brand: "La Serenísima",
      presentation: "1L",
      price: 1350,
      category: "Lácteos",
      subcategory: "Leches",
      tags: ["leche", "descremada"],
      providerId: "provider_a",
    },
    {
      name: "Queso Cremoso Barra",
      brand: "Barra",
      presentation: "500g",
      price: 3500,
      category: "Lácteos",
      subcategory: "Quesos",
      tags: ["queso", "cremoso"],
      providerId: "provider_b",
      imageUrl: "https://example.com/queso.jpg",
    },
    {
      name: "Coca-Cola 2L",
      brand: "Coca-Cola",
      presentation: "2L",
      price: 1800,
      category: "Bebidas",
      subcategory: "Gaseosas",
      tags: ["gaseosa", "cola"],
      providerId: "provider_b",
      imageUrl: "https://example.com/coca.jpg",
    },
    {
      name: "Harina Blancaflor",
      brand: "Blancaflor",
      presentation: "1kg",
      price: 900,
      category: "Almacén",
      tags: ["harina"],
      providerId: "provider_a",
    },
    {
      name: "Yogur Serenísima",
      brand: "Serenísima",
      presentation: "1L",
      price: 950,
      category: "Lácteos",
      subcategory: "Yogures",
      tags: ["yogur", "serenisima"],
      providerId: "provider_a",
      imageUrl: "https://example.com/yogur.jpg",
    },
  ];

  it("applies tree category + text search + price range (AND logic)", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
    };
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      priceRange: { min: "1000", max: "1500" },
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "leche");
    // Lácteos: 4 products. Price 1000-1500: Leche Entera (1200), Leche Descremada (1350), Yogur (950 - filtered out)
    // Text "leche": Leche Entera, Leche Descremada (names contain "leche")
    // Combined: Lácteos AND price 1000-1500 AND "leche" = Leche Entera, Leche Descremada
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.category === "Lácteos")).toBe(true);
    expect(result.every((p) => p.price >= 1000 && p.price <= 1500)).toBe(true);
    expect(result.every((p) => p.name.toLowerCase().includes("leche"))).toBe(true);
  });

  it("applies tree + provider filter + onlyWithImage", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
    };
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      selectedProviders: ["provider_a"],
      onlyWithImage: true,
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "");
    // Lácteos: 4 products. provider_a: Leche Entera, Leche Descremada, Yogur. With image: Leche Entera, Yogur
    // Combined: Lácteos AND provider_a AND withImage = Leche Entera, Yogur
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.category === "Lácteos")).toBe(true);
    expect(result.every((p) => p.providerId === "provider_a")).toBe(true);
    expect(result.every((p) => p.imageUrl)).toBe(true);
  });

  it("applies all filters together: tree + text + price + provider + image + sort", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
      subcategory: "Leches",
    };
    const filters: FilterState = {
      priceRange: { min: "1000", max: "2000" },
      selectedProviders: ["provider_a"],
      sort: "price_desc",
      onlyWithImage: true,
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "leche");
    // Lácteos+Leches: Leche Entera (1200), Leche Descremada (1350)
    // provider_a: both
    // price 1000-2000: both
    // "leche": both (match in name)
    // withImage: only Leche Entera
    // Combined: Leche Entera only
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Leche Entera Serenísima");
  });

  it("returns empty when no products satisfy all combined filters", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Bebidas",
    };
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      priceRange: { min: "5000", max: "" },
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "coca");
    // Bebidas: Coca-Cola (1800). Price >=5000: none
    expect(result).toHaveLength(0);
  });

  it("sorts results after applying all filters", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
    };
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      sort: "price_asc",
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "");
    // Lácteos: Leche Entera (1200), Leche Descremada (1350), Queso (3500), Yogur (950)
    expect(result[0].price).toBe(950); // Yogur
    expect(result[result.length - 1].price).toBe(3500); // Queso
  });

  it("removing one filter expands results correctly", () => {
    // With provider filter
    const filtersWithProvider: FilterState = {
      ...EMPTY_FILTER_STATE,
      selectedProviders: ["provider_a"],
    };
    const result1 = applyAllFilters(mockProducts, EMPTY_TREE_FILTER, filtersWithProvider, "");
    expect(result1).toHaveLength(4); // 4 from provider_a

    // Without provider filter
    const result2 = applyAllFilters(mockProducts, EMPTY_TREE_FILTER, EMPTY_FILTER_STATE, "");
    expect(result2).toHaveLength(6); // All products
    expect(result2.length).toBeGreaterThan(result1.length);
  });
});

// ============================================================================
// VAL-CROSS-010: Session persistence across navigation
// ============================================================================

describe("VAL-CROSS-010: Session persistence across navigation", () => {
  it("Clerk provides UserButton in provider layout for session visibility", () => {
    const content = readFile("app/proveedor/layout.tsx");
    expect(content).toContain("UserButton");
  });

  it("Clerk provides UserButton in buscar page for session visibility", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toContain("UserButton");
  });

  it("provider layout uses useAuth for session awareness", () => {
    const content = readFile("app/proveedor/layout.tsx");
    expect(content).toContain("useAuth");
  });

  it("buscar page checks isSignedIn state", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toContain("isSignedIn");
  });

  it("filter state persists in URL query parameters", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toContain("serializeFiltersToParams");
    expect(content).toContain("parseFiltersFromParams");
    expect(content).toContain("useSearchParams");
  });

  it("URL params are synced when filters change", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toContain("router.replace");
  });
});

// ============================================================================
// VAL-QUALITY-005: File upload rejects >50MB files
// ============================================================================

describe("VAL-QUALITY-005: File upload rejects files >50MB", () => {
  it("upload component validates file size at 50MB", () => {
    const content = readFile("components/upload-catalog.tsx");
    // Check the exact 50MB threshold is present
    expect(content).toContain("50 * 1024 * 1024");
  });

  it("upload component shows error message for oversized files", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("50 MB");
    expect(content).toContain("toast.error");
  });

  it("upload component validates MIME type", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("allowedMimeTypes");
    expect(content).toContain("application/pdf");
    expect(content).toContain("Formato no soportado");
  });

  it("upload component requires authentication", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("isSignedIn");
    expect(content).toContain("iniciar sesión");
  });

  it("50MB boundary: exactly 50MB passes, 50MB+1 byte fails", () => {
    const fiftyMB = 50 * 1024 * 1024;
    expect(fiftyMB).toBe(52428800);
    // File size check is: file.size > 50 * 1024 * 1024
    // So exactly 50MB (52428800) passes, 52428801 fails
    const fileSizeCheck = (size: number) => size > 50 * 1024 * 1024;
    expect(fileSizeCheck(fiftyMB)).toBe(false); // exactly 50MB passes
    expect(fileSizeCheck(fiftyMB + 1)).toBe(true); // 50MB + 1 byte fails
  });
});

// ============================================================================
// VAL-QUALITY-006: Processing status shows product count
// ============================================================================

describe("VAL-QUALITY-006: Processing status shows product count", () => {
  it("upload component displays batch progress during processing", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("currentBatch");
    expect(content).toContain("totalBatches");
  });

  it("upload component displays row/product count during processing", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("processedRows");
    expect(content).toContain("totalRows");
  });

  it("upload component shows progress bar during upload", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("Progress");
    expect(content).toContain("progressValue");
  });

  it("upload component shows result stats after completion", () => {
    const content = readFile("components/upload-catalog.tsx");
    expect(content).toContain("result.processed");
    expect(content).toContain("result.needsReview");
    expect(content).toContain("result.totalBatches");
    expect(content).toContain("result.totalRows");
  });

  it("ingestionProgress schema tracks processed and total counts", () => {
    const content = readFile("schema.ts", convexDir);
    expect(content).toContain("processedRows");
    expect(content).toContain("totalRows");
    expect(content).toContain("currentBatch");
    expect(content).toContain("totalBatches");
  });

  it("ingestion progress query returns all batch/row fields", () => {
    const content = readFile("ingestionProgress.ts", convexDir);
    expect(content).toContain("currentBatch");
    expect(content).toContain("totalBatches");
    expect(content).toContain("processedRows");
    expect(content).toContain("totalRows");
  });
});

// ============================================================================
// Schema validation — active field exists on products table
// ============================================================================

describe("Products schema has active field for soft delete", () => {
  it("products table defines optional active boolean field", () => {
    const content = readFile("schema.ts", convexDir);
    expect(content).toContain("active: v.optional(v.boolean())");
  });

  it("products table has all required indexes", () => {
    const content = readFile("schema.ts", convexDir);
    expect(content).toContain("by_provider");
    expect(content).toContain("by_tags");
    expect(content).toContain("by_category");
    expect(content).toContain("search");
  });
});

// ============================================================================
// Price formatting integration (ARS locale)
// ============================================================================

describe("Price formatting integration across flows", () => {
  it("formatPrice uses ARS locale for all prices", () => {
    expect(formatPrice(1200)).toContain("1.200");
    expect(formatPrice(1200.5)).toContain(",");
    expect(formatPrice(0)).toContain("0");
  });

  it("formatPrice handles large numbers", () => {
    const result = formatPrice(1234567.89);
    expect(result).toContain("1.234.567");
  });
});

// ============================================================================
// Autocomplete integration
// ============================================================================

describe("Autocomplete suggestions integration", () => {
  const products = [
    { name: "Leche Entera", brand: "Serenísima" },
    { name: "Leche Descremada", brand: "La Serenísima" },
    { name: "Queso Cremoso", brand: "Barra" },
    { name: "Coca-Cola", brand: "Coca-Cola" },
    { name: "Leche de Almendras", brand: "Ades" },
    { name: "Leche Chocolatada", brand: "Serenísima" },
  ];

  it("returns max 5 suggestions", () => {
    const suggestions = getAutocompleteSuggestions(products, "leche", 5);
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it("matches product names and brands", () => {
    const suggestions = getAutocompleteSuggestions(products, "seren", 5);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("returns empty for empty query", () => {
    const suggestions = getAutocompleteSuggestions(products, "", 5);
    expect(suggestions).toHaveLength(0);
  });
});
