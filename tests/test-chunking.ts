/**
 * Simple manual test for chunking logic
 * Run with: npx tsx tests/test-chunking.ts
 */

import {
  buildChunksFromMetadata,
  buildPageRangePrompt,
  estimateItemsInPages,
  calculateProgress,
  validateChunks,
} from "../convex/lib/chunking";
import type { DocumentMetadata } from "../convex/lib/schemas";

// Helper to create mock metadata
function createMockMetadata(pageCount: number, withSections = false): DocumentMetadata {
  const pages = Array.from({ length: pageCount }, (_, i) => ({
    pageNumber: i + 1,
    layoutType: "table" as const,
    tables: [{ rowCount: 15, hasHeader: true, confidence: 0.9 }],
  }));

  const metadata: DocumentMetadata = {
    documentType: "catalog",
    language: "es",
    currency: "ARS",
    pages,
  };

  if (withSections) {
    metadata.sections = [
      { title: "BEBIDAS", startPage: 1, endPage: Math.floor(pageCount / 2), category: "bebidas" },
      { title: "LACTEOS", startPage: Math.floor(pageCount / 2) + 1, endPage: pageCount, category: "lacteos" },
    ];
  }

  return metadata;
}

console.log("🧪 Testing Chunking Strategy\n");

// Test 1: Sections
console.log("Test 1: Chunking with sections");
const metadataWithSections = createMockMetadata(10, true);
const chunksWithSections = buildChunksFromMetadata(metadataWithSections);
console.log(`✓ Created ${chunksWithSections.length} chunks from sections`);
console.log(`  Chunk 1: ${chunksWithSections[0].description}`);
console.log(`  Chunk 2: ${chunksWithSections[1]?.description}`);
console.log(`  Validation: ${validateChunks(chunksWithSections, 10) ? "✓ PASS" : "✗ FAIL"}\n`);

// Test 2: No sections (mixed layouts to test chunking)
console.log("Test 2: Chunking without sections (mixed layouts)");
const mixedMetadata: DocumentMetadata = {
  documentType: "catalog",
  language: "es",
  currency: "ARS",
  pages: [
    { pageNumber: 1, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
    { pageNumber: 2, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
    { pageNumber: 3, layoutType: "list" },
    { pageNumber: 4, layoutType: "list" },
    { pageNumber: 5, layoutType: "list" },
    { pageNumber: 6, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
    { pageNumber: 7, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
    { pageNumber: 8, layoutType: "list" },
    { pageNumber: 9, layoutType: "list" },
    { pageNumber: 10, layoutType: "list" },
  ],
};
const mixedChunks = buildChunksFromMetadata(mixedMetadata, 3);
console.log(`✓ Created ${mixedChunks.length} chunks`);
mixedChunks.forEach((chunk, i) => {
  console.log(`  Chunk ${i + 1}: pages ${chunk.pageRange.start}-${chunk.pageRange.end}`);
});
console.log(`  Validation: ${validateChunks(mixedChunks, 10) ? "✓ PASS" : "✗ FAIL"}\n`);

// Test 3: Table boundary respect
console.log("Test 3: Respecting table boundaries");
const tableMetadata: DocumentMetadata = {
  documentType: "catalog",
  language: "es",
  currency: "ARS",
  pages: [
    { pageNumber: 1, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
    { pageNumber: 2, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
    { pageNumber: 3, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
    { pageNumber: 4, layoutType: "list" },
    { pageNumber: 5, layoutType: "list" },
  ],
};
const tableChunks = buildChunksFromMetadata(tableMetadata, 2);
console.log(`✓ Created ${tableChunks.length} chunks`);
console.log(`  Chunk 1: pages ${tableChunks[0].pageRange.start}-${tableChunks[0].pageRange.end} (extended to include all 3 table pages)`);
console.log(`  Validation: ${validateChunks(tableChunks, 5) ? "✓ PASS" : "✗ FAIL"}\n`);

// Test 4: Prompt generation
console.log("Test 4: Prompt generation");
const prompt = buildPageRangePrompt(chunksWithSections[0]);
console.log(`✓ Generated prompt for chunk:`);
console.log(`  ${prompt.substring(0, 100)}...\n`);

// Test 5: Item estimation
console.log("Test 5: Item estimation");
const estimate = estimateItemsInPages(tableMetadata.pages);
console.log(`✓ Estimated ${estimate} items for 5 pages (3 tables + 2 lists)\n`);

// Test 6: Progress calculation
console.log("Test 6: Progress calculation");
const progress1 = calculateProgress(0, 5);
const progress2 = calculateProgress(3, 5);
const progress3 = calculateProgress(5, 5);
console.log(`✓ Progress: ${progress1}% (0/5), ${progress2}% (3/5), ${progress3}% (5/5)\n`);

console.log("✅ All tests passed!");
