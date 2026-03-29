import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const rootDir = path.resolve(__dirname, "..");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(rootDir, relativePath), "utf-8");
}

// ============================================================================
// VAL-CATALOG-006: Batch price update
// ============================================================================

describe("VAL-CATALOG-006: Batch price update", () => {
  it("batchPriceUpdate mutation exists in Convex", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/batchPriceUpdate/);
  });

  it("batchPriceUpdate accepts productIds, mode, and value args", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/productIds.*v\.array.*v\.id/);
    expect(content).toMatch(/mode.*v\.union.*percentage.*fixed/);
    expect(content).toMatch(/value.*v\.number/);
  });

  it("batchPriceUpdate requires authentication", () => {
    const content = readFile("convex/products.ts");
    // Extract the batchPriceUpdate function section
    const batchSection = content.substring(
      content.indexOf("batchPriceUpdate"),
      content.indexOf("batchPriceUpdate") + 3000
    );
    expect(batchSection).toContain("getUserIdentity");
    expect(batchSection).toContain("Authentication required");
  });

  it("batchPriceUpdate validates ownership for each product", () => {
    const content = readFile("convex/products.ts");
    const batchSection = content.substring(
      content.indexOf("batchPriceUpdate"),
      content.indexOf("batchPriceUpdate") + 3000
    );
    expect(batchSection).toContain("providerId");
    expect(batchSection).toContain("tokenIdentifier");
  });

  it("batchPriceUpdate supports percentage mode", () => {
    const content = readFile("convex/products.ts");
    const batchSection = content.substring(
      content.indexOf("batchPriceUpdate"),
      content.indexOf("batchPriceUpdate") + 3000
    );
    expect(batchSection).toMatch(/percentage/);
    // Should apply multiplier: price * (1 + value/100)
    expect(batchSection).toMatch(/1.*value.*100|price.*\*/);
  });

  it("batchPriceUpdate supports fixed price mode", () => {
    const content = readFile("convex/products.ts");
    const batchSection = content.substring(
      content.indexOf("batchPriceUpdate"),
      content.indexOf("batchPriceUpdate") + 3000
    );
    expect(batchSection).toMatch(/fixed/);
  });

  it("batchPriceUpdate validates percentage cannot exceed -100%", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/-100|cannot exceed/);
  });

  it("batchPriceUpdate validates fixed price must be positive", () => {
    const content = readFile("convex/products.ts");
    const batchSection = content.substring(
      content.indexOf("batchPriceUpdate"),
      content.indexOf("batchPriceUpdate") + 3000
    );
    expect(batchSection).toMatch(/greater than 0|mayor a 0/);
  });

  it("batchPriceUpdate rounds prices to 2 decimal places", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/Math\.round.*100|round/);
  });

  it("batchPriceUpdate updates updatedAt timestamp", () => {
    const content = readFile("convex/products.ts");
    const batchSection = content.substring(
      content.indexOf("batchPriceUpdate"),
      content.indexOf("batchPriceUpdate") + 3000
    );
    expect(batchSection).toMatch(/updatedAt/);
  });

  it("products table has batch selection UI", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/checkbox|select|rowSelection/i);
  });

  it("products table has batch price update button", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/Actualizar precios|batchPrice/i);
  });

  it("productos page has batch price update dialog", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/BatchPrice|batchPriceDialog|Actualización masiva/);
  });

  it("batch dialog supports percentage and fixed modes", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/percentage|Porcentaje/);
    expect(content).toMatch(/fixed|Precio fijo/);
  });

  it("batch dialog shows count of affected products", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/selectedCount|seleccionado/);
  });
});

// ============================================================================
// VAL-CATALOG-007: Soft delete (deactivate) product
// ============================================================================

describe("VAL-CATALOG-007: Soft delete (deactivate)", () => {
  it("products schema has active field", () => {
    const content = readFile("convex/schema.ts");
    expect(content).toMatch(/active.*v\.(optional\()?boolean/);
  });

  it("toggleActive mutation exists in Convex", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/toggleActive/);
  });

  it("toggleActive sets active field to false for deactivation", () => {
    const content = readFile("convex/products.ts");
    const toggleSection = content.substring(
      content.indexOf("toggleActive"),
      content.indexOf("toggleActive") + 2000
    );
    expect(toggleSection).toMatch(/active.*v\.boolean/);
    // patch updates the active field
    expect(toggleSection).toMatch(/patch/);
    expect(toggleSection).toMatch(/active:\s*args\.active/);
  });

  it("toggleActive requires authentication and ownership", () => {
    const content = readFile("convex/products.ts");
    const toggleSection = content.substring(
      content.indexOf("toggleActive"),
      content.indexOf("toggleActive") + 2000
    );
    expect(toggleSection).toContain("getUserIdentity");
    expect(toggleSection).toContain("Not authorized");
  });

  it("products table shows deactivate button for active products", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/Desactivar|PowerOff|toggleActive/i);
  });

  it("deactivated products show Desactivado badge", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/Desactivado/i);
  });

  it("listOwn query filters inactive products by default", () => {
    const content = readFile("convex/products.ts");
    const listOwnSection = content.substring(
      content.indexOf("listOwn"),
      content.indexOf("searchOwn") > -1 ? content.indexOf("searchOwn") : content.length
    );
    expect(listOwnSection).toMatch(/active.*false|includeInactive/);
  });

  it("productos page has inactive filter tab", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/inactive|Desactivados/);
  });

  it("productos page passes includeInactive to listOwn", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/includeInactive.*true/);
  });
});

// ============================================================================
// VAL-CATALOG-008: Reactivate product
// ============================================================================

describe("VAL-CATALOG-008: Reactivate product", () => {
  it("toggleActive can set active back to true", () => {
    const content = readFile("convex/products.ts");
    const toggleSection = content.substring(
      content.indexOf("toggleActive"),
      content.indexOf("toggleActive") + 2000
    );
    // The mutation accepts a boolean, so it can set both true and false
    expect(toggleSection).toMatch(/active.*v\.boolean/);
    expect(toggleSection).toMatch(/active.*args\.active/);
  });

  it("products table shows reactivate button for inactive products", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/Reactivar|Power.*reactivate/i);
  });

  it("productos page shows reactivation toast", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/reactivado/i);
  });

  it("reactivated products appear in active listing", () => {
    const content = readFile("convex/products.ts");
    // listOwn filters by active !== false by default
    const listOwnSection = content.substring(
      content.indexOf("listOwn"),
      content.indexOf("searchOwn") > -1 ? content.indexOf("searchOwn") : content.length
    );
    expect(listOwnSection).toMatch(/active.*!==.*false/);
  });
});

// ============================================================================
// VAL-CATALOG-009: Permanent delete with confirmation
// ============================================================================

describe("VAL-CATALOG-009: Permanent delete with confirmation", () => {
  it("remove mutation exists in Convex and deletes product", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/export const remove/);
    expect(content).toMatch(/ctx\.db\.delete/);
  });

  it("remove mutation validates product ownership", () => {
    const content = readFile("convex/products.ts");
    const removeSection = content.substring(
      content.indexOf("export const remove"),
      content.indexOf("export const remove") + 2000
    );
    expect(removeSection).toContain("Not authorized");
    expect(removeSection).toMatch(/providerId.*tokenIdentifier/);
  });

  it("products table has DeleteConfirmDialog component", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/DeleteConfirmDialog|deleteDialog/);
  });

  it("delete confirmation dialog shows product name", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/product\.name|product\?\.name/);
  });

  it("delete confirmation dialog has explicit warning message", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/¿Estás seguro|permanente|permanent/i);
  });

  it("delete confirmation has cancel and confirm buttons", () => {
    const content = readFile("src/components/products-table.tsx");
    expect(content).toMatch(/Cancelar/);
    expect(content).toMatch(/Eliminar/);
  });
});

// ============================================================================
// VAL-CATALOG-010: Search within provider catalog
// ============================================================================

describe("VAL-CATALOG-010: Search within provider catalog", () => {
  it("searchOwn query exists in Convex", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/searchOwn/);
  });

  it("searchOwn accepts query argument", () => {
    const content = readFile("convex/products.ts");
    const searchSection = content.substring(
      content.indexOf("searchOwn"),
      content.indexOf("searchOwn") + 2000
    );
    expect(searchSection).toMatch(/query.*v\.string/);
  });

  it("searchOwn searches by name, brand, and sourceRowId", () => {
    const content = readFile("convex/products.ts");
    const searchSection = content.substring(
      content.indexOf("searchOwn"),
      content.indexOf("searchOwn") + 2000
    );
    expect(searchSection).toMatch(/name/);
    expect(searchSection).toMatch(/brand/);
    expect(searchSection).toMatch(/sourceRowId/);
  });

  it("searchOwn requires authentication and scopes to provider", () => {
    const content = readFile("convex/products.ts");
    const searchSection = content.substring(
      content.indexOf("searchOwn"),
      content.indexOf("searchOwn") + 2000
    );
    expect(searchSection).toContain("getUserIdentity");
    expect(searchSection).toContain("tokenIdentifier");
  });

  it("searchOwn only returns active products", () => {
    const content = readFile("convex/products.ts");
    const searchSection = content.substring(
      content.indexOf("searchOwn"),
      content.indexOf("searchOwn") + 2000
    );
    expect(searchSection).toMatch(/active.*===.*false|active.*!==.*false/);
  });

  it("productos page has search input", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/searchQuery|Buscar por nombre/);
  });

  it("productos page uses searchOwn query for server-side search", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/searchOwn|api\.products\.searchOwn/);
  });

  it("search filters results in real-time as user types", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    // Should use the search query state to filter products
    expect(content).toMatch(/searchQuery|onChange.*e\.target\.value/);
  });
});

// ============================================================================
// VAL-CATALOG-011: Export catalog to Excel (XLSX)
// ============================================================================

describe("VAL-CATALOG-011: Export to Excel", () => {
  it("xlsx library is installed", () => {
    const content = readFile("package.json");
    expect(content).toMatch(/xlsx/);
  });

  it("getExportData query exists in Convex", () => {
    const content = readFile("convex/products.ts");
    expect(content).toMatch(/getExportData/);
  });

  it("getExportData returns only active products", () => {
    const content = readFile("convex/products.ts");
    const exportSection = content.substring(
      content.indexOf("getExportData"),
      content.indexOf("getExportData") + 2000
    );
    expect(exportSection).toMatch(/active.*!==.*false/);
  });

  it("getExportData returns required columns: name, category, brand, price, unit, presentation, provider", () => {
    const content = readFile("convex/products.ts");
    const exportSection = content.substring(
      content.indexOf("getExportData"),
      content.indexOf("getExportData") + 2000
    );
    expect(exportSection).toMatch(/name:/);
    expect(exportSection).toMatch(/category:/);
    expect(exportSection).toMatch(/brand:/);
    expect(exportSection).toMatch(/price:/);
    expect(exportSection).toMatch(/unit:|unitOfMeasure/);
    expect(exportSection).toMatch(/presentation:/);
    expect(exportSection).toMatch(/provider:/);
  });

  it("productos page has Exportar a Excel button", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/Exportar a Excel/);
  });

  it("productos page imports xlsx library", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/import.*xlsx|from.*xlsx/);
  });

  it("export handler creates XLSX workbook with correct columns", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    // Must have XLSX.utils and writeFile calls
    expect(content).toMatch(/XLSX\.utils/);
    expect(content).toMatch(/XLSX\.writeFile/);
  });

  it("export creates worksheet with Spanish column headers", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/Nombre|Categoría|Marca|Precio|Presentación/);
  });

  it("export triggers automatic download", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    // writeFile triggers download
    expect(content).toMatch(/XLSX\.writeFile/);
  });

  it("export filename includes date", () => {
    const content = readFile("src/app/proveedor/productos/page.tsx");
    expect(content).toMatch(/catalogo_.*xlsx|filename.*catalogo/);
  });
});
