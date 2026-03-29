import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ============================================================================
// VAL-POLISH-004: Dark mode toggle
// VAL-POLISH-005: Dark mode respects system preference
// VAL-POLISH-006: ARIA labels on interactive elements
// VAL-POLISH-007: Keyboard navigation for tree
// VAL-POLISH-008: Focus management on modal open/close
// ============================================================================

const rootDir = path.resolve(__dirname, "..");
const srcDir = path.resolve(rootDir, "src");
const componentsDir = path.resolve(srcDir, "components");
const appDir = path.resolve(srcDir, "app");

function readComponent(name: string): string {
  return fs.readFileSync(path.resolve(componentsDir, name), "utf-8");
}

function readAppFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(appDir, relativePath), "utf-8");
}

// ============================================================================
// VAL-POLISH-004: Dark mode toggle
// ============================================================================

describe("Dark mode toggle (VAL-POLISH-004)", () => {
  it("next-themes is in package.json dependencies", () => {
    const pkg = fs.readFileSync(path.resolve(rootDir, "package.json"), "utf-8");
    const parsed = JSON.parse(pkg);
    expect(parsed.dependencies).toHaveProperty("next-themes");
  });

  it("layout.tsx wraps app with ThemeProvider from next-themes", () => {
    const layout = readAppFile("layout.tsx");
    expect(layout).toContain("next-themes");
    expect(layout).toContain("ThemeProvider");
  });

  it("ThemeProvider uses attribute='class' strategy for Tailwind dark mode", () => {
    const layout = readAppFile("layout.tsx");
    expect(layout).toMatch(/attribute.*["']class["']/);
  });

  it("ThemeProvider enables system preference detection (enableSystem)", () => {
    const layout = readAppFile("layout.tsx");
    expect(layout).toContain("enableSystem");
  });

  it("html element has suppressHydrationWarning for next-themes", () => {
    const layout = readAppFile("layout.tsx");
    expect(layout).toContain("suppressHydrationWarning");
  });

  it("globals.css has .dark variant for class-based dark mode", () => {
    const css = readAppFile("globals.css");
    expect(css).toContain(".dark");
  });

  it("globals.css has dark custom variant for Tailwind v4", () => {
    const css = readAppFile("globals.css");
    expect(css).toContain("@custom-variant dark");
  });

  it("ThemeToggle component exists", () => {
    const exists = fs.existsSync(
      path.resolve(componentsDir, "theme-toggle.tsx")
    );
    expect(exists).toBe(true);
  });

  it("ThemeToggle uses useTheme from next-themes", () => {
    const toggle = readComponent("theme-toggle.tsx");
    expect(toggle).toContain("useTheme");
    expect(toggle).toContain("next-themes");
  });

  it("ThemeToggle switches between light and dark", () => {
    const toggle = readComponent("theme-toggle.tsx");
    expect(toggle).toMatch(/setTheme/);
    expect(toggle).toMatch(/["']light["']/);
    expect(toggle).toMatch(/["']dark["']/);
  });

  it("ThemeToggle has moon/sun icons for visual feedback", () => {
    const toggle = readComponent("theme-toggle.tsx");
    expect(toggle).toMatch(/Moon|Sun/);
  });

  it("ThemeToggle handles hydration mismatch with mounted state", () => {
    const toggle = readComponent("theme-toggle.tsx");
    expect(toggle).toMatch(/mounted|useEffect/);
  });

  it("ThemeToggle has ARIA label for accessibility", () => {
    const toggle = readComponent("theme-toggle.tsx");
    expect(toggle).toContain("aria-label");
  });
});

// ============================================================================
// VAL-POLISH-005: Dark mode respects system preference
// ============================================================================

describe("Dark mode respects system preference (VAL-POLISH-005)", () => {
  it("ThemeProvider defaults to 'system' theme", () => {
    const layout = readAppFile("layout.tsx");
    expect(layout).toMatch(/defaultTheme.*["']system["']/);
  });

  it("ThemeProvider enables system preference with enableSystem prop", () => {
    const layout = readAppFile("layout.tsx");
    expect(layout).toContain("enableSystem");
  });
});

// ============================================================================
// VAL-POLISH-006: ARIA labels on interactive elements
// ============================================================================

describe("ARIA labels on interactive elements (VAL-POLISH-006)", () => {
  it("tree-navigation.tsx has aria-label on the tree container", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/aria-label.*árbol|role.*tree/);
  });

  it("tree-navigation.tsx has aria-label on option buttons", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/aria-label.*filtrar/i);
  });

  it("tree-navigation.tsx uses aria-hidden on decorative icons", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/aria-hidden/);
  });

  it("product-search.tsx has aria-label on search input", () => {
    const search = readComponent("product-search.tsx");
    expect(search).toMatch(/aria-label.*buscar/i);
  });

  it("product-filters.tsx has aria-label on price inputs", () => {
    const filters = readComponent("product-filters.tsx");
    expect(filters).toMatch(/aria-label.*precio/i);
  });

  it("product-filters.tsx has aria-label on sort buttons", () => {
    const filters = readComponent("product-filters.tsx");
    expect(filters).toMatch(/aria-label.*ordenar/i);
  });

  it("product-filters.tsx has aria-pressed on sort buttons", () => {
    const filters = readComponent("product-filters.tsx");
    expect(filters).toContain("aria-pressed");
  });

  it("product-filters.tsx has aria-label on provider checkboxes", () => {
    const filters = readComponent("product-filters.tsx");
    expect(filters).toMatch(/aria-label.*proveedor/i);
  });

  it("product-filters.tsx has aria-label on image-only toggle", () => {
    const filters = readComponent("product-filters.tsx");
    expect(filters).toMatch(/aria-label.*imagen/i);
  });

  it("products-table.tsx has aria-label on view toggle buttons", () => {
    const table = readComponent("products-table.tsx");
    expect(table).toMatch(/aria-label.*vista/i);
  });

  it("products-table.tsx has aria-label on pagination buttons", () => {
    const table = readComponent("products-table.tsx");
    expect(table).toMatch(/aria-label.*página/i);
  });

  it("products-table.tsx has aria-label on delete action buttons", () => {
    const table = readComponent("products-table.tsx");
    expect(table).toMatch(/aria-label.*eliminar/i);
  });

  it("products-table.tsx has aria-label on inline edit buttons", () => {
    const table = readComponent("products-table.tsx");
    expect(table).toMatch(/aria-label.*editar/i);
  });

  it("proveedor layout has aria-label on nav", () => {
    const layout = readAppFile("proveedor/layout.tsx");
    expect(layout).toMatch(/aria-label.*navegación/i);
  });

  it("proveedor layout has aria-label on brand link", () => {
    const layout = readAppFile("proveedor/layout.tsx");
    expect(layout).toMatch(/aria-label.*dashboard/i);
  });

  it("ThemeToggle is in the proveedor sidebar", () => {
    const layout = readAppFile("proveedor/layout.tsx");
    expect(layout).toContain("ThemeToggle");
  });

  it("ThemeToggle is in the buscar header", () => {
    const buscar = readAppFile("buscar/buscar-content.tsx");
    expect(buscar).toContain("ThemeToggle");
  });

  it("duplicate-detection.tsx has aria-label on action buttons", () => {
    const dup = readComponent("duplicate-detection.tsx");
    expect(dup).toMatch(/aria-label.*fusionar|aria-label.*duplicados/i);
  });

  it("upload-catalog.tsx has aria-label on file input", () => {
    const upload = readComponent("upload-catalog.tsx");
    expect(upload).toMatch(/aria-label.*archivo|aria-label.*catálogo/i);
  });
});

// ============================================================================
// VAL-POLISH-007: Keyboard navigation for tree
// ============================================================================

describe("Keyboard navigation for tree (VAL-POLISH-007)", () => {
  it("tree-navigation.tsx has onKeyDown handler", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/onKeyDown|handleKeyDown/);
  });

  it("tree handles ArrowDown key to move focus forward", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toContain("ArrowDown");
  });

  it("tree handles ArrowUp key to move focus backward", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toContain("ArrowUp");
  });

  it("tree handles Enter key to select focused option", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/["']Enter["']/);
  });

  it("tree handles Escape key to go back", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toContain("Escape");
  });

  it("tree handles ArrowRight key as select/expand", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toContain("ArrowRight");
  });

  it("tree handles ArrowLeft key to go back", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toContain("ArrowLeft");
  });

  it("tree uses focusedIndex state for keyboard focus tracking", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/focusedIndex/);
  });

  it("tree buttons have tabIndex for roving focus pattern", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/tabIndex/);
  });

  it("tree has focus ring visual indicator for focused option", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/ring-2|ring-primary|focus-visible/);
  });

  it("tree options container has role='group' for accessibility", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/role.*group/);
  });

  it("tree uses preventDefault on arrow keys to prevent scroll", () => {
    const tree = readComponent("tree-navigation.tsx");
    expect(tree).toMatch(/preventDefault/);
  });
});

// ============================================================================
// VAL-POLISH-008: Focus management on modal open/close
// ============================================================================

describe("Focus management on modal open/close (VAL-POLISH-008)", () => {
  it("dialog component uses base-ui Dialog with modal mode", () => {
    const dialog = readComponent("ui/dialog.tsx");
    expect(dialog).toContain("@base-ui/react/dialog");
  });

  it("product detail modal uses Dialog component (which has built-in focus trap)", () => {
    const table = readComponent("products-table.tsx");
    expect(table).toContain("Dialog");
    expect(table).toContain("DialogContent");
  });

  it("modal has DialogTitle for screen readers", () => {
    const table = readComponent("products-table.tsx");
    expect(table).toContain("DialogTitle");
  });

  it("modal has DialogDescription for screen readers", () => {
    const table = readComponent("products-table.tsx");
    expect(table).toContain("DialogDescription");
  });

  it("close button has sr-only text for accessibility", () => {
    const dialog = readComponent("ui/dialog.tsx");
    expect(dialog).toMatch(/sr-only|Close/i);
  });

  it("delete confirmation dialog has accessible description", () => {
    const table = readComponent("products-table.tsx");
    expect(table).toContain("DialogDescription");
  });

  it("Dialog component renders overlay backdrop for click-outside dismiss", () => {
    const dialog = readComponent("ui/dialog.tsx");
    expect(dialog).toMatch(/Backdrop|Overlay/);
  });
});
