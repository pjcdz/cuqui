import { describe, it, expect } from "vitest";
import {
  validatePriceRange,
  EMPTY_FILTER_STATE,
  EMPTY_TREE_FILTER,
  applyAllFilters,
  sortProducts,
  parseFiltersFromParams,
  serializeFiltersToParams,
  hasAnyActiveFilter,
  type FilterState,
  type TreeFilter,
  type SortOption,
  type FilterableProduct,
} from "../src/lib/filters";

// ============================================================================
// Price range validation tests (VAL-DISPLAY-006)
// ============================================================================

describe("validatePriceRange", () => {
  it("accepts empty price range", () => {
    const result = validatePriceRange({ min: "", max: "" });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts valid min only", () => {
    const result = validatePriceRange({ min: "100", max: "" });
    expect(result.valid).toBe(true);
  });

  it("accepts valid max only", () => {
    const result = validatePriceRange({ min: "", max: "5000" });
    expect(result.valid).toBe(true);
  });

  it("accepts valid min and max range", () => {
    const result = validatePriceRange({ min: "100", max: "5000" });
    expect(result.valid).toBe(true);
  });

  it("accepts min equal to max", () => {
    const result = validatePriceRange({ min: "1000", max: "1000" });
    expect(result.valid).toBe(true);
  });

  it("rejects non-numeric min", () => {
    const result = validatePriceRange({ min: "abc", max: "" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("número");
  });

  it("rejects non-numeric max", () => {
    const result = validatePriceRange({ min: "", max: "xyz" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("número");
  });

  it("rejects min greater than max", () => {
    const result = validatePriceRange({ min: "5000", max: "100" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("mayor");
  });

  it("accepts decimal values", () => {
    const result = validatePriceRange({ min: "10.50", max: "99.99" });
    expect(result.valid).toBe(true);
  });

  it("accepts whitespace-padded numbers", () => {
    const result = validatePriceRange({ min: " 100 ", max: " 500 " });
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// Filter state tests
// ============================================================================

describe("EMPTY_FILTER_STATE", () => {
  it("has correct default values", () => {
    expect(EMPTY_FILTER_STATE.priceRange).toEqual({ min: "", max: "" });
    expect(EMPTY_FILTER_STATE.selectedProviders).toEqual([]);
    expect(EMPTY_FILTER_STATE.sort).toBe("relevance");
    expect(EMPTY_FILTER_STATE.onlyWithImage).toBe(false);
  });
});

describe("EMPTY_TREE_FILTER", () => {
  it("has all levels null", () => {
    expect(EMPTY_TREE_FILTER.category).toBeNull();
    expect(EMPTY_TREE_FILTER.subcategory).toBeNull();
    expect(EMPTY_TREE_FILTER.brand).toBeNull();
    expect(EMPTY_TREE_FILTER.presentation).toBeNull();
  });
});

// ============================================================================
// Tree filter type tests (VAL-DISPLAY-005)
// ============================================================================

describe("TreeFilter type", () => {
  it("supports 4 levels: category, subcategory, brand, presentation", () => {
    const fullFilter: TreeFilter = {
      category: "Lácteos",
      subcategory: "Leches",
      brand: "Serenísima",
      presentation: "1L",
    };
    expect(fullFilter.category).toBe("Lácteos");
    expect(fullFilter.subcategory).toBe("Leches");
    expect(fullFilter.brand).toBe("Serenísima");
    expect(fullFilter.presentation).toBe("1L");
  });

  it("allows partial selections", () => {
    const partial: TreeFilter = {
      category: "Lácteos",
      subcategory: null,
      brand: null,
      presentation: null,
    };
    expect(partial.category).toBe("Lácteos");
    expect(partial.subcategory).toBeNull();
  });
});

// ============================================================================
// Sort option tests (VAL-DISPLAY-008)
// ============================================================================

describe("SortOption type", () => {
  it("supports all required sort options", () => {
    const options: SortOption[] = [
      "relevance",
      "price_asc",
      "price_desc",
      "name_asc",
      "name_desc",
    ];
    expect(options).toHaveLength(5);
    expect(options).toContain("price_asc");
    expect(options).toContain("price_desc");
    expect(options).toContain("name_asc");
    expect(options).toContain("name_desc");
    expect(options).toContain("relevance");
  });
});

// ============================================================================
// Sort logic tests (VAL-DISPLAY-008)
// ============================================================================

describe("sortProducts", () => {
  const products = [
    { name: "Zanahoria", price: 500 },
    { name: "Manzana", price: 1200 },
    { name: "Banana", price: 800 },
    { name: "Aceite", price: 2000 },
  ];

  it("sorts by price ascending", () => {
    const sorted = sortProducts(products, "price_asc");
    expect(sorted[0].name).toBe("Zanahoria");
    expect(sorted[sorted.length - 1].name).toBe("Aceite");
  });

  it("sorts by price descending", () => {
    const sorted = sortProducts(products, "price_desc");
    expect(sorted[0].name).toBe("Aceite");
    expect(sorted[sorted.length - 1].name).toBe("Zanahoria");
  });

  it("sorts by name A-Z", () => {
    const sorted = sortProducts(products, "name_asc");
    expect(sorted[0].name).toBe("Aceite");
    expect(sorted[sorted.length - 1].name).toBe("Zanahoria");
  });

  it("sorts by name Z-A", () => {
    const sorted = sortProducts(products, "name_desc");
    expect(sorted[0].name).toBe("Zanahoria");
    expect(sorted[sorted.length - 1].name).toBe("Aceite");
  });

  it("returns same order for relevance", () => {
    const sorted = sortProducts(products, "relevance");
    expect(sorted.map((p) => p.name)).toEqual(
      products.map((p) => p.name)
    );
  });

  it("does not mutate original array", () => {
    const original = [...products];
    sortProducts(products, "price_asc");
    expect(products.map((p) => p.name)).toEqual(
      original.map((p) => p.name)
    );
  });
});

// ============================================================================
// Combined filter logic tests (VAL-DISPLAY-010)
// ============================================================================

describe("applyAllFilters", () => {
  const mockProducts: FilterableProduct[] = [
    {
      name: "Leche Entera",
      brand: "Serenísima",
      presentation: "1L",
      price: 1200,
      category: "Lácteos",
      subcategory: "Leches",
      tags: ["leche", "entera"],
      providerId: "provider_a",
      imageUrl: "https://example.com/leche.jpg",
    },
    {
      name: "Leche Descremada",
      brand: "La Serenísima",
      presentation: "1L",
      price: 1350,
      category: "Lácteos",
      subcategory: "Leches",
      tags: ["leche", "descremada"],
      providerId: "provider_a",
    },
    {
      name: "Queso Cremoso",
      brand: "Barra",
      presentation: "500g",
      price: 3500,
      category: "Lácteos",
      subcategory: "Quesos",
      tags: ["queso", "cremoso"],
      providerId: "provider_b",
    },
    {
      name: "Coca-Cola",
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
      name: "Harina 000",
      brand: "Blancaflor",
      presentation: "1kg",
      price: 900,
      category: "Almacén",
      tags: ["harina"],
      providerId: "provider_a",
    },
  ];

  it("returns all products with no filters", () => {
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      EMPTY_FILTER_STATE,
      ""
    );
    expect(result).toHaveLength(5);
  });

  it("filters by category (level 1)", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
    };
    const result = applyAllFilters(
      mockProducts,
      treeFilter,
      EMPTY_FILTER_STATE,
      ""
    );
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.category === "Lácteos")).toBe(true);
  });

  it("filters by category + subcategory (level 2)", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
      subcategory: "Leches",
    };
    const result = applyAllFilters(
      mockProducts,
      treeFilter,
      EMPTY_FILTER_STATE,
      ""
    );
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.subcategory === "Leches")).toBe(true);
  });

  it("filters by category + subcategory + brand (level 3)", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
      subcategory: "Leches",
      brand: "Serenísima",
    };
    const result = applyAllFilters(
      mockProducts,
      treeFilter,
      EMPTY_FILTER_STATE,
      ""
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Leche Entera");
  });

  it("filters by presentation (level 4)", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Bebidas",
      subcategory: "Gaseosas",
      brand: "Coca-Cola",
      presentation: "2L",
    };
    const result = applyAllFilters(
      mockProducts,
      treeFilter,
      EMPTY_FILTER_STATE,
      ""
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Coca-Cola");
  });

  it("filters by price range min only", () => {
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      priceRange: { min: "1500", max: "" },
    };
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      filters,
      ""
    );
    expect(result).toHaveLength(2); // Queso Cremoso (3500), Coca-Cola (1800)
  });

  it("filters by price range max only", () => {
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      priceRange: { min: "", max: "1000" },
    };
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      filters,
      ""
    );
    expect(result).toHaveLength(1); // Harina 000 (900)
  });

  it("filters by price range min and max", () => {
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      priceRange: { min: "1000", max: "1500" },
    };
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      filters,
      ""
    );
    expect(result).toHaveLength(2); // Leche Entera (1200), Leche Descremada (1350)
  });

  it("filters by provider", () => {
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      selectedProviders: ["provider_b"],
    };
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      filters,
      ""
    );
    expect(result).toHaveLength(2); // Queso Cremoso, Coca-Cola
  });

  it("filters by multiple providers", () => {
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      selectedProviders: ["provider_a", "provider_b"],
    };
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      filters,
      ""
    );
    expect(result).toHaveLength(5); // All products
  });

  it("filters only with image", () => {
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      onlyWithImage: true,
    };
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      filters,
      ""
    );
    expect(result).toHaveLength(2); // Leche Entera, Coca-Cola
  });

  it("filters by text search", () => {
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      EMPTY_FILTER_STATE,
      "leche"
    );
    expect(result).toHaveLength(2); // Leche Entera, Leche Descremada
  });

  it("searches in tags", () => {
    const result = applyAllFilters(
      mockProducts,
      EMPTY_TREE_FILTER,
      EMPTY_FILTER_STATE,
      "gaseosa"
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Coca-Cola");
  });

  it("combines tree + price filter (AND logic)", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
    };
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      priceRange: { min: "1300", max: "" },
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "");
    expect(result).toHaveLength(2);
  });

  it("combines tree + provider filter (AND logic)", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
    };
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      selectedProviders: ["provider_b"],
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Queso Cremoso");
  });

  it("combines all filters (AND logic)", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
    };
    const filters: FilterState = {
      priceRange: { min: "1000", max: "2000" },
      selectedProviders: ["provider_a"],
      sort: "relevance",
      onlyWithImage: true,
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Leche Entera");
  });

  it("returns empty when no products match combined filters", () => {
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Bebidas",
    };
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      priceRange: { min: "5000", max: "" },
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "");
    expect(result).toHaveLength(0);
  });

  it("applies sort after filtering", () => {
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      sort: "price_asc",
    };
    const treeFilter: TreeFilter = {
      ...EMPTY_TREE_FILTER,
      category: "Lácteos",
    };
    const result = applyAllFilters(mockProducts, treeFilter, filters, "");
    expect(result[0].price).toBe(1200); // Leche Entera
    expect(result[2].price).toBe(3500); // Queso Cremoso
  });
});

// ============================================================================
// URL query param serialization tests
// ============================================================================

describe("URL query params", () => {
  it("round-trips filter state through params", () => {
    const treeFilter: TreeFilter = {
      category: "Lácteos",
      subcategory: "Leches",
      brand: "Serenísima",
      presentation: "1L",
    };
    const filters: FilterState = {
      priceRange: { min: "100", max: "5000" },
      selectedProviders: ["provider_a"],
      sort: "price_asc",
      onlyWithImage: true,
    };
    const searchQuery = "leche";

    const params = serializeFiltersToParams(treeFilter, filters, searchQuery);
    const parsed = parseFiltersFromParams(params);

    expect(parsed.treeFilter).toEqual(treeFilter);
    expect(parsed.filters.priceRange).toEqual(filters.priceRange);
    expect(parsed.filters.selectedProviders).toEqual(["provider_a"]);
    expect(parsed.filters.sort).toBe("price_asc");
    expect(parsed.filters.onlyWithImage).toBe(true);
    expect(parsed.searchQuery).toBe("leche");
  });

  it("handles empty filters", () => {
    const params = serializeFiltersToParams(
      EMPTY_TREE_FILTER,
      EMPTY_FILTER_STATE,
      ""
    );
    expect(params.toString()).toBe("");

    const parsed = parseFiltersFromParams(params);
    expect(parsed.treeFilter).toEqual(EMPTY_TREE_FILTER);
    expect(parsed.filters).toEqual(EMPTY_FILTER_STATE);
    expect(parsed.searchQuery).toBe("");
  });

  it("handles multiple providers", () => {
    const filters: FilterState = {
      ...EMPTY_FILTER_STATE,
      selectedProviders: ["a", "b", "c"],
    };
    const params = serializeFiltersToParams(EMPTY_TREE_FILTER, filters, "");
    expect(params.get("providers")).toBe("a,b,c");

    const parsed = parseFiltersFromParams(params);
    expect(parsed.filters.selectedProviders).toEqual(["a", "b", "c"]);
  });
});

// ============================================================================
// hasAnyActiveFilter tests
// ============================================================================

describe("hasAnyActiveFilter", () => {
  it("returns false when no filters active", () => {
    expect(
      hasAnyActiveFilter(EMPTY_TREE_FILTER, EMPTY_FILTER_STATE, "")
    ).toBe(false);
  });

  it("returns true when category is set", () => {
    expect(
      hasAnyActiveFilter(
        { ...EMPTY_TREE_FILTER, category: "test" },
        EMPTY_FILTER_STATE,
        ""
      )
    ).toBe(true);
  });

  it("returns true when search query is set", () => {
    expect(
      hasAnyActiveFilter(EMPTY_TREE_FILTER, EMPTY_FILTER_STATE, "test")
    ).toBe(true);
  });

  it("returns true when price range is set", () => {
    expect(
      hasAnyActiveFilter(
        EMPTY_TREE_FILTER,
        { ...EMPTY_FILTER_STATE, priceRange: { min: "100", max: "" } },
        ""
      )
    ).toBe(true);
  });

  it("returns true when provider filter is set", () => {
    expect(
      hasAnyActiveFilter(
        EMPTY_TREE_FILTER,
        { ...EMPTY_FILTER_STATE, selectedProviders: ["a"] },
        ""
      )
    ).toBe(true);
  });

  it("returns true when sort is not relevance", () => {
    expect(
      hasAnyActiveFilter(
        EMPTY_TREE_FILTER,
        { ...EMPTY_FILTER_STATE, sort: "price_asc" },
        ""
      )
    ).toBe(true);
  });

  it("returns true when onlyWithImage is set", () => {
    expect(
      hasAnyActiveFilter(
        EMPTY_TREE_FILTER,
        { ...EMPTY_FILTER_STATE, onlyWithImage: true },
        ""
      )
    ).toBe(true);
  });

  it("returns true when presentation is set", () => {
    expect(
      hasAnyActiveFilter(
        { ...EMPTY_TREE_FILTER, presentation: "1L" },
        EMPTY_FILTER_STATE,
        ""
      )
    ).toBe(true);
  });
});
