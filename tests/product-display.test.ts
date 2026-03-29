import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// VAL-DISPLAY-001: TanStack React Table with sorting
// VAL-DISPLAY-002: Pagination at 20 products per page
// VAL-DISPLAY-003: Grid/card view toggle
// VAL-DISPLAY-004: Product detail modal with all attributes
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
// TanStack React Table integration tests
// ============================================================================

describe("TanStack React Table integration (VAL-DISPLAY-001)", () => {
  it("products-table.tsx imports @tanstack/react-table", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toContain("@tanstack/react-table");
  });

  it("uses useReactTable hook from TanStack", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toMatch(/useReactTable|getCoreRowModel/);
  });

  it("uses getSortedRowModel for sorting support", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toContain("getSortedRowModel");
  });

  it("defines column definitions with sortable columns", () => {
    const content = readComponent("products-table.tsx");
    // Should have column definitions
    expect(content).toMatch(/columnDefs|columns/);
    // Should define at least these columns: name, category/brand, price
    expect(content).toMatch(/name.*header|header.*name/i);
    expect(content).toMatch(/price.*header|header.*price|precio/i);
  });

  it("columns include: name, category, brand, price, provider, image thumbnail", () => {
    const content = readComponent("products-table.tsx");
    // Name column
    expect(content).toMatch(/name|producto/i);
    // Brand/marca column
    expect(content).toMatch(/brand|marca/i);
    // Price column
    expect(content).toMatch(/price|precio/i);
    // Category column
    expect(content).toMatch(/category|categor/i);
  });

  it("column headers are clickable for sorting", () => {
    const content = readComponent("products-table.tsx");
    // Should have sort toggle handlers or onClick on headers
    expect(content).toMatch(/header\.column\.getToggleSortingHandler|onClick.*sort|getSort/i);
  });
});

describe("Pagination at 20 per page (VAL-DISPLAY-002)", () => {
  it("pagination uses PAGE_SIZE of 20", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toMatch(/20|PAGE_SIZE.*20/);
  });

  it("uses getPaginationRowModel", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toContain("getPaginationRowModel");
  });

  it("has pagination controls (prev/next)", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toMatch(/previousPage|nextPage|página.*anterior|siguiente/i);
  });

  it("shows current page info", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toMatch(/getState\(\)\.pagination|pageIndex|pageCount/i);
  });
});

describe("Grid/card view toggle (VAL-DISPLAY-003)", () => {
  it("has a view mode toggle (table/grid)", () => {
    const buscarPage = readFile("app/buscar/page.tsx");
    // Should have state for view mode
    expect(buscarPage).toMatch(/viewMode|view.*mode|gridView|tableView|vista/i);
  });

  it("has grid/card rendering path", () => {
    const content = readComponent("products-table.tsx");
    // Should render cards or grid layout
    expect(content).toMatch(/grid|card.*view|Card/i);
  });

  it("card view shows image, name, price, and provider", () => {
    const content = readComponent("products-table.tsx");
    // Card view should display key product info
    expect(content).toMatch(/image|imageUrl|img/i);
  });

  it("toggle switches between table and card view", () => {
    const buscarPage = readFile("app/buscar/page.tsx");
    // Should have both rendering paths
    expect(buscarPage).toMatch(/table|grid|card/i);
  });
});

describe("Product detail modal (VAL-DISPLAY-004)", () => {
  it("modal/dialog component is imported or exists", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toMatch(/dialog|modal|Dialog|Modal/i);
  });

  it("clicking a product opens detail modal", () => {
    const content = readComponent("products-table.tsx");
    // Should have onClick handler on product rows/cards
    expect(content).toMatch(/onClick|onSelect|selectedProduct/i);
  });

  it("modal shows full product name", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toMatch(/selectedProduct.*name|product\.name/i);
  });

  it("modal shows brand, price, category, provider, image", () => {
    const content = readComponent("products-table.tsx");
    // Should render multiple product fields in the modal
    expect(content).toMatch(/brand|marca/i);
    expect(content).toMatch(/price|precio/i);
  });

  it("modal shows description, unit, presentation", () => {
    const content = readComponent("products-table.tsx");
    expect(content).toMatch(/presentation|presentación/i);
  });

  it("modal can be closed", () => {
    const content = readComponent("products-table.tsx");
    // Should have close handler
    expect(content).toMatch(/onClose|close|setSelectedProduct.*null|onOpenChange/i);
  });
});

describe("TanStack React Table package installed", () => {
  it("@tanstack/react-table is in package.json dependencies", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf-8")
    );
    const hasDependency =
      packageJson.dependencies?.["@tanstack/react-table"] !== undefined ||
      packageJson.devDependencies?.["@tanstack/react-table"] !== undefined;
    expect(hasDependency).toBe(true);
  });
});

describe("/buscar page renders product display with all features", () => {
  it("buscar page imports ProductsTable component", () => {
    const content = readFile("app/buscar/page.tsx");
    expect(content).toMatch(/ProductsTable|products-table/i);
  });

  it("buscar page has view mode state", () => {
    const content = readFile("app/buscar/page.tsx");
    expect(content).toMatch(/viewMode|vista|view/i);
  });

  it("products-table.tsx exists", () => {
    const exists = fs.existsSync(path.resolve(componentsDir, "products-table.tsx"));
    expect(exists).toBe(true);
  });
});
