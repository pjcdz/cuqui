"use client";

import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";

export function ProductSearch({
  searchQuery,
  onSearchChange,
  filteredCount
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredCount: number;
}) {

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Búsqueda Semántica</h3>
        </div>

        <div className="relative">
          <Input
            type="text"
            placeholder="Buscar por nombre, marca, categoría o tags..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
          {searchQuery && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {filteredCount} resultados
            </div>
          )}
        </div>

        {searchQuery && (
          <div className="text-sm text-muted-foreground">
            Buscando: <span className="font-medium">{searchQuery}</span>
            {filteredCount > 0 && (
              <span className="ml-2">({filteredCount} productos encontrados)</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
