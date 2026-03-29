"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Package,
  Building2,
  DollarSign,
  Tag,
  Image as ImageIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type ViewMode = "table" | "grid";

type Product = {
  _id: string;
  name: string;
  brand: string;
  presentation: string;
  price: number;
  normalizedPrice?: number;
  unitOfMeasure?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  imageUrl?: string;
  providerId: string;
  rawText?: string;
  packagingType?: string;
  saleFormat?: string;
  priceType?: string;
  confidence?: number;
  reviewStatus?: string;
  quantity?: number;
  multiplier?: number;
};

const PAGE_SIZE = 20;

// ============================================================================
// Price formatter (es-AR locale)
// ============================================================================

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

// ============================================================================
// Column definitions
// ============================================================================

function createColumns(): ColumnDef<Product>[] {
  return [
    {
      accessorKey: "imageUrl",
      header: () => <span className="sr-only">Imagen</span>,
      size: 60,
      cell: ({ row }) => {
        const url = row.original.imageUrl;
        if (url) {
          return (
            <img
              src={url}
              alt={row.original.name}
              className="h-10 w-10 rounded object-cover"
            />
          );
        }
        return (
          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortHeader column={column}>Producto</SortHeader>
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <SortHeader column={column}>Categoría</SortHeader>
      ),
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize">
          {row.original.category}
        </Badge>
      ),
    },
    {
      accessorKey: "brand",
      header: ({ column }) => (
        <SortHeader column={column}>Marca</SortHeader>
      ),
    },
    {
      accessorKey: "price",
      header: ({ column }) => (
        <SortHeader column={column}>Precio</SortHeader>
      ),
      cell: ({ row }) => (
        <span className="font-semibold">{formatPrice(row.original.price)}</span>
      ),
    },
    {
      accessorKey: "providerId",
      header: "Proveedor",
      cell: ({ row }) => {
        // Extract a readable name from providerId (it's a Clerk token identifier)
        const id = row.original.providerId;
        const shortId = id.split("|").pop() || id;
        return (
          <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
            {shortId}
          </span>
        );
      },
      enableSorting: false,
    },
  ];
}

// ============================================================================
// Sortable column header
// ============================================================================

function SortHeader({
  column,
  children,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; getToggleSortingHandler: () => ((e: unknown) => void) | undefined };
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  const toggleHandler = column.getToggleSortingHandler();
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={toggleHandler ?? undefined}
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

// ============================================================================
// Product detail modal
// ============================================================================

function ProductDetailModal({
  product,
  open,
  onOpenChange,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Detalle del producto {product.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Image */}
          {product.imageUrl && (
            <div className="rounded-lg overflow-hidden bg-muted">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full max-h-64 object-contain"
              />
            </div>
          )}

          {/* Category path */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="capitalize">
              {product.category}
            </Badge>
            {product.subcategory && (
              <Badge variant="outline" className="capitalize">
                {product.subcategory}
              </Badge>
            )}
          </div>

          {/* Main info grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoItem
              icon={<Building2 className="h-4 w-4" />}
              label="Marca"
              value={product.brand}
            />
            <InfoItem
              icon={<Package className="h-4 w-4" />}
              label="Presentación"
              value={product.presentation}
            />
            <InfoItem
              icon={<DollarSign className="h-4 w-4" />}
              label="Precio"
              value={formatPrice(product.price)}
              valueClassName="text-lg font-bold text-primary"
            />
            {product.normalizedPrice !== undefined && (
              <InfoItem
                icon={<DollarSign className="h-4 w-4 text-green-600" />}
                label="Precio Normalizado"
                value={`${formatPrice(product.normalizedPrice)}${product.unitOfMeasure ? `/${product.unitOfMeasure}` : ""}`}
                valueClassName="font-semibold text-green-600"
              />
            )}
            {product.unitOfMeasure && (
              <InfoItem label="Unidad" value={product.unitOfMeasure} />
            )}
            {product.quantity !== undefined && (
              <InfoItem label="Cantidad" value={String(product.quantity)} />
            )}
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Tag className="h-4 w-4" />
                Tags
              </div>
              <div className="flex flex-wrap gap-1">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="capitalize text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Additional details */}
          <div className="border-t pt-3 space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Detalles adicionales
            </h4>
            {product.packagingType && (
              <DetailRow label="Tipo de envase" value={product.packagingType} />
            )}
            {product.saleFormat && (
              <DetailRow label="Formato de venta" value={product.saleFormat} />
            )}
            {product.priceType && (
              <DetailRow label="Tipo de precio" value={product.priceType} />
            )}
            {product.confidence !== undefined && (
              <DetailRow
                label="Confianza"
                value={`${Math.round(product.confidence * 100)}%`}
              />
            )}
            {product.reviewStatus && (
              <DetailRow
                label="Estado"
                value={
                  product.reviewStatus === "needs_review"
                    ? "Requiere revisión"
                    : "Publicado"
                }
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`text-sm ${valueClassName ?? "font-medium"}`}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  );
}

// ============================================================================
// Grid card component
// ============================================================================

function ProductCard({
  product,
  onClick,
}: {
  product: Product;
  onClick: () => void;
}) {
  return (
    <Card
      className="p-0 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
      onClick={onClick}
    >
      {/* Image */}
      {product.imageUrl ? (
        <div className="aspect-[4/3] bg-muted rounded-t-xl overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-[4/3] bg-muted rounded-t-xl flex items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
        <p className="text-xs text-muted-foreground">{product.brand}</p>
        <p className="text-sm font-bold text-primary">
          {formatPrice(product.price)}
        </p>
        {product.subcategory && (
          <Badge variant="outline" className="capitalize text-xs">
            {product.subcategory}
          </Badge>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// Main component: ProductsTable
// ============================================================================

export function ProductsTable({
  products,
  viewMode = "table",
  onViewModeChange,
}: {
  products: Product[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const columns = useMemo(() => createColumns(), []);

  const table = useReactTable({
    data: products,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: PAGE_SIZE,
      },
    },
  });

  function handleProductClick(product: Product) {
    setSelectedProduct(product);
    setModalOpen(true);
  }

  // Empty state
  if (products.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No hay productos disponibles</p>
      </Card>
    );
  }

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-4">
      {/* View toggle and results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} producto{products.length !== 1 ? "s" : ""} encontrado
          {products.length !== 1 ? "s" : ""}
        </p>
        {onViewModeChange && (
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => onViewModeChange("table")}
              aria-label="Vista tabla"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => onViewModeChange("grid")}
              aria-label="Vista grilla"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Table view */}
      {viewMode === "table" && (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => handleProductClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Grid/card view */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {table.getRowModel().rows.map((row) => (
            <ProductCard
              key={row.id}
              product={row.original}
              onClick={() => handleProductClick(row.original)}
            />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {pageIndex + 1} de {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>

            {/* Page number buttons */}
            {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
              // Show pages around current page
              let pageNum: number;
              if (pageCount <= 5) {
                pageNum = i;
              } else if (pageIndex < 2) {
                pageNum = i;
              } else if (pageIndex > pageCount - 3) {
                pageNum = pageCount - 5 + i;
              } else {
                pageNum = pageIndex - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === pageIndex ? "default" : "outline"}
                  size="icon-sm"
                  onClick={() => table.setPageIndex(pageNum)}
                  aria-label={`Página ${pageNum + 1}`}
                >
                  {pageNum + 1}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Página siguiente"
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Product detail modal */}
      <ProductDetailModal
        product={selectedProduct}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedProduct(null);
        }}
      />
    </div>
  );
}
