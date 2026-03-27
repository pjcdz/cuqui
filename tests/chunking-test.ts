/**
 * Manual test runner for chunking logic
 * Run with: npx tsx tests/chunking-test.ts
 */

import {
  buildChunksFromMetadata,
  buildPageRangePrompt,
  estimateItemsInPages,
  validateChunks,
  calculateProgress,
  type DocumentMetadata,
} from "../convex/lib/chunking";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

console.log("\n🧪 Testing Chunking Strategy\n");

// Test 1: Section-based chunking (PRIORITY 1)
console.log("Test 1: Section-based chunking");
const metadataWithSections: DocumentMetadata = {
  totalPages: 20,
  pages: Array.from({ length: 20 }, (_, i) => ({
    pageNumber: i + 1,
    hasTable: i % 2 === 0,
    isSectionStart: i === 0 || i === 10,
    sectionTitle: i === 0 ? "Dairy" : i === 10 ? "Beverages" : undefined,
  })),
  sections: [
    { title: "Dairy", startPage: 1, endPage: 10 },
    { title: "Beverages", startPage: 11, endPage: 20 },
  ],
};

const sectionChunks = buildChunksFromMetadata(metadataWithSections, 5);
assert(sectionChunks.length === 2, "Should create 2 chunks from 2 sections");
assert(sectionChunks[0].sectionTitle === "Dairy", "First chunk should be Dairy section");
assert(sectionChunks[0].pageRange.start === 1, "First chunk should start at page 1");
assert(sectionChunks[0].pageRange.end === 10, "First chunk should end at page 10");
assert(sectionChunks[1].sectionTitle === "Beverages", "Second chunk should be Beverages section");
assert(sectionChunks[1].pageRange.start === 11, "Second chunk should start at page 11");
assert(sectionChunks[1].pageRange.end === 20, "Second chunk should end at page 20");

// Test 2: Page-based chunking (PRIORITY 2)
console.log("\nTest 2: Page-based chunking (no sections)");
const metadataNoSections: DocumentMetadata = {
  totalPages: 12,
  pages: Array.from({ length: 12 }, (_, i) => ({
    pageNumber: i + 1,
    hasTable: false,
    isSectionStart: false,
  })),
};

const pageChunks = buildChunksFromMetadata(metadataNoSections, 5);
assert(pageChunks.length === 3, "Should create 3 chunks from 12 pages with max 5 per chunk");
assert(pageChunks[0].pageRange.start === 1 && pageChunks[0].pageRange.end === 5, "First chunk: pages 1-5");
assert(pageChunks[1].pageRange.start === 6 && pageChunks[1].pageRange.end === 10, "Second chunk: pages 6-10");
assert(pageChunks[2].pageRange.start === 11 && pageChunks[2].pageRange.end === 12, "Third chunk: pages 11-12");

// Test 3: Table boundary respect
console.log("\nTest 3: Table boundary respect");
// Test case: table spans pages 4-6, would split at page 5
const metadataWithTables: DocumentMetadata = {
  totalPages: 10,
  pages: [
    { pageNumber: 1, hasTable: false, isSectionStart: false },
    { pageNumber: 2, hasTable: false, isSectionStart: false },
    { pageNumber: 3, hasTable: false, isSectionStart: false },
    { pageNumber: 4, hasTable: true, isSectionStart: false },
    { pageNumber: 5, hasTable: true, isSectionStart: false },
    { pageNumber: 6, hasTable: true, isSectionStart: false },
    { pageNumber: 7, hasTable: false, isSectionStart: false },
    { pageNumber: 8, hasTable: false, isSectionStart: false },
    { pageNumber: 9, hasTable: false, isSectionStart: false },
    { pageNumber: 10, hasTable: false, isSectionStart: false },
  ],
};

const tableChunks = buildChunksFromMetadata(metadataWithTables, 5);
assert(tableChunks.length === 2, "Should create 2 chunks");
// Chunk 1 should extend to page 7 to include the full table (pages 4-6) and end on a clean boundary
assert(tableChunks[0].pageRange.end === 7, "First chunk should extend to include full table and end on clean boundary (page 7)");
assert(tableChunks[1].pageRange.start === 8, "Second chunk should start after table ends");

// Test 4: Empty document
console.log("\nTest 4: Empty document");
const emptyMetadata: DocumentMetadata = {
  totalPages: 0,
  pages: [],
};
const emptyChunks = buildChunksFromMetadata(emptyMetadata, 5);
assert(emptyChunks.length === 0, "Should create 0 chunks for empty document");

// Test 5: Single page document
console.log("\nTest 5: Single page document");
const singlePageMetadata: DocumentMetadata = {
  totalPages: 1,
  pages: [{ pageNumber: 1, hasTable: false, isSectionStart: false }],
};
const singleChunks = buildChunksFromMetadata(singlePageMetadata, 5);
assert(singleChunks.length === 1, "Should create 1 chunk");
assert(singleChunks[0].pageRange.start === 1 && singleChunks[0].pageRange.end === 1, "Chunk should be page 1");

// Test 6: Prompt generation
console.log("\nTest 6: Prompt generation");
const promptNoSection = buildPageRangePrompt({
  chunkId: "chunk-1",
  description: "Pages 1-5",
  pageRange: { start: 1, end: 5 },
  estimatedItems: 15,
});
assert(promptNoSection.includes("pages 1-5"), "Prompt should include page range");
assert(promptNoSection.includes("Expected product count: ~15"), "Prompt should include estimated count");
assert(!promptNoSection.includes("Section:"), "Prompt should not include section title");

const promptWithSection = buildPageRangePrompt({
  chunkId: "chunk-1",
  description: "Section: Dairy",
  pageRange: { start: 1, end: 10 },
  sectionTitle: "Dairy",
  estimatedItems: 50,
});
assert(promptWithSection.includes("Section: Dairy"), "Prompt should include section title");

// Test 7: Item estimation
console.log("\nTest 7: Item estimation");
const tablePages = [
  { pageNumber: 1, hasTable: true, isSectionStart: false },
  { pageNumber: 2, hasTable: true, isSectionStart: false },
];
const tableEstimate = estimateItemsInPages(tablePages);
assert(tableEstimate === 24, `Should estimate ~24 items for 2 table pages (got ${tableEstimate})`);

const nonTablePages = [
  { pageNumber: 1, hasTable: false, isSectionStart: false },
  { pageNumber: 2, hasTable: false, isSectionStart: false },
];
const nonTableEstimate = estimateItemsInPages(nonTablePages);
assert(nonTableEstimate === 6, `Should estimate ~6 items for 2 non-table pages (got ${nonTableEstimate})`);

const sectionStartPages = [
  { pageNumber: 1, hasTable: false, isSectionStart: true },
  { pageNumber: 2, hasTable: false, isSectionStart: false },
];
const sectionEstimate = estimateItemsInPages(sectionStartPages);
assert(sectionEstimate === 5, `Should estimate ~5 items with section start penalty (got ${sectionEstimate})`);

const emptyPages: any[] = [];
const emptyEstimate = estimateItemsInPages(emptyPages);
assert(emptyEstimate === 0, "Should estimate 0 items for empty pages");

// Test 8: Chunk validation
console.log("\nTest 8: Chunk validation");
const validChunks = [
  { chunkId: "1", description: "", pageRange: { start: 1, end: 5 }, estimatedItems: 10 },
  { chunkId: "2", description: "", pageRange: { start: 6, end: 10 }, estimatedItems: 10 },
];
assert(validateChunks(validChunks, 10) === true, "Should validate correct chunks");

const gapChunks = [
  { chunkId: "1", description: "", pageRange: { start: 1, end: 5 }, estimatedItems: 10 },
  { chunkId: "2", description: "", pageRange: { start: 7, end: 10 }, estimatedItems: 10 },
];
assert(validateChunks(gapChunks, 10) === false, "Should detect gaps");

const overlapChunks = [
  { chunkId: "1", description: "", pageRange: { start: 1, end: 6 }, estimatedItems: 10 },
  { chunkId: "2", description: "", pageRange: { start: 6, end: 10 }, estimatedItems: 10 },
];
assert(validateChunks(overlapChunks, 10) === false, "Should detect overlaps");

// Test 9: Progress calculation
console.log("\nTest 9: Progress calculation");
assert(calculateProgress(0, 10) === 0, "0% progress");
assert(calculateProgress(5, 10) === 50, "50% progress");
assert(calculateProgress(10, 10) === 100, "100% progress");
assert(calculateProgress(15, 10) === 100, "Should cap at 100%");
assert(calculateProgress(0, 0) === 100, "0 total chunks should be 100%");

console.log("\n✅ All tests passed!\n");
