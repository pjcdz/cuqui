"use client";

import { ProductsTable, type ViewMode } from "@/components/products-table";
import { ProductSearch } from "@/components/product-search";
import {
  TreeNavigation,
  EMPTY_TREE_FILTER as EMPTY_TREE,
  type TreeFilter,
} from "@/components/tree-navigation";
import {
  ProductFilters,
  EMPTY_FILTER_STATE as EMPTY_FILTERS,
  type FilterState,
} from "@/components/product-filters";
import {
  applyAllFilters,
  parseFiltersFromParams,
  serializeFiltersToParams,
  hasAnyActiveFilter,
} from "@/lib/filters";
import { UserButton, SignInButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Store } from "lucide-react";
import Link from "next/link";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

type Product = Doc<"products">;

export function BuscarContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Parse initial state from URL params
  const initialState = useMemo(
    () => parseFiltersFromParams(searchParams),
    [searchParams]
  );

  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery);
  const [treeFilter, setTreeFilter] = useState<TreeFilter>({
    category: initialState.treeFilter.category,
    subcategory: initialState.treeFilter.subcategory,
    brand: initialState.treeFilter.brand,
    presentation: initialState.treeFilter.presentation,
  });
  const [filters, setFilters] = useState<FilterState>(initialState.filters);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Data fetching
  const allProducts = useQuery(api.products.list, {}) as Product[] | undefined;
  const providers = useQuery(api.providers.list, {});

  // Build provider name map: clerkId → businessName/name
  const providerNames = useMemo(() => {
    const map = new Map<string, string>();
    if (providers) {
      for (const p of providers) {
        map.set(p.clerkId, p.businessName || p.name);
      }
    }
    return map;
  }, [providers]);

  // Sync URL params when filters change
  useEffect(() => {
    const params = serializeFiltersToParams(treeFilter, filters, searchQuery);
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [treeFilter, filters, searchQuery, pathname, router]);

  // Combined filtering using shared logic
  const sortedProducts = useMemo(() => {
    if (!allProducts) return [];
    return applyAllFilters(allProducts, treeFilter, filters, searchQuery);
  }, [allProducts, treeFilter, filters, searchQuery]);

  // Clear all filters (tree + product filters + search)
  const clearAllFilters = useCallback(() => {
    setTreeFilter({ ...EMPTY_TREE });
    setFilters({ ...EMPTY_FILTERS });
    setSearchQuery("");
  }, []);

  // Check if any filter is active
  const hasFilter = hasAnyActiveFilter(treeFilter, filters, searchQuery);

  return (
    <>
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" aria-hidden="true" />
            <Link href="/buscar" className="text-xl font-bold" aria-label="Inicio - Buscar productos">
              Cuqui
            </Link>
            <span className="text-sm text-muted-foreground ml-2">
              Buscar Productos
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {isLoaded && !isSignedIn && (
              <SignInButton mode="modal">
                <button className="text-sm font-medium hover:underline">
                  Iniciar Sesión
                </button>
              </SignInButton>
            )}
            {isSignedIn && <UserButton aria-label="Menú de usuario" />}
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Buscar Productos</h1>
            <p className="text-muted-foreground mt-1">
              Explorá el catálogo de productos disponibles
            </p>
          </div>
          {/* Global clear filters button (VAL-DISPLAY-011) */}
          {hasFilter && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
              aria-label="Limpiar todos los filtros"
            >
              Limpiar todos los filtros
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <ProductSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filteredCount={sortedProducts.length}
            allProducts={(allProducts || []).map((p) => ({ name: p.name, brand: p.brand }))}
          />
        </div>

        {/* Active filters summary (VAL-DISPLAY-010, VAL-DISPLAY-011) */}
        {hasFilter && (
          <div className="mb-6 flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground">Filtros activos:</span>
            {treeFilter.category && (
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md capitalize">
                {treeFilter.category}
                <button
                  onClick={() => setTreeFilter({ ...EMPTY_TREE })}
                  className="hover:text-destructive"
                  aria-label={`Quitar filtro de categoría: ${treeFilter.category}`}
                >
                  ×
                </button>
              </span>
            )}
            {treeFilter.subcategory && (
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md capitalize">
                {treeFilter.subcategory}
                <button
                  onClick={() =>
                    setTreeFilter({
                      ...treeFilter,
                      subcategory: null,
                      brand: null,
                      presentation: null,
                    })
                  }
                  className="hover:text-destructive"
                  aria-label={`Quitar filtro de subcategoría: ${treeFilter.subcategory}`}
                >
                  ×
                </button>
              </span>
            )}
            {treeFilter.brand && (
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                {treeFilter.brand}
                <button
                  onClick={() =>
                    setTreeFilter({
                      ...treeFilter,
                      brand: null,
                      presentation: null,
                    })
                  }
                  className="hover:text-destructive"
                  aria-label={`Quitar filtro de marca: ${treeFilter.brand}`}
                >
                  ×
                </button>
              </span>
            )}
            {treeFilter.presentation && (
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                {treeFilter.presentation}
                <button
                  onClick={() =>
                    setTreeFilter({ ...treeFilter, presentation: null })
                  }
                  className="hover:text-destructive"
                  aria-label={`Quitar filtro de presentación: ${treeFilter.presentation}`}
                >
                  ×
                </button>
              </span>
            )}
            {filters.priceRange.min.trim() && (
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                Min: ${filters.priceRange.min}
                <button
                  onClick={() =>
                    setFilters({
                      ...filters,
                      priceRange: { ...filters.priceRange, min: "" },
                    })
                  }
                  className="hover:text-destructive"
                  aria-label="Quitar filtro de precio mínimo"
                >
                  ×
                </button>
              </span>
            )}
            {filters.priceRange.max.trim() && (
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                Max: ${filters.priceRange.max}
                <button
                  onClick={() =>
                    setFilters({
                      ...filters,
                      priceRange: { ...filters.priceRange, max: "" },
                    })
                  }
                  className="hover:text-destructive"
                  aria-label="Quitar filtro de precio máximo"
                >
                  ×
                </button>
              </span>
            )}
            {filters.selectedProviders.map((providerId) => (
              <span
                key={providerId}
                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md"
              >
                {providerNames.get(providerId) ||
                  providerId.split("|").pop() ||
                  providerId}
                <button
                  onClick={() =>
                    setFilters({
                      ...filters,
                      selectedProviders: filters.selectedProviders.filter(
                        (id) => id !== providerId
                      ),
                    })
                  }
                  className="hover:text-destructive"
                  aria-label={`Quitar filtro de proveedor: ${providerId}`}
                >
                  ×
                </button>
              </span>
            ))}
            {filters.onlyWithImage && (
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                Solo con imagen
                <button
                  onClick={() =>
                    setFilters({ ...filters, onlyWithImage: false })
                  }
                  className="hover:text-destructive"
                  aria-label="Quitar filtro de solo con imagen"
                >
                  ×
                </button>
              </span>
            )}
            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                Búsqueda: &quot;{searchQuery}&quot;
                <button
                  onClick={() => setSearchQuery("")}
                  className="hover:text-destructive"
                  aria-label="Quitar búsqueda"
                >
                  ×
                </button>
              </span>
            )}
            <span className="text-muted-foreground">
              — {sortedProducts.length} resultado
              {sortedProducts.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Tree navigation + Filters sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] mb-6">
          <TreeNavigation
            allProducts={allProducts || []}
            filter={treeFilter}
            onFilterChange={setTreeFilter}
            filteredCount={sortedProducts.length}
          />
          <ProductFilters
            filters={filters}
            onFiltersChange={setFilters}
            allProducts={allProducts || []}
            providerNames={providerNames}
            onClearAll={() => setFilters({ ...EMPTY_FILTERS })}
          />
        </div>

        {/* Product listing (VAL-DISPLAY-012: empty state) */}
        <div>
          {sortedProducts.length === 0 && hasFilter && allProducts ? (
            <div className="border rounded-lg p-8 text-center space-y-3">
              <p className="text-muted-foreground text-lg">
                No hay productos que coincidan con los filtros seleccionados
              </p>
              <button
                onClick={clearAllFilters}
                className="text-sm text-primary hover:underline"
                aria-label="Limpiar todos los filtros"
              >
                Limpiar todos los filtros
              </button>
            </div>
          ) : (
            <ProductsTable
              products={sortedProducts}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          )}
        </div>
      </main>
    </>
  );
}
