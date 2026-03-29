"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { getAutocompleteSuggestions } from "@/lib/format";

/** Debounce delay in ms for autocomplete suggestions (VAL-POLISH-009) */
const DEBOUNCE_MS = 300;

export function ProductSearch({
  searchQuery,
  onSearchChange,
  filteredCount,
  allProducts,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filteredCount: number;
  allProducts: Array<{ name: string; brand: string }>;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the search query for autocomplete (VAL-POLISH-009)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Generate autocomplete suggestions from debounced query
  const suggestions = useMemo(
    () => getAutocompleteSuggestions(allProducts, debouncedQuery, 5),
    [allProducts, debouncedQuery]
  );

  // Show suggestions when input is focused and has text
  const handleFocus = useCallback(() => {
    if (searchQuery.trim()) {
      setShowSuggestions(true);
    }
  }, [searchQuery]);

  // Hide suggestions when input loses focus (delayed for click to register)
  const handleBlur = useCallback(() => {
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
      if (e.target.value.trim()) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    },
    [onSearchChange]
  );

  // Handle suggestion click — fill input and trigger search (VAL-POLISH-009)
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      onSearchChange(suggestion);
      setShowSuggestions(false);
      inputRef.current?.blur();
    },
    [onSearchChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    []
  );

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-lg font-semibold">Búsqueda Semántica</h3>
        </div>

        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar por nombre, marca, categoría o tags..."
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full"
            aria-label="Buscar productos"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
            role="combobox"
          />
          {searchQuery && !showSuggestions && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {filteredCount} resultados
            </div>
          )}

          {/* Autocomplete dropdown (VAL-POLISH-009) */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              role="listbox"
              aria-label="Sugerencias de búsqueda"
              className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 overflow-hidden"
            >
              {suggestions.map((suggestion, idx) => (
                <button
                  key={`suggestion-${idx}`}
                  role="option"
                  aria-selected={false}
                  className="w-full text-left px-4 py-2.5 hover:bg-muted transition-colors text-sm flex items-center gap-2"
                  onClick={() => handleSuggestionClick(suggestion)}
                  aria-label={`Buscar: ${suggestion}`}
                >
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>{suggestion}</span>
                </button>
              ))}
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
