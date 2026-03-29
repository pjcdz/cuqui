"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { ProductsTable } from "@/components/products-table";
import { DuplicateDetection } from "@/components/duplicate-detection";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Package,
  CheckCircle,
  Search,
  Download,
  Percent,
  DollarSign,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Id } from "@/convex/_generated/dataModel";

type Product = Doc<"products">;

// ============================================================================
// Batch price update dialog (VAL-CATALOG-006)
// ============================================================================

function BatchPriceDialog({
  open,
  onOpenChange,
  selectedCount,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onApply: (mode: "percentage" | "fixed", value: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      toast.error("Ingresá un valor numérico válido");
      return;
    }
    if (mode === "fixed" && numValue <= 0) {
      toast.error("El precio fijo debe ser mayor a 0");
      return;
    }
    if (mode === "percentage" && numValue <= -100) {
      toast.error("La disminución porcentual no puede superar -100%");
      return;
    }

    setLoading(true);
    try {
      await onApply(mode, numValue);
      setValue("");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualización masiva de precios</DialogTitle>
          <DialogDescription>
            Aplicar cambio de precio a {selectedCount} producto
            {selectedCount !== 1 ? "s" : ""} seleccionado
            {selectedCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Mode selector */}
          <div className="flex gap-2">
            <Button
              variant={mode === "percentage" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("percentage")}
              className="flex-1 gap-2"
            >
              <Percent className="h-4 w-4" />
              Porcentaje
            </Button>
            <Button
              variant={mode === "fixed" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("fixed")}
              className="flex-1 gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Precio fijo
            </Button>
          </div>

          {/* Value input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {mode === "percentage"
                ? "Porcentaje de cambio (ej: 10 para subir 10%, -5 para bajar 5%)"
                : "Nuevo precio para todos los seleccionados"}
            </label>
            <Input
              type="number"
              step={mode === "percentage" ? "1" : "0.01"}
              placeholder={mode === "percentage" ? "Ej: 10" : "Ej: 1500"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleApply} disabled={loading || !value}>
            {loading ? "Aplicando..." : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main page
// ============================================================================

export default function ProveedorProductosPage() {
  const products = useQuery(api.products.listOwn, { includeInactive: true }) as Product[] | undefined;
  const [filter, setFilter] = useState<"all" | "needs_review" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Search query for server-side filtering
  const searchResults = useQuery(
    api.products.searchOwn,
    searchQuery.trim().length > 0 ? { query: searchQuery } : "skip"
  ) as Product[] | undefined;

  // Publish all confirmation dialog
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  // Batch price update dialog (VAL-CATALOG-006)
  const [batchPriceDialogOpen, setBatchPriceDialogOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Id<"products">[]>([]);

  // Mutations
  const batchPublishAll = useMutation(api.products.batchPublishAll);
  const batchPriceUpdate = useMutation(api.products.batchPriceUpdate);
  const toggleActive = useMutation(api.products.toggleActive);
  const exportData = useQuery(api.products.getExportData, {});

  // Apply filters: status filter + search
  const baseProducts = products ?? [];
  const displayProducts = (() => {
    // If searching, use search results (server-side filtered)
    let source: Product[];
    if (searchQuery.trim().length > 0 && searchResults !== undefined) {
      source = searchResults;
    } else {
      source = baseProducts;
    }

    // Apply status filter
    return source.filter((p: Product) => {
      if (filter === "needs_review") return p.reviewStatus === "needs_review";
      if (filter === "inactive") return p.active === false;
      return true; // "all" shows everything including inactive
    });
  })();

  const needsReviewCount = baseProducts.filter(
    (p: Product) => p.reviewStatus === "needs_review"
  ).length;
  const inactiveCount = baseProducts.filter(
    (p: Product) => p.active === false
  ).length;

  const handlePublishAll = async () => {
    try {
      const result = await batchPublishAll({});
      toast.success(`${result.published} producto${result.published !== 1 ? "s" : ""} publicado${result.published !== 1 ? "s" : ""} correctamente`);
      setPublishDialogOpen(false);
      setFilter("all");
    } catch {
      toast.error("Error al publicar productos");
    }
  };

  // Toggle active/deactivate/reactivate (VAL-CATALOG-007, VAL-CATALOG-008)
  const handleToggleActive = useCallback(
    async (product: { _id: string; name: string; active?: boolean }) => {
      const isActive = product.active !== false;
      const newActive = !isActive;
      try {
        await toggleActive({
          id: product._id as Id<"products">,
          active: newActive,
        });
        toast.success(
          newActive
            ? `Producto "${product.name}" reactivado`
            : `Producto "${product.name}" desactivado`
        );
      } catch {
        toast.error("Error al cambiar el estado del producto");
      }
    },
    [toggleActive],
  );

  // Batch price update handler (VAL-CATALOG-006)
  const handleBatchPriceUpdate = async (mode: "percentage" | "fixed", value: number) => {
    if (selectedProductIds.length === 0) {
      toast.error("No hay productos seleccionados");
      return;
    }
    try {
      const result = await batchPriceUpdate({
        productIds: selectedProductIds,
        mode,
        value,
      });
      toast.success(
        `${result.updated} precio${result.updated !== 1 ? "s" : ""} actualizado${result.updated !== 1 ? "s" : ""} correctamente`
      );
      setSelectedProductIds([]);
    } catch {
      toast.error("Error al actualizar precios");
    }
  };

  // Export to Excel handler (VAL-CATALOG-011)
  const handleExport = useCallback(() => {
    const data = exportData as { name: string; category: string; subcategory: string; brand: string; price: number; unit: string; presentation: string; provider: string; tags: string; reviewStatus: string }[] | undefined;
    if (!data || data.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    const worksheetData = data.map((row) => ({
      Nombre: row.name,
      Categoría: row.category,
      Subcategoría: row.subcategory,
      Marca: row.brand,
      Precio: row.price,
      Unidad: row.unit,
      Presentación: row.presentation,
      Proveedor: row.provider,
      Tags: row.tags,
      Estado: row.reviewStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Catálogo");

    // Auto-size columns
    const colWidths = Object.keys(worksheetData[0] ?? {}).map((key) => ({
      wch: Math.max(key.length, ...worksheetData.map((row) => String((row as Record<string, unknown>)[key] ?? "").length)).valueOf() + 2,
    }));
    worksheet["!cols"] = colWidths;

    const now = new Date();
    const filename = `catalogo_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success("Catálogo exportado correctamente");
  }, [exportData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mis Productos</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu catálogo de productos
        </p>
      </div>

      {/* Search + filter tabs + actions */}
      <div className="space-y-3">
        {/* Search bar (VAL-CATALOG-010) */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nombre, marca o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter tabs + action buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Todos ({baseProducts.length})
            </Button>
            <Button
              variant={filter === "needs_review" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("needs_review")}
            >
              <Badge variant="secondary" className="mr-2">{needsReviewCount}</Badge>
              Requieren Revisión
            </Button>
            {inactiveCount > 0 && (
              <Button
                variant={filter === "inactive" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("inactive")}
              >
                <Badge variant="secondary" className="mr-2">{inactiveCount}</Badge>
                Desactivados
              </Button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Publicar todo button (VAL-CATALOG-004) */}
            {needsReviewCount > 0 && (
              <Button
                onClick={() => setPublishDialogOpen(true)}
                size="sm"
                className="gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Publicar todo
              </Button>
            )}
            {/* Export to Excel button (VAL-CATALOG-011) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2"
              disabled={!exportData || exportData.length === 0}
            >
              <Download className="h-4 w-4" />
              Exportar a Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Duplicate detection section (VAL-CATALOG-012, VAL-CATALOG-013, VAL-CATALOG-014) */}
      <DuplicateDetection />

      {displayProducts.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery.trim()
              ? "No hay productos que coincidan con la búsqueda"
              : filter === "needs_review"
                ? "No hay productos que requieran revisión"
                : filter === "inactive"
                  ? "No hay productos desactivados"
                  : "No tenés productos todavía"}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery.trim()
              ? "Probá con otros términos de búsqueda"
              : filter === "needs_review"
                ? "Todos tus productos están publicados correctamente"
                : "Subí un catálogo para empezar a cargar productos"}
          </p>
        </Card>
      ) : (
        <ProductsTable
          products={displayProducts}
          providerMode
          onToggleActive={handleToggleActive}
          onBatchPriceUpdate={(productIds) => {
            setSelectedProductIds(productIds as Id<"products">[]);
            if (productIds.length > 0) {
              setBatchPriceDialogOpen(true);
            }
          }}
        />
      )}

      {/* Publicar todo confirmation dialog (VAL-CATALOG-004) */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar publicación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que querés publicar los {needsReviewCount} producto
              {needsReviewCount !== 1 ? "s" : ""} que requieren revisión?
              Todos serán marcados como publicados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button onClick={handlePublishAll}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Publicar {needsReviewCount} producto{needsReviewCount !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch price update dialog (VAL-CATALOG-006) */}
      <BatchPriceDialog
        open={batchPriceDialogOpen}
        onOpenChange={setBatchPriceDialogOpen}
        selectedCount={selectedProductIds.length}
        onApply={handleBatchPriceUpdate}
      />
    </div>
  );
}
