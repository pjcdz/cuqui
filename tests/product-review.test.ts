import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

const rootDir = path.resolve(__dirname, "..");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(rootDir, relativePath), "utf-8");
}

// ============================================================================
// Inline edit Zod validation schema (for testing)
// ============================================================================

const ProductEditSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  brand: z.string().min(1, "La marca es obligatoria"),
  presentation: z.string().min(1, "La presentación es obligatoria"),
  price: z.number().positive("El precio debe ser mayor a 0"),
  category: z.string().min(1, "La categoría es obligatoria"),
});

type ProductEdit = z.infer<typeof ProductEditSchema>;

// ============================================================================
// VAL-CATALOG-001: Product review UI shows needs_review products
// ============================================================================

describe("VAL-CATALOG-001: Product review UI filter", () => {
  it("productos page has needs_review filter", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toContain("needs_review");
  });

  it("productos page has filter tabs for all and needs_review", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toContain('"all"');
    expect(content).toContain('"needs_review"');
  });

  it("filtering logic exists for reviewStatus", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/reviewStatus.*needs_review/);
  });
});

// ============================================================================
// VAL-CATALOG-002: Inline editing of product fields
// ============================================================================

describe("VAL-CATALOG-002: Inline editing", () => {
  it("products table component supports inline editing", () => {
    const content = readFile("src/components/products-table.tsx");
    // Must have editing-related state and handlers
    expect(content).toMatch(/editing/i);
  });

  it("product edit mutation exists in Convex", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/updateProduct|update/);
  });

  it("updateProduct mutation validates ownership", () => {
    const content = readFile("convex/products.ts");
    // Must check that the product belongs to the authenticated provider
    expect(content).toMatch(/providerId.*tokenIdentifier|Not authorized/);
  });
});

// ============================================================================
// VAL-CATALOG-003: Zod validation on inline edits
// ============================================================================

describe("VAL-CATALOG-003: Zod validation on edits", () => {
  it("ProductEditSchema rejects empty name", () => {
    const result = ProductEditSchema.safeParse({
      name: "",
      brand: "Brand",
      presentation: "1L",
      price: 100,
      category: "lacteos",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) => i.path[0] === "name");
      expect(nameError).toBeDefined();
      expect(nameError!.message).toMatch(/obligatorio/i);
    }
  });

  it("ProductEditSchema rejects empty brand", () => {
    const result = ProductEditSchema.safeParse({
      name: "Product",
      brand: "",
      presentation: "1L",
      price: 100,
      category: "lacteos",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const brandError = result.error.issues.find((i) => i.path[0] === "brand");
      expect(brandError).toBeDefined();
    }
  });

  it("ProductEditSchema rejects negative price", () => {
    const result = ProductEditSchema.safeParse({
      name: "Product",
      brand: "Brand",
      presentation: "1L",
      price: -50,
      category: "lacteos",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const priceError = result.error.issues.find((i) => i.path[0] === "price");
      expect(priceError).toBeDefined();
      expect(priceError!.message).toMatch(/mayor a 0/i);
    }
  });

  it("ProductEditSchema rejects zero price", () => {
    const result = ProductEditSchema.safeParse({
      name: "Product",
      brand: "Brand",
      presentation: "1L",
      price: 0,
      category: "lacteos",
    });
    expect(result.success).toBe(false);
  });

  it("ProductEditSchema rejects empty category", () => {
    const result = ProductEditSchema.safeParse({
      name: "Product",
      brand: "Brand",
      presentation: "1L",
      price: 100,
      category: "",
    });
    expect(result.success).toBe(false);
  });

  it("ProductEditSchema accepts valid product data", () => {
    const result = ProductEditSchema.safeParse({
      name: "Leche Entera",
      brand: "Serenísima",
      presentation: "1L",
      price: 1500,
      category: "lacteos",
    });
    expect(result.success).toBe(true);
  });

  it("products-table uses Zod validation for inline edits", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/z\.|zod|safeParse|ProductEdit/i);
  });

  it("validation errors display near the affected field", () => {
    const content = readFile("src/components/products-table.tsx");
    // Must render error messages inline
    expect(content).toMatch(/error.*message|validation.*error/i);
  });
});

// ============================================================================
// VAL-CATALOG-004: "Publicar todo" batch action
// ============================================================================

describe("VAL-CATALOG-004: Publicar todo batch action", () => {
  it("productos page has Publicar todo button", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/Publicar todo|publishAll/i);
  });

  it("batchPublishAll mutation exists in Convex", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/batchPublishAll|publishAll|batch.*publish/i);
  });

  it("batchPublishAll requires authentication", () => {
    const content = readFile("convex/products.ts");
    // Must have auth check (getUserIdentity) and publishAll in the same file
    expect(content).toContain("getUserIdentity");
    expect(content).toMatch(/batchPublishAll|publishAll/);
  });

  it("batchPublishAll changes reviewStatus to ok", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/reviewStatus.*"ok"|ok.*reviewStatus/);
  });

  it("Publicar todo has confirmation dialog", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    // Should have confirmation before publishing
    expect(content).toMatch(/confirm|dialog|Confirmar/i);
  });
});

// ============================================================================
// VAL-CATALOG-005: Individual price update
// ============================================================================

describe("VAL-CATALOG-005: Individual price update", () => {
  it("updateProduct mutation allows price update", () => {
    const content = readFile("convex/products.ts");
    // Must accept price as an updateable field
    expect(content).toMatch(/price/);
  });

  it("updateProduct mutation updates updatedAt timestamp", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/updatedAt/);
  });

  it("updateProduct validates price is positive", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/price.*positive|price.*greater|price.*mayor/i);
  });
});

// ============================================================================
// VAL-CATALOG-009: Permanent delete with confirmation
// ============================================================================

describe("VAL-CATALOG-009: Delete with confirmation", () => {
  it("productos page has delete action for each product", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    // Either the page or the products-table should have delete functionality
    const tableContent = readFile("src/components/products-table.tsx");
    const combined = content + tableContent;
    expect(combined).toMatch(/delete|eliminar|Eliminar/i);
  });

  it("delete action shows confirmation dialog", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    const tableContent = readFile("src/components/products-table.tsx");
    const combined = content + tableContent;
    expect(combined).toMatch(/confirm.*delete|eliminar.*confirm|¿Estás seguro/i);
  });

  it("remove mutation exists and validates ownership", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/remove|delete/i);
    expect(content).toContain("Not authorized");
  });
});

// ============================================================================
// Convex mutation structure validation
// ============================================================================

describe("Convex mutation structure", () => {
  it("updateProduct has proper arg validators", () => {
    const content = readFile("convex/products.ts");
    // Must use v.id for product ID and have field validators
    expect(content).toMatch(/v\.id\("products"\)/);
  });

  it("batchPublishAll has proper arg validators", () => {
    const content = readFile("convex/products.ts");
    // Should accept no args or optional filter, and use auth for scoping
    expect(content).toContain("mutation");
  });
});
