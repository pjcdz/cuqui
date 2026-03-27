/**
 * Chunking Strategy for Stage 2 Processing (Unit 2 of 8)
 *
 * This module implements the chunking logic that divides documents into manageable
 * chunks for Stage 2 processing in the hybrid two-stage ingestion pipeline.
 *
 * Chunk size rationale: ~5 pages balances context vs focus, fits within token limits,
 * enables parallelization, isolates errors, provides progress reporting.
 */

import type { DocumentMetadata, PageMetadata } from "./schemas";

// Constants for item estimation
const AVG_ITEMS_PER_TABLE_PAGE = 12;
const AVG_ITEMS_PER_LIST_PAGE = 3;

/**
 * Represents a chunk of document pages for Stage 2 processing
 */
export interface Chunk {
  /** Unique identifier for this chunk */
  chunkId: string;
  /** Human-readable description of the chunk content */
  description: string;
  /** Page range included in this chunk (inclusive) */
  pageRange: {
    start: number;
    end: number;
  };
  /** Section title if this chunk aligns with a document section */
  sectionTitle?: string;
  /** Estimated number of items in this chunk for progress tracking */
  estimatedItems: number;
}

/**
 * Builds chunks from document metadata following the two-stage priority strategy.
 *
 * Priority 1: If sections exist, create one chunk per section
 * Priority 2: If no sections, create chunks of ~maxPagesPerChunk pages each
 * Always respects table boundaries (doesn't split mid-table)
 *
 * @param metadata - Document metadata including page information
 * @param maxPagesPerChunk - Maximum pages per chunk when no sections (default: 5)
 * @returns Array of chunks for Stage 2 processing
 */
export function buildChunksFromMetadata(
  metadata: DocumentMetadata,
  maxPagesPerChunk: number = 5
): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // PRIORITY 1: Use sections if available
  if (metadata.sections && metadata.sections.length > 0) {
    for (const section of metadata.sections) {
      const sectionPages = metadata.pages.filter(
        (p) => p.pageNumber >= section.startPage && p.pageNumber <= section.endPage
      );

      chunks.push({
        chunkId: `chunk-${++chunkIndex}`,
        description: `Section: ${section.title} (pages ${section.startPage}-${section.endPage})`,
        pageRange: {
          start: section.startPage,
          end: section.endPage,
        },
        sectionTitle: section.title,
        estimatedItems: estimateItemsInPages(sectionPages),
      });
    }

    return chunks;
  }

  // PRIORITY 2: No sections - chunk by page count
  let currentPage = 1;
  const totalPages = metadata.pages.length;
  while (currentPage <= totalPages) {
    const chunkStart = currentPage;
    let chunkEnd = Math.min(currentPage + maxPagesPerChunk - 1, totalPages);

    // Find pages in this chunk
    let chunkPages = metadata.pages.filter(
      (p) => p.pageNumber >= chunkStart && p.pageNumber <= chunkEnd
    );

    // Respect table boundaries - if chunk ends mid-table, extend it
    const lastPageHasTable =
      chunkPages.length > 0 &&
      chunkPages[chunkPages.length - 1].layoutType === "table";

    if (lastPageHasTable && chunkEnd < totalPages) {
      // Look ahead to find where the table ends
      // Use direct array access since pageNumber is 1-indexed
      let nextPage = chunkEnd + 1;
      while (nextPage <= totalPages) {
        const nextPageMeta = metadata.pages[nextPage - 1]; // Convert to 0-indexed
        if (!nextPageMeta || nextPageMeta.layoutType !== "table") {
          // Table doesn't continue to this page, stop at previous page
          break;
        }
        // Table continues, extend chunk to include this page
        chunkEnd = nextPage;
        nextPage++;
      }
      // Re-filter to include extended pages
      chunkPages = metadata.pages.filter(
        (p) => p.pageNumber >= chunkStart && p.pageNumber <= chunkEnd
      );
    }

    chunks.push({
      chunkId: `chunk-${++chunkIndex}`,
      description: `Pages ${chunkStart}-${chunkEnd}`,
      pageRange: {
        start: chunkStart,
        end: chunkEnd,
      },
      estimatedItems: estimateItemsInPages(chunkPages),
    });

    currentPage = chunkEnd + 1;
  }

  return chunks;
}

/**
 * Builds a prompt for Stage 2 processing of a specific chunk.
 *
 * The prompt guides the AI to extract products from the specified page range,
 * maintaining context about the overall document while focusing on the chunk.
 *
 * @param chunk - The chunk to generate a prompt for
 * @returns Prompt string for Stage 2 AI processing
 */
export function buildPageRangePrompt(chunk: Chunk): string {
  let prompt = `Extract products from pages ${chunk.pageRange.start}-${chunk.pageRange.end}.`;

  if (chunk.sectionTitle) {
    prompt += `\n\nSection: ${chunk.sectionTitle}`;
  }

  prompt += `\n\nExpected product count: ~${chunk.estimatedItems}`;

  prompt += `\n\nReturn JSON:
{
  "items": [
    {
      "name": "string",
      "brand": "string",
      "presentation": "string",
      "price": number,
      "category": "string",
      "tags": ["string"]
    }
  ]
}`;

  return prompt;
}

/**
 * Estimates the number of products in a set of pages.
 *
 * This is a heuristic based on:
 * - Tables typically indicate multiple products (5-20 per table)
 * - Non-table pages typically have fewer products (2-5 per page)
 *
 * @param pages - Array of page metadata
 * @returns Estimated number of products
 */
export function estimateItemsInPages(pages: PageMetadata[]): number {
  if (pages.length === 0) {
    return 0;
  }

  let estimate = 0;

  for (const page of pages) {
    if (page.layoutType === "table") {
      estimate += AVG_ITEMS_PER_TABLE_PAGE;
    } else {
      estimate += AVG_ITEMS_PER_LIST_PAGE;
    }
  }

  return Math.max(1, estimate);
}

/**
 * Validates that chunks cover the entire document without gaps or overlaps.
 *
 * @param chunks - Array of chunks to validate
 * @param totalPages - Total pages in the document
 * @returns True if chunks are valid, false otherwise
 */
export function validateChunks(chunks: Chunk[], totalPages: number): boolean {
  if (chunks.length === 0) {
    return totalPages === 0;
  }

  // Check for gaps and overlaps
  let lastEnd = 0;
  for (const chunk of chunks) {
    if (chunk.pageRange.start !== lastEnd + 1) {
      // Gap or overlap detected
      return false;
    }
    lastEnd = chunk.pageRange.end;
  }

  // Check that we cover all pages
  return lastEnd === totalPages;
}

/**
 * Calculates progress percentage based on completed chunks.
 *
 * @param completedChunks - Number of chunks completed
 * @param totalChunks - Total number of chunks
 * @returns Progress percentage (0-100)
 */
export function calculateProgress(completedChunks: number, totalChunks: number): number {
  if (totalChunks === 0) {
    return 100;
  }
  return Math.min(100, Math.round((completedChunks / totalChunks) * 100));
}
