/**
 * Levenshtein distance utility for duplicate detection (RF-018).
 *
 * Computes the minimum number of single-character edits (insertions, deletions,
 * substitutions) required to change one string into another.
 */

/**
 * Compute the Levenshtein distance between two strings.
 * Uses an optimized single-row dynamic programming approach (O(n·m) time, O(min(n,m)) space).
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure `a` is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;

  // Single-row DP: previous row of distances
  const row = Array.from({ length: aLen + 1 }, (_, i) => i);

  for (let j = 1; j <= bLen; j++) {
    let prevDiagonal = row[0];
    row[0] = j;

    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const temp = row[i];
      row[i] = Math.min(
        row[i] + 1,           // deletion
        row[i - 1] + 1,       // insertion
        prevDiagonal + cost    // substitution
      );
      prevDiagonal = temp;
    }
  }

  return row[aLen];
}

/**
 * Compute a normalized similarity score between 0 and 1.
 * 1 = identical strings, 0 = completely different.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Check if two product names are potential duplicates based on Levenshtein distance.
 *
 * Per RF-018, the similarity function also considers brand and presentation:
 *   similarity = levenshtein(name1, name2) + brand_penalty + presentation_penalty
 *
 * Products are considered potential duplicates when their combined similarity score
 * is below a configurable threshold.
 */
export function isPotentialDuplicate(
  name1: string,
  name2: string,
  brand1: string,
  brand2: string,
  presentation1: string,
  presentation2: string,
  options: { nameThreshold?: number; brandPenalty?: number; presentationPenalty?: number; combinedThreshold?: number } = {}
): boolean {
  const {
    nameThreshold = 3,
    brandPenalty = 50,
    presentationPenalty = 20,
    combinedThreshold = 30,
  } = options;

  const nameDistance = levenshteinDistance(
    name1.toLowerCase().trim(),
    name2.toLowerCase().trim()
  );

  // If names are very close (within threshold), check brand and presentation
  const brandMatch = brand1.toLowerCase().trim() === brand2.toLowerCase().trim();
  const presMatch = presentation1.toLowerCase().trim() === presentation2.toLowerCase().trim();

  const combinedScore =
    nameDistance +
    (brandMatch ? 0 : brandPenalty) +
    (presMatch ? 0 : presentationPenalty);

  // Products are duplicates if:
  // 1. Names are very similar (within nameThreshold), OR
  // 2. The combined score is below the threshold (same brand + similar names)
  return nameDistance <= nameThreshold || combinedScore < combinedThreshold;
}

/**
 * Find all potential duplicate pairs within a list of products.
 * Compares only products from the same provider (already filtered by caller).
 * Returns pairs sorted by similarity (most similar first).
 */
export function findDuplicatePairs(
  products: {
    _id: string;
    name: string;
    brand: string;
    presentation: string;
  }[]
): { productA: string; productB: string; nameDistance: number; similarity: number }[] {
  const pairs: { productA: string; productB: string; nameDistance: number; similarity: number }[] = [];

  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i];
      const b = products[j];

      const nameDistance = levenshteinDistance(
        a.name.toLowerCase().trim(),
        b.name.toLowerCase().trim()
      );

      // Only flag as potential duplicate if names are similar enough
      // (same brand, similar presentation, small name distance)
      const brandMatch = a.brand.toLowerCase().trim() === b.brand.toLowerCase().trim();
      const presMatch = a.presentation.toLowerCase().trim() === b.presentation.toLowerCase().trim();

      // Score: name distance + penalties for different brand/presentation
      const score = nameDistance + (brandMatch ? 0 : 50) + (presMatch ? 0 : 20);

      // Flag if combined score suggests duplicates
      if (score < 30 || nameDistance <= 3) {
        const similarity = levenshteinSimilarity(
          a.name.toLowerCase().trim(),
          b.name.toLowerCase().trim()
        );
        pairs.push({
          productA: a._id,
          productB: b._id,
          nameDistance,
          similarity,
        });
      }
    }
  }

  // Sort by similarity descending (most similar first)
  pairs.sort((a, b) => b.similarity - a.similarity);

  return pairs;
}
