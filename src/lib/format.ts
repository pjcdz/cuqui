/**
 * Shared formatting utilities for the Cuqui B2B catalog.
 *
 * - formatPrice: ARS locale currency formatting (VAL-POLISH-011)
 * - highlightMatch: Search result text highlighting (VAL-POLISH-010)
 */

// ============================================================================
// Price formatting (VAL-POLISH-011)
// ============================================================================

/**
 * Format a number as Argentine Peso currency using es-AR locale.
 *
 * Examples:
 *   formatPrice(1200)       → "$1.200"
 *   formatPrice(1200.5)     → "$1.200,50"
 *   formatPrice(1200.99)    → "$1.200,99"
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

// ============================================================================
// Search result highlighting (VAL-POLISH-010)
// ============================================================================

/**
 * Split text into segments marking which parts match the search query.
 * Returns an array of { text, highlighted } objects for rendering.
 *
 * @param text - The full text to highlight within
 * @param query - The search query to match (case-insensitive)
 * @returns Array of segments with highlight flags
 */
export function getHighlightSegments(
  text: string,
  query: string
): Array<{ text: string; highlighted: boolean }> {
  if (!query.trim() || !text) {
    return [{ text, highlighted: false }];
  }

  const segments: Array<{ text: string; highlighted: boolean }> = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let lastIndex = 0;

  // Find all occurrences of the query in the text
  let searchIndex = 0;
  while (searchIndex < lowerText.length) {
    const matchIndex = lowerText.indexOf(lowerQuery, searchIndex);
    if (matchIndex === -1) break;

    // Add non-matching text before this match
    if (matchIndex > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, matchIndex),
        highlighted: false,
      });
    }

    // Add matching text (preserving original case)
    segments.push({
      text: text.slice(matchIndex, matchIndex + query.length),
      highlighted: true,
    });

    lastIndex = matchIndex + query.length;
    searchIndex = lastIndex;
  }

  // Add remaining non-matching text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      highlighted: false,
    });
  }

  // If no matches found, return the original text unhighlighted
  if (segments.length === 0) {
    return [{ text, highlighted: false }];
  }

  return segments;
}

/**
 * A React-compatible highlighted text renderer.
 * Returns an object with the text and segments for inline rendering.
 */
export interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
  highlightClassName?: string;
}

/**
 * Generate autocomplete suggestions from product data.
 * Returns up to `maxItems` unique suggestions matching the query.
 * Searches product names and brands.
 */
export function getAutocompleteSuggestions(
  products: Array<{ name: string; brand: string }>,
  query: string,
  maxItems: number = 5
): string[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const product of products) {
    if (suggestions.length >= maxItems) break;

    // Check name for match
    const nameLower = product.name.toLowerCase();
    const nameMatchIndex = nameLower.indexOf(lowerQuery);
    if (nameMatchIndex !== -1) {
      if (!seen.has(product.name)) {
        seen.add(product.name);
        suggestions.push(product.name);
      }
    }

    if (suggestions.length >= maxItems) break;

    // Check brand for match
    const brandLower = product.brand.toLowerCase();
    const brandMatchIndex = brandLower.indexOf(lowerQuery);
    if (brandMatchIndex !== -1) {
      if (!seen.has(product.brand)) {
        seen.add(product.brand);
        suggestions.push(product.brand);
      }
    }
  }

  return suggestions.slice(0, maxItems);
}
