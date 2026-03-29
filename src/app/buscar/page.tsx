"use client";

import { ProductsTable, type ViewMode } from "@/components/products-table";
import { ProductSearch } from "@/components/product-search";
import { TreeNavigation, EMPTY_TREE_FILTER } from "@/components/tree-navigation";
import type { TreeFilter } from "@/components/tree-navigation";
import { Toaster } from "@/components/ui/sonner";
import { UserButton, SignInButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { Store } from "lucide-react";
import Link from "next/link";

type Product = Doc<"products">;

export default function BuscarPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [treeFilter, setTreeFilter] = useState<TreeFilter>({ ...EMPTY_TREE_FILTER });
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const allProducts = useQuery(api.products.list, {}) as Product[] | undefined;

  // Combined filtering: tree filter (field-based) + text search
  const filteredProducts = useMemo(() => {
    if (!allProducts) return [];

    return allProducts.filter((product: Product) => {
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <Link href="/buscar" className="text-xl font-bold">
              Cuqui
            </Link>
            <span className="text-sm text-muted-foreground ml-2">
              Buscar Productos
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isLoaded && !isSignedIn && (
              <SignInButton mode="modal">
                <button className="text-sm font-medium hover:underline">
                  Iniciar Sesión
                </button>
              </SignInButton>
            )}
            {isSignedIn && <UserButton />}
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Buscar Productos</h1>
          <p className="text-muted-foreground mt-1">
            Explorá el catálogo de productos disponibles
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
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
          <ProductsTable
            products={filteredProducts}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </main>
    </div>
  );
}
