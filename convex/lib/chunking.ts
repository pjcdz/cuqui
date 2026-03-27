/**
 * Chunking Strategy for Stage 2 Processing
 *
 * This module implements the chunking logic that divides documents into manageable
 * chunks for Stage 2 processing in the hybrid two-stage ingestion pipeline.
 *
 * Chunk size rationale: ~5 pages balances context vs focus, fits within token limits,
 * enables parallelization, isolates errors, provides progress reporting.
 */

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
 * Metadata about a page in the document
 */
export interface PageMetadata {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Whether this page contains a table */
  hasTable: boolean;
  /** Whether this page is the start of a new section */
  isSectionStart: boolean;
  /** Section title if this is a section start */
  sectionTitle?: string;
}

/**
 * Metadata about the entire document
 */
export interface DocumentMetadata {
  /** Total number of pages in the document */
  totalPages: number;
  /** Array of page metadata */
  pages: PageMetadata[];
  /** Known sections in the document */
  sections?: Array<{
    title: string;
    startPage: number;
    endPage: number;
  }>;
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
  while (currentPage <= metadata.totalPages) {
    const chunkStart = currentPage;
    let chunkEnd = Math.min(currentPage + maxPagesPerChunk - 1, metadata.totalPages);

    // Find pages in this chunk
    let chunkPages = metadata.pages.filter(
      (p) => p.pageNumber >= chunkStart && p.pageNumber <= chunkEnd
    );

    // Respect table boundaries - don't split mid-table
    if (chunkPages.some((p) => p.hasTable) && chunkEnd < metadata.totalPages) {
      // Look ahead to see if the table continues beyond chunkEnd
      let nextPage = chunkEnd + 1;
      while (nextPage <= metadata.totalPages) {
        const nextPageMeta = metadata.pages.find((p) => p.pageNumber === nextPage);
        if (!nextPageMeta || !nextPageMeta.hasTable) {
          // Table doesn't continue to this page, include it and stop
          chunkEnd = nextPage;
          break;
        }
        // Table continues, extend chunk to include this page
        chunkEnd = nextPage;
        nextPage++;
      }
      // Refilter for the extended range
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
 * - Section starts may have headings reducing space
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
    if (page.hasTable) {
      // Tables typically have 5-20 items
      estimate += 12; // Average
    } else {
      // Non-table pages typically have 2-5 items
      estimate += 3; // Average
    }

    // Section starts may have less space
    if (page.isSectionStart) {
      estimate -= 1;
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
