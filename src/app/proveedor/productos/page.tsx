"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ProductsTable } from "@/components/products-table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Product = Doc<"products">;

export default function ProveedorProductosPage() {
  const products = useQuery(api.products.listOwn, {}) as Product[] | undefined;
  const [filter, setFilter] = useState<"all" | "needs_review">("all");

  const filteredProducts = products?.filter((p: Product) => {
    if (filter === "needs_review") return p.reviewStatus === "needs_review";
    return true;
  }) ?? [];

  const needsReviewCount = products?.filter(
    (p: Product) => p.reviewStatus === "needs_review"
  ).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mis Productos</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu catálogo de productos
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          Todos ({products?.length ?? 0})
        </Button>
        <Button
          variant={filter === "needs_review" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("needs_review")}
        >
          <Badge variant="secondary" className="mr-2">{needsReviewCount}</Badge>
          Requieren Revisión
        </Button>
      </div>

      {filteredProducts.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {filter === "needs_review"
              ? "No hay productos que requieran revisión"
              : "No tenés productos todavía"}
          </h3>
          <p className="text-muted-foreground">
            {filter === "needs_review"
              ? "Todos tus productos están publicados correctamente"
              : "Subí un catálogo para empezar a cargar productos"}
          </p>
        </Card>
      ) : (
        <ProductsTable products={filteredProducts} />
      )}
    </div>
  );
}
