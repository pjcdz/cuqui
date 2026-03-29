"use client";

import { useState, useMemo, useCallback } from "react";
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pencil,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

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
// Zod validation schema for inline product editing (VAL-CATALOG-003)
// ============================================================================

export const ProductEditSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  brand: z.string().min(1, "La marca es obligatoria"),
  presentation: z.string().min(1, "La presentación es obligatoria"),
  price: z.number({ error: "El precio debe ser un número" }).positive("El precio debe ser mayor a 0"),
  category: z.string().min(1, "La categoría es obligatoria"),
});

export type ProductEdit = z.infer<typeof ProductEditSchema>;

// Editable field keys
type EditableField = "name" | "brand" | "presentation" | "price" | "category";

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
// Inline editable cell component (VAL-CATALOG-002, VAL-CATALOG-003)
// ============================================================================

function InlineEditableCell({
  value,
  field,
  productId,
  onSave,
  valueType = "text",
}: {
  value: string | number;
  field: EditableField;
  productId: string;
  onSave: (productId: string, field: EditableField, value: string | number) => string | true;
  valueType?: "text" | "number";
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(String(value));
    setValidationError(null);
    setIsEditing(true);
  };

  const handleSave = () => {
    const parsedValue = valueType === "number" ? parseFloat(editValue) : editValue;

    // Validate using Zod schema
    const fieldSchema = ProductEditSchema.shape[field as keyof typeof ProductEditSchema.shape];
    const result = fieldSchema.safeParse(parsedValue);

    if (!result.success) {
      setValidationError(result.error.issues[0]?.message ?? "Valor inválido");
      return;
    }

    const saveResult = onSave(productId, field, parsedValue);
    if (saveResult !== true) {
      setValidationError(saveResult);
      return;
    }

    setValidationError(null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValidationError(null);
    setEditValue(String(value));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
    e.stopPropagation();
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <Input
            type={valueType}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setValidationError(null);
            }}
            onKeyDown={handleKeyDown}
            className="h-7 text-sm min-w-[80px]"
            autoFocus
            step={valueType === "number" ? "0.01" : undefined}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSave}
            className="h-6 w-6 shrink-0"
            aria-label="Guardar"
          >
            <Check className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCancel}
            className="h-6 w-6 shrink-0"
            aria-label="Cancelar"
          >
            <X className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
        {validationError && (
          <p className="text-xs text-red-500 font-medium">{validationError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span>{valueType === "number" ? formatPrice(value as number) : String(value)}</span>
      <button
        onClick={handleStartEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        aria-label={`Editar ${field}`}
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
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
// Delete confirmation dialog (VAL-CATALOG-009)
// ============================================================================

function DeleteConfirmDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Estás seguro?</DialogTitle>
          <DialogDescription>
            Esta acción es permanente. Se eliminará el producto
            {product ? (
              <strong> {product.name}</strong>
            ) : (
              ""
            )}{" "}
            y no se podrá recuperar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Column definitions
// ============================================================================

function createColumns(
  providerMode: boolean,
  onSave: (productId: string, field: EditableField, value: string | number) => string | true,
  onDelete: (product: Product) => void,
): ColumnDef<Product>[] {
  const columns: ColumnDef<Product>[] = [
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
  ];

  if (providerMode) {
    // Editable columns in provider mode (VAL-CATALOG-002)
    columns.push(
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortHeader column={column}>Producto</SortHeader>
        ),
        cell: ({ row }) => (
          <InlineEditableCell
            value={row.original.name}
            field="name"
            productId={row.original._id}
            onSave={onSave}
          />
        ),
      },
      {
        accessorKey: "category",
        header: ({ column }) => (
          <SortHeader column={column}>Categoría</SortHeader>
        ),
        cell: ({ row }) => (
          <InlineEditableCell
            value={row.original.category}
            field="category"
            productId={row.original._id}
            onSave={onSave}
          />
        ),
      },
      {
        accessorKey: "brand",
        header: ({ column }) => (
          <SortHeader column={column}>Marca</SortHeader>
        ),
        cell: ({ row }) => (
          <InlineEditableCell
            value={row.original.brand}
            field="brand"
            productId={row.original._id}
            onSave={onSave}
          />
        ),
      },
      {
        accessorKey: "presentation",
        header: ({ column }) => (
          <SortHeader column={column}>Presentación</SortHeader>
        ),
        cell: ({ row }) => (
          <InlineEditableCell
            value={row.original.presentation}
            field="presentation"
            productId={row.original._id}
            onSave={onSave}
          />
        ),
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <SortHeader column={column}>Precio</SortHeader>
        ),
        cell: ({ row }) => (
          <InlineEditableCell
            value={row.original.price}
            field="price"
            productId={row.original._id}
            onSave={onSave}
            valueType="number"
          />
        ),
      },
      {
        id: "reviewStatus",
        header: "Estado",
        cell: ({ row }) => {
          const status = row.original.reviewStatus;
          if (status === "needs_review") {
            return <Badge variant="outline" className="text-amber-600 border-amber-300">Requiere revisión</Badge>;
          }
          return <Badge variant="secondary" className="text-green-600">Publicado</Badge>;
        },
        enableSorting: false,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Acciones</span>,
        size: 60,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(row.original);
            }}
            aria-label={`Eliminar ${row.original.name}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
        enableSorting: false,
      },
    );
  } else {
    // Read-only columns for comercio view
    columns.push(
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
    );
  }

  return columns;
}

// ============================================================================
// Main component: ProductsTable
// ============================================================================

export function ProductsTable({
  products,
  viewMode = "table",
  onViewModeChange,
  providerMode = false,
}: {
  products: Product[];
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  providerMode?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const updateProduct = useMutation(api.products.updateProduct);
  const removeProduct = useMutation(api.products.remove);

  // Inline edit save handler with Zod validation (VAL-CATALOG-003)
  const handleInlineSave = useCallback(
    (productId: string, field: EditableField, value: string | number): string | true => {
      // Full Zod validation of the edit
      const product = products.find((p) => p._id === productId);
      if (!product) return "Producto no encontrado";

      const updateData: Partial<ProductEdit> = {
        name: product.name,
        brand: product.brand,
        presentation: product.presentation,
        price: product.price,
        category: product.category,
        [field]: value,
      };

      const result = ProductEditSchema.safeParse(updateData);
      if (!result.success) {
        return result.error.issues[0]?.message ?? "Valor inválido";
      }

      // Persist the single field update
      updateProduct({
        id: productId as Id<"products">,
        [field]: value,
      }).then(() => {
        toast.success("Producto actualizado");
      }).catch(() => {
        toast.error("Error al actualizar el producto");
      });

      return true;
    },
    [products, updateProduct],
  );

  // Delete handler (VAL-CATALOG-009)
  const handleDeleteClick = useCallback((product: Product) => {
    setDeleteTarget(product);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    removeProduct({ id: deleteTarget._id as Id<"products"> })
      .then(() => {
        toast.success(`Producto "${deleteTarget.name}" eliminado`);
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      })
      .catch(() => {
        toast.error("Error al eliminar el producto");
      });
  }, [deleteTarget, removeProduct]);

  const columns = useMemo(
    () => createColumns(providerMode, handleInlineSave, handleDeleteClick),
    [providerMode, handleInlineSave, handleDeleteClick],
  );

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
    // In provider mode, don't open detail modal on click (to avoid conflict with inline editing)
    if (providerMode) return;
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
                  className={providerMode ? "" : "cursor-pointer"}
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

      {/* Product detail modal (comercio view only) */}
      {!providerMode && (
        <ProductDetailModal
          product={selectedProduct}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setSelectedProduct(null);
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        product={deleteTarget}
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
