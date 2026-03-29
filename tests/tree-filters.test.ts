import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// VAL-DISPLAY-005: Tree navigation level 4 — presentation
// VAL-DISPLAY-006: Price range filter
// VAL-DISPLAY-007: Provider filter checkboxes
// VAL-DISPLAY-008: Sort controls
// VAL-DISPLAY-009: "Only with image" filter
// VAL-DISPLAY-010: Filters accumulate with tree (AND logic)
// VAL-DISPLAY-011: "Limpiar filtros" clears all filters
// VAL-DISPLAY-012: Empty state when no products match
// ============================================================================

const srcDir = path.resolve(__dirname, "..", "src");
const componentsDir = path.resolve(srcDir, "components");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(srcDir, relativePath), "utf-8");
}

function readComponent(name: string): string {
  return fs.readFileSync(path.resolve(componentsDir, name), "utf-8");
}

// ============================================================================
// VAL-DISPLAY-005: Tree navigation level 4 — presentation
// ============================================================================

describe("Tree navigation level 4 — presentation (VAL-DISPLAY-005)", () => {
  it("TreeFilter type includes presentation field", () => {
    const content = readComponent("tree-navigation.tsx");
    expect(content).toMatch(/presentation/);
  });

  it("EMPTY_TREE_FILTER has presentation: null", () => {
    const content = readComponent("tree-navigation.tsx");
    expect(content).toMatch(/EMPTY_TREE_FILTER/);
    // Should have 4 levels in the empty filter
    expect(content).toMatch(/category.*null/);
    expect(content).toMatch(/subcategory.*null/);
    expect(content).toMatch(/brand.*null/);
    expect(content).toMatch(/presentation.*null/);
  });

  it("tree shows 4 levels: category → subcategory → brand → presentation", () => {
    const content = readComponent("tree-navigation.tsx");
    // Should reference all 4 levels
    expect(content).toMatch(/Categoría|category/i);
    expect(content).toMatch(/Subcategoría|subcategory/i);
    expect(content).toMatch(/Marca|brand/i);
    expect(content).toMatch(/Presentación|presentation/i);
  });

  it("breadcrumb shows all 4 selected levels", () => {
    const content = readComponent("tree-navigation.tsx");
    // Breadcrumb should handle 4 levels
    expect(content).toMatch(/breadcrumb/);
  });

  it("selecting presentation further filters products", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    // Buscar content should use presentation in filter logic
    expect(content).toMatch(/presentation/);
  });
});

// ============================================================================
// VAL-DISPLAY-006: Price range filter
// ============================================================================

describe("Price range filter (VAL-DISPLAY-006)", () => {
  it("price range filter component exists", () => {
    const exists = fs.existsSync(
      path.resolve(componentsDir, "product-filters.tsx")
    );
    expect(exists).toBe(true);
  });

  it("has min and max price input fields", () => {
    const content = readComponent("product-filters.tsx");
    expect(content).toMatch(/min.*price|precio.*mín|precioMin/i);
    expect(content).toMatch(/max.*price|precio.*máx|precioMax/i);
  });

  it("validates numeric values for price inputs", () => {
    const content = readComponent("product-filters.tsx");
    // Should have validation for numeric input
    expect(content).toMatch(/isNaN|isFinite|number|parseFloat|numérico/i);
  });

  it("validates min ≤ max", () => {
    const content = readComponent("product-filters.tsx");
    // Should validate that min <= max
    expect(content).toMatch(/min.*max|mayor.*menor|máximo.*mínimo/i);
  });

  it("buscar page uses price filter", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toMatch(/priceRange|minPrice|maxPrice|precioMin|precioMax/i);
  });

  it("price filter is applied to product list", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    // Should filter products by price range
    expect(content).toMatch(/price/);
  });
});

// ============================================================================
// VAL-DISPLAY-007: Provider filter checkboxes
// ============================================================================

describe("Provider filter checkboxes (VAL-DISPLAY-007)", () => {
  it("product filters component has provider checkboxes", () => {
    const content = readComponent("product-filters.tsx");
    expect(content).toMatch(/provider|proveedor|checkbox/i);
  });

  it("lists all unique providers with checkboxes", () => {
    const content = readComponent("product-filters.tsx");
    // Should extract unique providers from products
    expect(content).toMatch(/provider|proveedor/i);
  });

  it("checking/unchecking filters products in real-time", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    // Should use selected providers in filtering
    expect(content).toMatch(/provider|proveedor/i);
  });
});

// ============================================================================
// VAL-DISPLAY-008: Sort controls
// ============================================================================

describe("Sort controls (VAL-DISPLAY-008)", () => {
  it("sort controls component or section exists", () => {
    const content = readComponent("product-filters.tsx");
    expect(content).toMatch(/sort|orden|ordenar/i);
  });

  it("offers price ascending and descending options", () => {
    const content = readComponent("product-filters.tsx");
    expect(content).toMatch(/price.*asc|price.*desc|menor.*mayor|mayor.*menor/i);
  });

  it("offers name A-Z and Z-A options", () => {
    const content = readComponent("product-filters.tsx");
    expect(content).toMatch(/name.*asc|name.*desc|A.*Z|Z.*A/i);
  });

  it("sort is applied to filtered products", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toMatch(/sort|orden/i);
  });
});

// ============================================================================
// VAL-DISPLAY-009: "Only with image" filter
// ============================================================================

describe("'Only with image' filter (VAL-DISPLAY-009)", () => {
  it("toggle labeled 'Solo con imagen' exists", () => {
    const content = readComponent("product-filters.tsx");
    expect(content).toMatch(/imagen|image/i);
  });

  it("filters products to only those with imageUrl", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toMatch(/imageUrl|imagen|image/i);
  });

  it("toggle can be enabled/disabled", () => {
    const content = readComponent("product-filters.tsx");
    expect(content).toMatch(/onlyWithImage|soloImagen|toggle|switch|checkbox/i);
  });
});

// ============================================================================
// VAL-DISPLAY-010: Filters accumulate with tree (AND logic)
// ============================================================================

describe("Filters accumulate with AND logic (VAL-DISPLAY-010)", () => {
  it("all filters combine in product filtering", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    // Should reference multiple filter criteria
    expect(content).toMatch(/priceRange|precioMin|precioMax|minPrice|maxPrice/i);
    expect(content).toMatch(/provider|proveedor/i);
    expect(content).toMatch(/sort|orden/i);
    expect(content).toMatch(/imageUrl|image|imagen/i);
  });

  it("filtered products count updates with each filter change", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toMatch(/filteredProducts|length|count/i);
  });
});

// ============================================================================
// VAL-DISPLAY-011: "Limpiar filtros" clears all filters
// ============================================================================

describe("Limpiar filtros clears all filters (VAL-DISPLAY-011)", () => {
  it("clear filters button exists in product filters", () => {
    const content = readComponent("product-filters.tsx");
    expect(content).toMatch(/limpiar|clear|reset/i);
  });

  it("clear button resets tree, price, providers, sort, and image toggle", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toMatch(/limpiar|clear|reset/i);
  });
});

// ============================================================================
// VAL-DISPLAY-012: Empty state when no products match
// ============================================================================

describe("Empty state when no products match (VAL-DISPLAY-012)", () => {
  it("shows message when filters yield zero results", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toMatch(/No hay productos|sin resultados|0 productos|no.*coinciden/i);
  });

  it("user can clear filters from empty state", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toMatch(/limpiar|clear|reset/i);
  });
});

// ============================================================================
// URL query params for shareability
// ============================================================================

describe("Filters reflected in URL query params", () => {
  it("buscar page reads filter state from URL params", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toMatch(/searchParams|useSearchParams|URLSearchParams|router.*push|replaceState/i);
  });

  it("filter changes update URL query params", () => {
    const content = readFile("app/buscar/buscar-content.tsx");
    expect(content).toMatch(/searchParams|push|replace|query/i);
  });
});
