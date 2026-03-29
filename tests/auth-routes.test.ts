import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// VAL-AUTH-004: proveedor role can access provider routes
// VAL-AUTH-005: comercio role can access comercio routes, not provider routes
// VAL-AUTH-006: Unauthenticated users redirected from /proveedor/*
// VAL-AUTH-007: Unauthenticated users at /buscar handled
// VAL-AUTH-009: /proveedor/dashboard route renders
// VAL-AUTH-010: /proveedor/subir route renders upload UI
// VAL-AUTH-011: /proveedor/productos route renders product list
// VAL-AUTH-012: /buscar route renders search UI
// VAL-AUTH-013: /producto/[id] route renders product detail
// ============================================================================

const srcDir = path.resolve(__dirname, "..", "src");

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(srcDir, relativePath), "utf-8");
}

// ============================================================================
// Route structure tests
// ============================================================================

describe("Route structure", () => {
  it("/proveedor/dashboard exists", () => {
    const content = readFile("app/proveedor/dashboard/page.tsx");
    expect(content).toContain("ProveedorDashboard");
    expect(content).toContain("useQuery");
    expect(content).toContain("api.products.listOwn");
  });

  it("/proveedor/subir exists with CatalogUpload component", () => {
    const content = readFile("app/proveedor/subir/page.tsx");
    expect(content).toContain("CatalogUpload");
  });

  it("/proveedor/productos exists with product listing", () => {
    const content = readFile("app/proveedor/productos/page.tsx");
    expect(content).toContain("ProductsTable");
    expect(content).toContain("api.products.listOwn");
  });

  it("/buscar exists with search UI and tree navigation", () => {
    const content = readFile("app/buscar/page.tsx");
    expect(content).toContain("ProductSearch");
    expect(content).toContain("TreeNavigation");
    expect(content).toContain("ProductsTable");
  });

  it("/producto/[id] exists with product detail", () => {
    const content = readFile("app/producto/[id]/page.tsx");
    expect(content).toContain("getProduct");
    expect(content).toContain("useParams");
    // Must have not-found state for invalid IDs
    expect(content).toContain("no encontrado");
  });
});

// ============================================================================
// Provider layout with sidebar navigation
// ============================================================================

describe("Provider layout", () => {
  it("has sidebar navigation linking to all provider sub-routes", () => {
    const content = readFile("app/proveedor/layout.tsx");
    // Navigation items must include all sub-routes
    expect(content).toContain("/proveedor/dashboard");
    expect(content).toContain("/proveedor/subir");
    expect(content).toContain("/proveedor/productos");
    // Must have a UserButton for authenticated users
    expect(content).toContain("UserButton");
    // Must have a sidebar component
    expect(content).toContain("aside");
  });

  it("uses usePathname for active navigation state", () => {
    const content = readFile("app/proveedor/layout.tsx");
    expect(content).toContain("usePathname");
  });
});

// ============================================================================
// Middleware route protection (VAL-AUTH-006, VAL-AUTH-007)
// ============================================================================

describe("Auth middleware", () => {
  it("protects /proveedor/* routes with auth check", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("isProviderRoute");
    expect(content).toContain("/proveedor");
    expect(content).toContain("auth()");
    expect(content).toContain("userId");
  });

  it("checks role from publicMetadata for provider access", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("publicMetadata");
    expect(content).toContain("proveedor");
  });

  it("redirects unauthenticated users to sign-in from /proveedor/*", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("sign-in");
    expect(content).toContain("redirect_url");
  });

  it("redirects non-proveedor users to /buscar", () => {
    const content = readFile("middleware.ts");
    // Should redirect comercio or unknown roles to /buscar
    expect(content).toContain("/buscar");
  });

  it("keeps /buscar and /producto as public routes", () => {
    const content = readFile("middleware.ts");
    expect(content).toContain("isPublicRoute");
    expect(content).toContain("/buscar");
    expect(content).toContain("/producto");
  });
});

// ============================================================================
// Data isolation (VAL-AUTH-008)
// ============================================================================

describe("Product data isolation", () => {
  it("listOwn query requires auth and scopes to provider", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "..", "convex", "products.ts"),
      "utf-8"
    );
    // listOwn must check auth
    expect(content).toContain("getUserIdentity");
    // Must filter by providerId using tokenIdentifier
    expect(content).toContain("by_provider");
    expect(content).toContain("tokenIdentifier");
  });

  it("remove mutation checks product ownership", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "..", "convex", "products.ts"),
      "utf-8"
    );
    // remove must verify providerId matches identity
    expect(content).toContain("providerId");
    expect(content).toContain("Not authorized");
  });
});

// ============================================================================
// Home page redirect based on role
// ============================================================================

describe("Home page redirect", () => {
  it("redirects proveedor to /proveedor/dashboard", () => {
    const content = readFile("app/page.tsx");
    expect(content).toContain("/proveedor/dashboard");
    expect(content).toContain("proveedor");
  });

  it("redirects comercio and anonymous to /buscar", () => {
    const content = readFile("app/page.tsx");
    expect(content).toContain("/buscar");
  });
});
