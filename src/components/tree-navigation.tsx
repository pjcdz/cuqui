"use client";

import { useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, X, Filter, ArrowLeft } from "lucide-react";

type TreeProduct = {
  category: string;
  subcategory?: string;
  brand: string;
  presentation?: string;
};

export type TreeFilter = {
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  presentation: string | null;
};

export const EMPTY_TREE_FILTER: TreeFilter = {
  category: null,
  subcategory: null,
  brand: null,
  presentation: null,
};

type LevelOption = {
  value: string;
  count: number;
};

function countBy(
  products: TreeProduct[],
  getField: (p: TreeProduct) => string | undefined
): LevelOption[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const value = getField(p);
    if (value) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Progressive tree navigation per SRS RF-006, RF-007, RF-012, RF-013, RF-014.
 *
 * Levels:
 *   0 → Categoría     (product.category)
 *   1 → Subcategoría  (product.subcategory — skipped if none exist)
 *   2 → Marca         (product.brand)
 *   3 → Presentación  (product.presentation)
 *
 * Each level shows ONLY options that have matching products (RF-014).
 * Selections accumulate with AND logic (RF-012).
 * Options regenerate dynamically from remaining products (RF-013, RF-007).
 *
 * Keyboard navigation (VAL-POLISH-007):
 *   ArrowUp/ArrowDown → move focus between options
 *   Enter/Space → select focused option
 *   ArrowRight → expand/select (same as Enter)
 *   ArrowLeft → go back one level
 *   Escape → go back one level or clear all if at root
 */
export function TreeNavigation({
  allProducts,
  filter,
  onFilterChange,
  filteredCount,
}: {
  allProducts: TreeProduct[];
  filter: TreeFilter;
  onFilterChange: (filter: TreeFilter) => void;
  filteredCount: number;
}) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Compute what the next level should show
  const { nextLevelName, nextOptions } = useMemo(() => {
    // Level 0: Categories
    if (!filter.category) {
      return {
        nextLevelName: "Categoría",
        nextOptions: countBy(allProducts, (p) => p.category),
      };
    }

    const byCategory = allProducts.filter(
      (p) => p.category === filter.category
    );

    // Level 1: Subcategories (only if any exist for this category)
    if (!filter.subcategory) {
      const subcats = countBy(byCategory, (p) => p.subcategory).filter(
        (o) => o.value
      );
      if (subcats.length > 0) {
        return { nextLevelName: "Subcategoría", nextOptions: subcats };
      }
      // No subcategories → skip to brands
      return {
        nextLevelName: "Marca",
        nextOptions: countBy(byCategory, (p) => p.brand),
      };
    }

    // Level 1 selected, show brands
    const bySubcat = byCategory.filter(
      (p) => p.subcategory === filter.subcategory
    );

    if (!filter.brand) {
      return {
        nextLevelName: "Marca",
        nextOptions: countBy(bySubcat, (p) => p.brand),
      };
    }

    // Level 2 selected, show presentations
    const byBrand = bySubcat.filter(
      (p) => p.brand === filter.brand
    );

    if (!filter.presentation) {
      const presOptions = countBy(byBrand, (p) => p.presentation).filter(
        (o) => o.value
      );
      if (presOptions.length > 0) {
        return { nextLevelName: "Presentación", nextOptions: presOptions };
      }
      // No presentations → all selected
      return { nextLevelName: null, nextOptions: [] };
    }

    // All levels selected
    return { nextLevelName: null, nextOptions: [] };
  }, [allProducts, filter]);

  // Breadcrumb trail
  const breadcrumb = useMemo(() => {
    const items: { label: string; clearFrom: keyof TreeFilter }[] = [];
    if (filter.category)
      items.push({ label: filter.category, clearFrom: "category" });
    if (filter.subcategory)
      items.push({ label: filter.subcategory, clearFrom: "subcategory" });
    if (filter.brand)
      items.push({ label: filter.brand, clearFrom: "brand" });
    if (filter.presentation)
      items.push({ label: filter.presentation, clearFrom: "presentation" });
    return items;
  }, [filter]);

  const hasAnyFilter =
    filter.category !== null ||
    filter.subcategory !== null ||
    filter.brand !== null ||
    filter.presentation !== null;
  const allSelected = nextLevelName === null;

  function selectOption(value: string) {
    if (!filter.category) {
      onFilterChange({ category: value, subcategory: null, brand: null, presentation: null });
    } else if (
      !filter.subcategory &&
      nextLevelName === "Subcategoría"
    ) {
      onFilterChange({ ...filter, subcategory: value, brand: null, presentation: null });
    } else if (!filter.brand) {
      onFilterChange({ ...filter, brand: value, presentation: null });
    } else if (!filter.presentation) {
      onFilterChange({ ...filter, presentation: value });
    }
    setFocusedIndex(-1);
  }

  function goBack() {
    if (filter.presentation !== null) {
      onFilterChange({ ...filter, presentation: null });
    } else if (filter.brand !== null) {
      onFilterChange({ ...filter, brand: null });
    } else if (filter.subcategory !== null) {
      onFilterChange({ ...filter, subcategory: null });
    } else if (filter.category !== null) {
      onFilterChange({ ...EMPTY_TREE_FILTER });
    }
    setFocusedIndex(-1);
  }

  function clearAll() {
    onFilterChange({ ...EMPTY_TREE_FILTER });
    setFocusedIndex(-1);
  }

  function breadcrumbClick(clearFrom: keyof TreeFilter) {
    const newFilter = { ...filter };
    if (clearFrom === "category") {
      newFilter.category = null;
      newFilter.subcategory = null;
      newFilter.brand = null;
      newFilter.presentation = null;
    } else if (clearFrom === "subcategory") {
      newFilter.subcategory = null;
      newFilter.brand = null;
      newFilter.presentation = null;
    } else if (clearFrom === "brand") {
      newFilter.brand = null;
      newFilter.presentation = null;
    } else if (clearFrom === "presentation") {
      newFilter.presentation = null;
    }
    onFilterChange(newFilter);
    setFocusedIndex(-1);
  }

  // Keyboard navigation handler (VAL-POLISH-007)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (allSelected || !nextLevelName || nextOptions.length === 0) return;

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = Math.min(focusedIndex + 1, nextOptions.length - 1);
        setFocusedIndex(next);
        optionsRef.current[next]?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(prev);
        optionsRef.current[prev]?.focus();
        break;
      }
      case "ArrowRight":
      case "Enter":
      case " ": {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < nextOptions.length) {
          selectOption(nextOptions[focusedIndex].value);
        }
        break;
      }
      case "ArrowLeft":
      case "Escape": {
        e.preventDefault();
        goBack();
        break;
      }
    }
  }

  return (
    <Card className="p-6" role="tree" aria-label="Navegación por árbol de categorías">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-lg font-semibold">Navegación por Árbol</h3>
          </div>
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-muted-foreground"
              aria-label="Limpiar todos los filtros del árbol"
            >
              <X className="h-4 w-4 mr-1" aria-hidden="true" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <nav aria-label="Ruta de filtros seleccionados" className="flex items-center gap-1 text-sm flex-wrap">
            <button
              onClick={clearAll}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Volver al inicio del árbol"
            >
              Inicio
            </button>
            {breadcrumb.map((item, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <button
                  onClick={() => breadcrumbClick(item.clearFrom)}
                  className={
                    idx === breadcrumb.length - 1
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground transition-colors"
                  }
                  aria-label={`Quitar filtro: ${item.label}`}
                  aria-current={idx === breadcrumb.length - 1 ? "true" : undefined}
                >
                  {item.label}
                </button>
              </span>
            ))}
          </nav>
        )}

        {/* Back button */}
        {hasAnyFilter && !allSelected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="text-muted-foreground -ml-2"
            aria-label="Volver al nivel anterior"
          >
            <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" />
            Volver
          </Button>
        )}

        {/* Level options with keyboard navigation */}
        {!allSelected && nextLevelName && (
          <div
            role="group"
            aria-label={`Opciones de ${nextLevelName.toLowerCase()}`}
            onKeyDown={handleKeyDown}
          >
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Seleccioná {nextLevelName.toLowerCase()}
            </h4>
            {nextOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {nextOptions.map(({ value, count }, idx) => (
                  <Button
                    key={value}
                    ref={(el) => { optionsRef.current[idx] = el; }}
                    variant="outline"
                    size="sm"
                    onClick={() => selectOption(value)}
                    className={`group hover:bg-primary hover:text-primary-foreground transition-colors ${
                      focusedIndex === idx ? "ring-2 ring-primary" : ""
                    }`}
                    role="treeitem"
                    aria-label={`Filtrar por ${nextLevelName.toLowerCase()}: ${value} (${count} producto${count !== 1 ? "s" : ""})`}
                    tabIndex={idx === 0 ? 0 : -1}
                  >
                    <span className="capitalize">{value}</span>
                    <Badge
                      variant="secondary"
                      className="ml-2 group-hover:bg-primary-foreground/20"
                    >
                      {count}
                    </Badge>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay opciones disponibles para este nivel.
              </p>
            )}
          </div>
        )}

        {/* All filters selected — summary */}
        {allSelected && (
          <div className="bg-muted/50 p-3 rounded-lg" role="status" aria-live="polite">
            <p className="text-sm">
              Mostrando <span className="font-semibold">{filteredCount}</span>{" "}
              producto{filteredCount !== 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {filter.category && (
                <Badge variant="secondary" className="capitalize">
                  {filter.category}
                </Badge>
              )}
              {filter.subcategory && (
                <Badge variant="secondary" className="capitalize">
                  {filter.subcategory}
                </Badge>
              )}
              {filter.brand && (
                <Badge variant="secondary" className="capitalize">
                  {filter.brand}
                </Badge>
              )}
              {filter.presentation && (
                <Badge variant="secondary" className="capitalize">
                  {filter.presentation}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Filter count */}
        {hasAnyFilter && !allSelected && (
          <div className="text-sm text-muted-foreground pt-2 border-t" role="status" aria-live="polite">
            {filteredCount} producto{filteredCount !== 1 ? "s" : ""} encontrado
            {filteredCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </Card>
  );
}
