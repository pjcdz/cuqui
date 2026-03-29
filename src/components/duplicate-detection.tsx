"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import {
  AlertTriangle,
  GitMerge,
  EyeOff,
  RefreshCw,
  ArrowLeftRight,
  Check,
} from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

type DuplicatePair = {
  _id: Id<"duplicatePairs">;
  providerId: string;
  productA: Id<"products">;
  productB: Id<"products">;
  nameDistance: number;
  similarity: number;
  status: string;
  detectedAt: number;
  productAData: Doc<"products">;
  productBData: Doc<"products">;
};

// Field choice for merge dialog — matches the Convex mutation arg type
type FieldChoice = {
  name: "a" | "b";
  brand: "a" | "b";
  presentation: "a" | "b";
  price: "a" | "b";
  category: "a" | "b";
};

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
// Merge dialog — lets user choose which fields to keep (VAL-CATALOG-013)
// ============================================================================

function MergeDialog({
  pair,
  open,
  onOpenChange,
  onMerge,
  loading,
}: {
  pair: DuplicatePair | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerge: (pairId: Id<"duplicatePairs">, choices: FieldChoice) => Promise<void>;
  loading: boolean;
}) {
  const [choices, setChoices] = useState<FieldChoice>({
    name: "a",
    brand: "a",
    presentation: "a",
    price: "a",
    category: "a",
  });

  const resetChoices = useCallback(() => {
    setChoices({
      name: "a",
      brand: "a",
      presentation: "a",
      price: "a",
      category: "a",
    });
  }, []);

  if (!pair) return null;

  const fields = ["name", "brand", "presentation", "price", "category"] as const;

  const fieldLabels: Record<string, string> = {
    name: "Nombre",
    brand: "Marca",
    presentation: "Presentación",
    price: "Precio",
    category: "Categoría",
  };

  const handleChoice = (field: string, source: "a" | "b") => {
    setChoices((prev) => ({ ...prev, [field]: source }));
  };

  const handleMerge = async () => {
    // Default to product A for any unchosen fields
    const finalChoices = {} as FieldChoice;
    for (const field of fields) {
      finalChoices[field] = choices[field] ?? "a";
    }
    await onMerge(pair._id, finalChoices);
    resetChoices();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetChoices();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Fusionar productos duplicados
          </DialogTitle>
          <DialogDescription>
            Seleccioná de qué producto mantener cada campo. El producto B será eliminado después de la fusión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm font-medium">
            <div className="text-center p-2 bg-primary/5 rounded-lg">
              Producto A
            </div>
            <div className="text-muted-foreground text-xs">Elegir</div>
            <div className="text-center p-2 bg-primary/5 rounded-lg">
              Producto B
            </div>
          </div>

          {/* Field rows */}
          {fields.map((field) => {
            const valA = field === "price"
              ? formatPrice(pair.productAData[field] as number)
              : String(pair.productAData[field] ?? "");
            const valB = field === "price"
              ? formatPrice(pair.productBData[field] as number)
              : String(pair.productBData[field] ?? "");
            const choice = choices[field];
            const isDifferent = valA !== valB;

            return (
              <div
                key={field}
                className={`grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm ${isDifferent ? "" : "opacity-50"}`}
              >
                {/* Product A value */}
                <div
                  className={`p-2 rounded-lg border text-center cursor-pointer transition-all ${
                    (choice ?? "a") === "a"
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border bg-muted/30"
                  }`}
                  onClick={() => handleChoice(field, "a")}
                >
                  <div className="text-xs text-muted-foreground mb-0.5">
                    {fieldLabels[field]}
                  </div>
                  <div className="font-medium truncate">{valA}</div>
                  {(choice ?? "a") === "a" && (
                    <Check className="h-3.5 w-3.5 text-primary mx-auto mt-1" />
                  )}
                </div>

                {/* Label */}
                <div className="text-xs text-muted-foreground px-1">
                  {fieldLabels[field]}
                </div>

                {/* Product B value */}
                <div
                  className={`p-2 rounded-lg border text-center cursor-pointer transition-all ${
                    choice === "b"
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border bg-muted/30"
                  }`}
                  onClick={() => handleChoice(field, "b")}
                >
                  <div className="text-xs text-muted-foreground mb-0.5">
                    {fieldLabels[field]}
                  </div>
                  <div className="font-medium truncate">{valB}</div>
                  {choice === "b" && (
                    <Check className="h-3.5 w-3.5 text-primary mx-auto mt-1" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="text-xs text-muted-foreground border-t pt-3">
            Hacé clic en el valor de cada campo para elegir cuál mantener.
            Los campos iguales se fusionan automáticamente.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleMerge} disabled={loading} className="gap-2">
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <GitMerge className="h-4 w-4" />
            )}
            {loading ? "Fusionando..." : "Fusionar productos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Side-by-side comparison card for a duplicate pair
// ============================================================================

function DuplicatePairCard({
  pair,
  onMerge,
  onIgnore,
  loading,
}: {
  pair: DuplicatePair;
  onMerge: (pair: DuplicatePair) => void;
  onIgnore: (pairId: Id<"duplicatePairs">) => void;
  loading: boolean;
}) {
  const pctSimilar = Math.round(pair.similarity * 100);

  return (
    <Card className="p-4 space-y-3">
      {/* Similarity header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Posible duplicado</span>
        </div>
        <Badge
          variant="outline"
          className={`${
            pctSimilar >= 90
              ? "text-red-600 border-red-300"
              : pctSimilar >= 70
                ? "text-amber-600 border-amber-300"
                : "text-yellow-600 border-yellow-300"
          }`}
        >
          {pctSimilar}% similar
        </Badge>
      </div>

      {/* Side-by-side product comparison */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
        {/* Product A */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
          <p className="font-medium text-sm line-clamp-2">
            {pair.productAData.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {pair.productAData.brand}
          </p>
          <p className="text-xs text-muted-foreground">
            {pair.productAData.presentation}
          </p>
          <p className="text-sm font-bold text-primary">
            {formatPrice(pair.productAData.price)}
          </p>
        </div>

        {/* VS divider */}
        <div className="flex items-center justify-center py-4">
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Product B */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-1.5">
          <p className="font-medium text-sm line-clamp-2">
            {pair.productBData.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {pair.productBData.brand}
          </p>
          <p className="text-xs text-muted-foreground">
            {pair.productBData.presentation}
          </p>
          <p className="text-sm font-bold text-primary">
            {formatPrice(pair.productBData.price)}
          </p>
        </div>
      </div>

      {/* Action buttons (VAL-CATALOG-013, VAL-CATALOG-014) */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="default"
          size="sm"
          onClick={() => onMerge(pair)}
          disabled={loading}
          className="flex-1 gap-2"
        >
          <GitMerge className="h-4 w-4" />
          Fusionar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onIgnore(pair._id)}
          disabled={loading}
          className="flex-1 gap-2"
        >
          <EyeOff className="h-4 w-4" />
          Son diferentes, ignorar
        </Button>
      </div>
    </Card>
  );
}

// ============================================================================
// Main component: DuplicateDetection
// ============================================================================

export function DuplicateDetection() {
  const pendingPairs = useQuery(api.duplicates.listPending) as
    | DuplicatePair[]
    | undefined;
  const detectDuplicates = useMutation(api.duplicates.detectDuplicates);
  const mergeMutation = useMutation(api.duplicates.mergeDuplicates);
  const ignoreMutation = useMutation(api.duplicates.ignoreDuplicatePair);

  const [detecting, setDetecting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<DuplicatePair | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  // Run duplicate detection
  const handleDetect = async () => {
    setDetecting(true);
    try {
      const result = await detectDuplicates({});
      toast.success(
        result.newPairs > 0
          ? `Se encontraron ${result.newPairs} posibles duplicados`
          : "No se encontraron duplicados nuevos"
      );
    } catch {
      toast.error("Error al detectar duplicados");
    } finally {
      setDetecting(false);
    }
  };

  // Open merge dialog for a specific pair
  const handleMergeClick = useCallback((pair: DuplicatePair) => {
    setMergeTarget(pair);
    setMergeDialogOpen(true);
  }, []);

  // Execute merge
  const handleMerge = useCallback(
    async (pairId: Id<"duplicatePairs">, choices: FieldChoice) => {
      setMerging(true);
      try {
        await mergeMutation({ pairId, fieldChoices: choices as unknown as { name: string; brand: string; presentation: string; price: string; category: string } });
        toast.success("Productos fusionados correctamente");
        setMergeDialogOpen(false);
        setMergeTarget(null);
      } catch {
        toast.error("Error al fusionar productos");
      } finally {
        setMerging(false);
      }
    },
    [mergeMutation]
  );

  // Ignore a duplicate pair (VAL-CATALOG-014)
  const handleIgnore = useCallback(
    async (pairId: Id<"duplicatePairs">) => {
      try {
        await ignoreMutation({ pairId });
        toast.success("Par marcado como diferente");
      } catch {
        toast.error("Error al ignorar duplicado");
      }
    },
    [ignoreMutation]
  );

  const pendingCount = pendingPairs?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header with badge and detect button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Detección de duplicados</h2>
          {pendingCount > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              {pendingCount} posible{pendingCount !== 1 ? "s" : ""} duplicado
              {pendingCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDetect}
          disabled={detecting}
          className="gap-2"
        >
          {detecting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {detecting ? "Detectando..." : "Detectar duplicados"}
        </Button>
      </div>

      {/* Pending pairs list */}
      {pendingPairs === undefined ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Cargando duplicados...</p>
        </Card>
      ) : pendingCount === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            No se detectaron duplicados. Hacé clic en &quot;Detectar duplicados&quot;
            para buscar productos similares.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingPairs.map((pair) => (
            <DuplicatePairCard
              key={pair._id}
              pair={pair}
              onMerge={handleMergeClick}
              onIgnore={handleIgnore}
              loading={merging}
            />
          ))}
        </div>
      )}

      {/* Merge dialog */}
      <MergeDialog
        pair={mergeTarget}
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        onMerge={handleMerge}
        loading={merging}
      />
    </div>
  );
}
