/**
 * Tree structure builder for product hierarchy.
 * Builds a category→subcategory→brand→presentation tree from product data.
 * Separated from route handler for testability.
 */

/** A flat product record with the fields needed for tree building. */
export type TreeProduct = {
  category: string;
  subcategory?: string;
  brand: string;
  presentation: string;
  active?: boolean;
};

/** A single option in the tree response. */
export type TreeOption = {
  name: string;
  productCount: number;
};

/** The tree structure response. */
export type TreeStructureResponse = {
  nextLevel: string;
  options: TreeOption[];
  levels: string[];
};

/** The four navigation levels in order. */
export const TREE_LEVELS = [
  "category",
  "subcategory",
  "brand",
  "presentation",
] as const;

/**
 * Build tree structure from a list of products.
 * Groups products by the first unselected level and returns options with counts.
 * @param products - List of products to build tree from (should be active-only)
 * @returns Tree structure response
 */
export function buildTreeStructure(
  products: TreeProduct[]
): TreeStructureResponse {
  // Filter active products only
  const activeProducts = products.filter((p) => p.active !== false);

  // Build category-level options (root level)
  const categoryCounts = new Map<string, number>();
  for (const product of activeProducts) {
    const key = product.category || "Sin categoría";
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }

  // Sort options alphabetically
  const options: TreeOption[] = Array.from(categoryCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, productCount]) => ({ name, productCount }));

  return {
    nextLevel: "category",
    options,
    levels: [...TREE_LEVELS],
  };
}

/**
 * Compute an ETag from response data.
 * Uses a simple hash of the JSON string for deterministic ETags.
 * @param data - The response data to hash
 * @returns ETag string (quoted as per HTTP spec)
 */
export function computeETag(data: unknown): string {
  const json = JSON.stringify(data);
  // Simple hash function (djb2, unsigned)
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash + json.charCodeAt(i)) >>> 0;
  }
  return `"${hash.toString(16)}"`;
}
