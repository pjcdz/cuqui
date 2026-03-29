"use client";

import { useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Building2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  X,
  SlidersHorizontal,
} from "lucide-react";
import {
  validatePriceRange,
  EMPTY_FILTER_STATE,
  SORT_OPTIONS,
  type FilterState,
  type PriceRange,
  type SortOption,
} from "@/lib/filters";

// Re-export types and constants for convenience
export type { FilterState, PriceRange, SortOption };
export { EMPTY_FILTER_STATE, SORT_OPTIONS, validatePriceRange };

export function ProductFilters({
  filters,
  onFiltersChange,
  allProducts,
  providerNames,
  onClearAll,
}: {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  allProducts: { providerId: string }[];
  providerNames: Map<string, string>;
  onClearAll: () => void;
}) {
  const providerList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of allProducts) {
      counts.set(p.providerId, (counts.get(p.providerId) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  }, [allProducts]);

  const updatePrice = useCallback(
    (field: "min" | "max", value: string) => {
      onFiltersChange({
        ...filters,
        priceRange: { ...filters.priceRange, [field]: value },
      });
    },
    [filters, onFiltersChange]
  );

  const setSort = useCallback(
    (sort: SortOption) => {
      onFiltersChange({ ...filters, sort });
    },
    [filters, onFiltersChange]
  );

  const toggleProvider = useCallback(
    (providerId: string) => {
      const selected = filters.selectedProviders;
      const isSelected = selected.includes(providerId);
      onFiltersChange({
        ...filters,
        selectedProviders: isSelected
          ? selected.filter((id: string) => id !== providerId)
          : [...selected, providerId],
      });
    },
    [filters, onFiltersChange]
  );

  const toggleOnlyWithImage = useCallback(() => {
    onFiltersChange({ ...filters, onlyWithImage: !filters.onlyWithImage });
  }, [filters, onFiltersChange]);

  const priceValidation = validatePriceRange(filters.priceRange);

  const hasActiveFilters =
    filters.priceRange.min.trim() !== "" ||
    filters.priceRange.max.trim() !== "" ||
    filters.selectedProviders.length > 0 ||
    filters.sort !== "relevance" ||
    filters.onlyWithImage;

  function getProviderDisplayName(providerId: string): string {
    const name = providerNames.get(providerId);
    if (name) return name;
    return providerId.split("|").pop() || providerId;
  }

  return (
    <Card className="p-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Filtros</h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Price range */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Rango de precio
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Mínimo"
              value={filters.priceRange.min}
              onChange={(e) => updatePrice("min", e.target.value)}
              className="w-24"
              aria-label="Precio mínimo"
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Máximo"
              value={filters.priceRange.max}
              onChange={(e) => updatePrice("max", e.target.value)}
              className="w-24"
              aria-label="Precio máximo"
            />
          </div>
          {!priceValidation.valid && (
            <p className="text-xs text-destructive">{priceValidation.error}</p>
          )}
        </div>

        {/* Sort controls */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Ordenar por
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SORT_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={filters.sort === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSort(opt.value)}
                className="text-xs"
              >
                {opt.value === "price_asc" && (
                  <ArrowUp className="h-3 w-3 mr-1" />
                )}
                {opt.value === "price_desc" && (
                  <ArrowDown className="h-3 w-3 mr-1" />
                )}
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Provider checkboxes */}
        {providerList.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Proveedor
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {providerList.map((item: { id: string; count: number }) => {
                const displayName = getProviderDisplayName(item.id);
                const isChecked = filters.selectedProviders.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleProvider(item.id)}
                      className="rounded border-muted-foreground"
                    />
                    <span className="truncate flex-1">{displayName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {item.count}
                    </Badge>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Only with image toggle */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.onlyWithImage}
              onChange={toggleOnlyWithImage}
              className="rounded border-muted-foreground"
            />
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Solo con imagen</span>
          </label>
        </div>
      </div>
    </Card>
  );
}
