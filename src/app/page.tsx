"use client";

import { CatalogUpload } from "@/components/upload-catalog";
import { ProductsTable } from "@/components/products-table";
import { ProductSearch } from "@/components/product-search";
import { TreeNavigation } from "@/components/tree-navigation";
import { Toaster } from "@/components/ui/sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Single subscription to products
  const allProducts = useQuery(api.products.list, {});

  // Client-side filtering (single source of truth)
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];

    return allProducts.filter((product) => {
      // Tag filtering (AND logic)
      const hasAllTags = selectedTags.every((tag) =>
        product.tags.includes(tag)
      );
      if (!hasAllTags) return false;

      // Search filtering
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      const nameMatch = product.name.toLowerCase().includes(query);
      const brandMatch = product.brand.toLowerCase().includes(query);
      const categoryMatch = product.category.toLowerCase().includes(query);
      const tagsMatch = product.tags.some((tag) =>
        tag.toLowerCase().includes(query)
      );

      return nameMatch || brandMatch || categoryMatch || tagsMatch;
    });
  }, [allProducts, searchQuery, selectedTags]);
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
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
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
