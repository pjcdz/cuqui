"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

export function TreeNavigation({
  allProducts,
  selectedTags,
  onTagsChange,
  filteredCount
}: {
  allProducts: any[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  filteredCount: number;
}) {

  // Extraer tags únicos y agruparlos
  const tagGroups = allProducts?.reduce((acc: Record<string, { tag: string; count: number; category: string }>, product: any) => {
    product.tags.forEach((tag: string) => {
      if (!acc[tag]) {
        acc[tag] = {
          tag,
          count: 0,
          category: categorizeTag(tag),
        };
      }
      acc[tag].count++;
    });
    return acc;
  }, {} as Record<string, { tag: string; count: number; category: string }>) || {};

  // Agrupar tags por categoría
  const groupedTags = Object.values(tagGroups).reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, Array<{ tag: string; count: number }>>);

  // Categorizar tags para agrupación
  function categorizeTag(tag: string): string {
    const t = tag.toLowerCase();

    // Categorías principales
    if (["aceites", "lacteos", "limpieza", "condimentos", "bebidas"].includes(t)) {
      return "Categorías";
    }

    // Subcategorías
    if (["girasol", "oliva", "maiz", "refinado", "virgen"].includes(t)) {
      return "Subcategorías";
    }

    // Tipos de contenedor
    if (["bidon", "botella", "caja", "unidad", "pack"].includes(t)) {
      return "Envases";
    }

    // Marcas conocidas
    if (["cañuelas", "natura", "la toscana", "abedul", "jumbalay"].includes(t)) {
      return "Marcas";
    }

    return "Otros";
  }

  // Agregar tag a la selección (AND logic)
  function addTag(tag: string) {
    if (!selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag]);
    }
  }

  // Remover tag de la selección
  function removeTag(tag: string) {
    onTagsChange(selectedTags.filter(t => t !== tag));
  }

  // Limpiar todos los filtros
  function clearFilters() {
    onTagsChange([]);
  }


  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Navegación de Árbol</h3>
          </div>
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Tags seleccionados */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
            {selectedTags.map(tag => (
              <button
                key={tag}
                onClick={() => removeTag(tag)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {tag}
                <X className="h-3 w-3" />
              </button>
            ))}
            <div className="text-sm text-muted-foreground flex items-center ml-2">
              {filteredCount} productos
            </div>
          </div>
        )}

        {/* Árbol de tags agrupados */}
        <div className="space-y-4">
          {Object.entries(groupedTags)
            .filter(([_, tags]) => tags.length > 0)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, tags]: [string, Array<{ tag: string; count: number }>]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {category}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {tags
                    .sort((a, b) => b.count - a.count)
                    .map(({ tag, count }) => (
                      <Button
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        size="sm"
                        onClick={() => addTag(tag)}
                        className="text-xs"
                      >
                        {tag}
                        <span className="ml-1 text-muted-foreground">
                          ({count})
                        </span>
                      </Button>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </Card>
  );
}
