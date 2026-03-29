import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// VAL-POLISH-001: Statistics dashboard renders
// VAL-POLISH-002: Statistics date range filter
// VAL-POLISH-003: Export statistics to PDF
// ============================================================================

const srcDir = path.resolve(__dirname, "..", "src");
const convexDir = path.resolve(__dirname, "..", "convex");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(srcDir, relativePath), "utf-8");
}

function readConvexFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(convexDir, relativePath), "utf-8");
}

// ============================================================================
// Route existence and page structure
// ============================================================================

describe("Statistics dashboard route structure", () => {
  it("/proveedor/estadisticas page file exists", () => {
    const pagePath = path.resolve(srcDir, "app/proveedor/estadisticas/page.tsx");
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("page exports a default component", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toMatch(/export\s+default\s+function|export\s+default/);
  });

  it("page is a client component", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toContain('"use client"');
  });
});

// ============================================================================
// Backend: stats queries
// ============================================================================

describe("Statistics backend queries", () => {
  it("convex/stats.ts file exists", () => {
    const statsPath = path.resolve(convexDir, "stats.ts");
    expect(fs.existsSync(statsPath)).toBe(true);
  });

  it("stats.ts exports getDashboardStats query", () => {
    const content = readConvexFile("stats.ts");
    expect(content).toContain("getDashboardStats");
    expect(content).toContain("query(");
  });

  it("getDashboardStats accepts optional date range args", () => {
    const content = readConvexFile("stats.ts");
    expect(content).toContain("startDate");
    expect(content).toContain("endDate");
  });

  it("stats.ts exports getProductStats query for PDF export", () => {
    const content = readConvexFile("stats.ts");
    expect(content).toContain("getProductStats");
  });

  it("stats query returns active product count", () => {
    const content = readConvexFile("stats.ts");
    expect(content).toContain("activeCount");
  });

  it("stats query returns top viewed products", () => {
    const content = readConvexFile("stats.ts");
    expect(content).toContain("topViewed");
    expect(content).toContain("viewCount");
  });

  it("stats query returns total search appearances", () => {
    const content = readConvexFile("stats.ts");
    expect(content).toContain("totalSearchAppearances");
    expect(content).toContain("searchAppearances");
  });

  it("stats query returns last update date", () => {
    const content = readConvexFile("stats.ts");
    expect(content).toContain("lastUpdate");
    expect(content).toContain("updatedAt");
  });

  it("stats query filters by date range when provided", () => {
    const content = readConvexFile("stats.ts");
    expect(content).toContain("startDate");
    expect(content).toContain("endDate");
    // Should have filtering logic
    expect(content).toMatch(/startDate.*endDate|filter.*date/);
  });
});

// ============================================================================
// Schema: viewCount and searchAppearances fields
// ============================================================================

describe("Statistics schema fields", () => {
  it("products schema has viewCount field", () => {
    const content = readConvexFile("schema.ts");
    expect(content).toContain("viewCount");
  });

  it("products schema has searchAppearances field", () => {
    const content = readConvexFile("schema.ts");
    expect(content).toContain("searchAppearances");
  });

  it("products.ts has incrementViewCount mutation", () => {
    const content = readConvexFile("products.ts");
    expect(content).toContain("incrementViewCount");
    expect(content).toMatch(/mutation\(/);
  });

  it("products.ts has incrementSearchAppearances mutation", () => {
    const content = readConvexFile("products.ts");
    expect(content).toContain("incrementSearchAppearances");
  });
});

// ============================================================================
// Dashboard UI content
// ============================================================================

describe("Statistics dashboard UI", () => {
  it("page displays active products count metric", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toMatch(/activeCount|productos.*activos|activos/i);
  });

  it("page displays top 10 viewed products", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toMatch(/topViewed|más.*vistos|vistos/i);
  });

  it("page displays search appearances", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toMatch(/searchAppearances|apariciones.*búsqueda|apariciones/i);
  });

  it("page displays last update date", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toMatch(/lastUpdate|última.*actualización|actualización/i);
  });

  it("page has date range filter inputs", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toMatch(/startDate|fecha.*inicio|desde/i);
    expect(content).toMatch(/endDate|fecha.*fin|hasta/i);
  });

  it("page has export to PDF button", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toMatch(/pdf|PDF|exportar.*pdf/i);
  });

  it("page uses getDashboardStats query", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toContain("getDashboardStats");
  });

  it("page uses jspdf for PDF generation", () => {
    const content = readFile("app/proveedor/estadisticas/page.tsx");
    expect(content).toMatch(/jspdf|jsPDF/);
  });
});

// ============================================================================
// Navigation link in provider sidebar
// ============================================================================

describe("Statistics navigation", () => {
  it("provider layout has statistics nav item", () => {
    const content = readFile("app/proveedor/layout.tsx");
    expect(content).toMatch(/estadisticas|Estadísticas|estadísticas/i);
  });

  it("statistics nav item links to /proveedor/estadisticas", () => {
    const content = readFile("app/proveedor/layout.tsx");
    expect(content).toContain("/proveedor/estadisticas");
  });
});
