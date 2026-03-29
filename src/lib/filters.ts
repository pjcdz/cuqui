/**
 * Pure filter logic for product filtering.
 * Separated from React components for testability.
 */

// ============================================================================
// Types
// ============================================================================

export type SortOption =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

export type PriceRange = { min: string; max: string };

export type FilterState = {
  priceRange: PriceRange;
  selectedProviders: string[];
  sort: SortOption;
  onlyWithImage: boolean;
};

export type TreeFilter = {
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  presentation: string | null;
};

export const EMPTY_FILTER_STATE: FilterState = {
  priceRange: { min: "", max: "" },
  selectedProviders: [],
  sort: "relevance",
  onlyWithImage: false,
};

export const EMPTY_TREE_FILTER: TreeFilter = {
  category: null,
  subcategory: null,
  brand: null,
  presentation: null,
};

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevancia" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "name_asc", label: "Nombre: A-Z" },
  { value: "name_desc", label: "Nombre: Z-A" },
];

// ============================================================================
// Price range validation (VAL-DISPLAY-006)
// ============================================================================

/**
 * Validate a price range, ensuring min and max are valid numbers and min <= max.
 * @param range - Object with min and max string values
 * @returns Object with valid flag and optional error message
 */
export function validatePriceRange(range: PriceRange): {
  valid: boolean;
  error?: string;
} {
  const minVal = range.min.trim();
  const maxVal = range.max.trim();
  if (minVal && isNaN(parseFloat(minVal))) {
    return { valid: false, error: "El precio mínimo debe ser un número" };
  }
  if (maxVal && isNaN(parseFloat(maxVal))) {
    return { valid: false, error: "El precio máximo debe ser un número" };
  }
  if (minVal && maxVal) {
    const mn = parseFloat(minVal);
    const mx = parseFloat(maxVal);
    if (mn > mx) {
      return {
        valid: false,
        error: "El precio mínimo no puede ser mayor que el máximo",
      };
    }
  }
  return { valid: true };
}

// ============================================================================
// Product filtering (VAL-DISPLAY-010, combined AND logic)
// ============================================================================

export type FilterableProduct = {
  name: string;
  brand: string;
  presentation: string;
  price: number;
  category: string;
  subcategory?: string;
  tags: string[];
  providerId: string;
  imageUrl?: string;
};

/**
 * Apply all filters (tree, price, provider, image, search) and sorting to a product list.
 * @param products - Array of filterable products
 * @param treeFilter - Category/subcategory/brand/presentation tree filter
 * @param filters - Price range, provider, sort, and image filter state
 * @param searchQuery - Text search query
 * @returns Filtered and sorted product array
 */
export function applyAllFilters<T extends FilterableProduct>(
  products: T[],
  treeFilter: TreeFilter,
  filters: FilterState,
  searchQuery: string
): T[] {
  // Filter
  const filtered = products.filter((product) => {
    // Tree filter AND logic (RF-012)
    if (
      treeFilter.category !== null &&
      product.category !== treeFilter.category
    )
      return false;
    if (
      treeFilter.subcategory !== null &&
      product.subcategory !== treeFilter.subcategory
    )
      return false;
    if (treeFilter.brand !== null && product.brand !== treeFilter.brand)
      return false;
    if (
      treeFilter.presentation !== null &&
      product.presentation !== treeFilter.presentation
    )
      return false;

    // Price range filter
    if (filters.priceRange.min.trim()) {
      const min = parseFloat(filters.priceRange.min);
      if (!isNaN(min) && product.price < min) return false;
    }
    if (filters.priceRange.max.trim()) {
      const max = parseFloat(filters.priceRange.max);
      if (!isNaN(max) && product.price > max) return false;
    }

    // Provider filter
    if (
      filters.selectedProviders.length > 0 &&
      !filters.selectedProviders.includes(product.providerId)
    )
      return false;

    // Only with image
    if (filters.onlyWithImage && !product.imageUrl) return false;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        product.name.toLowerCase().includes(q) ||
        product.brand.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q) ||
        (product.subcategory &&
          product.subcategory.toLowerCase().includes(q)) ||
        product.tags.some((tag) => tag.toLowerCase().includes(q));
      if (!matches) return false;
    }

    return true;
  });

  // Sort
  return sortProducts(filtered, filters.sort);
}

/**
 * Sort products by the specified sort option (price, name, or relevance).
 * @param products - Array of products with name and price fields
 * @param sort - Sort option to apply
 * @returns New sorted array
 */
export function sortProducts<T extends { name: string; price: number }>(
  products: T[],
  sort: SortOption
): T[] {
  const sorted = [...products];
  switch (sort) {
    case "price_asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "name_asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name_desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    default:
      break;
  }
  return sorted;
}

// ============================================================================
// URL query param serialization (for shareability)
// ============================================================================

/**
 * Parse filter state from URL query parameters for shareable filter URLs.
 * @param params - URL search params to parse
 * @returns Object with treeFilter, filters, and searchQuery
 */
export function parseFiltersFromParams(params: URLSearchParams): {
  treeFilter: TreeFilter;
  filters: FilterState;
  searchQuery: string;
} {
  const treeFilter: TreeFilter = {
    category: params.get("category") || null,
    subcategory: params.get("subcategory") || null,
    brand: params.get("brand") || null,
    presentation: params.get("presentation") || null,
  };

  const filters: FilterState = {
    priceRange: {
      min: params.get("priceMin") || "",
      max: params.get("priceMax") || "",
    },
    selectedProviders: params.get("providers")
      ? params.get("providers")!.split(",").filter(Boolean)
      : [],
    sort: (params.get("sort") as SortOption) || "relevance",
    onlyWithImage: params.get("onlyWithImage") === "true",
  };

  const searchQuery = params.get("q") || "";

  return { treeFilter, filters, searchQuery };
}

/**
 * Serialize filter state to URL query parameters for shareable URLs.
 * @param treeFilter - Category/subcategory/brand/presentation tree filter
 * @param filters - Price range, provider, sort, and image filter state
 * @param searchQuery - Text search query
 * @returns URLSearchParams with non-empty filter values
 */
export function serializeFiltersToParams(
  treeFilter: TreeFilter,
  filters: FilterState,
  searchQuery: string
): URLSearchParams {
  const params = new URLSearchParams();

  if (searchQuery) params.set("q", searchQuery);
  if (treeFilter.category) params.set("category", treeFilter.category);
  if (treeFilter.subcategory)
    params.set("subcategory", treeFilter.subcategory);
  if (treeFilter.brand) params.set("brand", treeFilter.brand);
  if (treeFilter.presentation)
    params.set("presentation", treeFilter.presentation);
  if (filters.priceRange.min) params.set("priceMin", filters.priceRange.min);
  if (filters.priceRange.max) params.set("priceMax", filters.priceRange.max);
  if (filters.selectedProviders.length > 0)
    params.set("providers", filters.selectedProviders.join(","));
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.onlyWithImage) params.set("onlyWithImage", "true");

  return params;
}

/**
 * Check whether any filter is currently active (non-default).
 * @param treeFilter - Tree filter state
 * @param filters - Filter state
 * @param searchQuery - Text search query
 * @returns True if any filter differs from its default value
 */
export function hasAnyActiveFilter(
  treeFilter: TreeFilter,
  filters: FilterState,
  searchQuery: string
): boolean {
  return (
    treeFilter.category !== null ||
    treeFilter.subcategory !== null ||
    treeFilter.brand !== null ||
    treeFilter.presentation !== null ||
    searchQuery.trim() !== "" ||
    filters.priceRange.min.trim() !== "" ||
    filters.priceRange.max.trim() !== "" ||
    filters.selectedProviders.length > 0 ||
    filters.sort !== "relevance" ||
    filters.onlyWithImage
  );
}
