"use client";

import { CatalogUpload } from "@/components/upload-catalog";
import { ProductsTable } from "@/components/products-table";
import { ProductSearch } from "@/components/product-search";
import { TreeNavigation, EMPTY_TREE_FILTER } from "@/components/tree-navigation";
import type { TreeFilter } from "@/components/tree-navigation";
import { Toaster } from "@/components/ui/sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [treeFilter, setTreeFilter] = useState<TreeFilter>({ ...EMPTY_TREE_FILTER });

  const allProducts = useQuery(api.products.list, {});

  // Combined filtering: tree filter (field-based) + text search
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];

    return allProducts.filter((product) => {
      // Tree filter: category → subcategory → brand (AND logic, RF-012)
      if (treeFilter.category !== null && product.category !== treeFilter.category)
        return false;
      if (treeFilter.subcategory !== null && product.subcategory !== treeFilter.subcategory)
        return false;
      if (treeFilter.brand !== null && product.brand !== treeFilter.brand)
        return false;

      // Text search (RF-010)
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(q) ||
        product.brand.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q) ||
        product.tags.some((tag: string) => tag.toLowerCase().includes(q))
      );
    });
  }, [allProducts, searchQuery, treeFilter]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <main className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Cuqui - Catálogo B2B</h1>
          <p className="text-muted-foreground mt-2">
            Sistema de catálogo y búsqueda para proveedores y comercios
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <CatalogUpload />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <ProductSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filteredCount={filteredProducts.length}
          />
          <TreeNavigation
            allProducts={allProducts || []}
            filter={treeFilter}
            onFilterChange={setTreeFilter}
            filteredCount={filteredProducts.length}
          />
        </div>

        <div className="mt-8">
          <ProductsTable products={filteredProducts} />
        </div>
      </main>
    </div>
  );
}
