/**
 * Unit tests for chunking strategy
 * Run with: npm test
 */

import { describe, it, expect } from "@jest/globals";
import {
  buildChunksFromMetadata,
  buildPageRangePrompt,
  estimateItemsInPages,
  calculateProgress,
  validateChunks,
  type Chunk,
} from "../convex/lib/chunking";
import type { DocumentMetadata, PageMetadata } from "../convex/lib/schemas";

describe("Chunking Strategy", () => {
  describe("buildChunksFromMetadata", () => {
    it("should create chunks from sections when available", () => {
      const metadata: DocumentMetadata = {
        documentType: "catalog",
        language: "es",
        currency: "ARS",
        pages: createMockPages(10),
        sections: [
          { title: "BEBIDAS", startPage: 1, endPage: 5, category: "bebidas" },
          { title: "LACTEOS", startPage: 6, endPage: 10, category: "lacteos" },
        ],
      };

      const chunks = buildChunksFromMetadata(metadata);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].sectionTitle).toBe("BEBIDAS");
      expect(chunks[0].pageRange.start).toBe(1);
      expect(chunks[0].pageRange.end).toBe(5);
      expect(chunks[1].sectionTitle).toBe("LACTEOS");
      expect(chunks[1].pageRange.start).toBe(6);
      expect(chunks[1].pageRange.end).toBe(10);
    });

    it("should create chunks by page count when no sections", () => {
      const metadata: DocumentMetadata = {
        documentType: "catalog",
        language: "es",
        currency: "ARS",
        pages: createMockPages(12),
      };

      const chunks = buildChunksFromMetadata(metadata, 5);

      expect(chunks).toHaveLength(3); // 12 pages / 5 per chunk = 3 chunks
      expect(chunks[0].pageRange.start).toBe(1);
      expect(chunks[0].pageRange.end).toBe(5);
      expect(chunks[1].pageRange.start).toBe(6);
      expect(chunks[1].pageRange.end).toBe(10);
      expect(chunks[2].pageRange.start).toBe(11);
      expect(chunks[2].pageRange.end).toBe(12);
    });

    it("should handle single page documents", () => {
      const metadata: DocumentMetadata = {
        documentType: "catalog",
        language: "es",
        currency: "ARS",
        pages: createMockPages(1),
      };

      const chunks = buildChunksFromMetadata(metadata);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].pageRange.start).toBe(1);
      expect(chunks[0].pageRange.end).toBe(1);
    });

    it("should respect table boundaries", () => {
      const pages: PageMetadata[] = [
        { pageNumber: 1, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
        { pageNumber: 2, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
        { pageNumber: 3, layoutType: "table", tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }] },
        { pageNumber: 4, layoutType: "list" },
        { pageNumber: 5, layoutType: "list" },
        { pageNumber: 6, layoutType: "list" },
      ];

      const metadata: DocumentMetadata = {
        documentType: "catalog",
        language: "es",
        currency: "ARS",
        pages,
      };

      const chunks = buildChunksFromMetadata(metadata, 2);

      // First chunk should extend to include all 3 table pages
      expect(chunks[0].pageRange.start).toBe(1);
      expect(chunks[0].pageRange.end).toBe(3);
    });
  });

  describe("buildPageRangePrompt", () => {
    it("should generate prompt for chunk without section", () => {
      const chunk: Chunk = {
        chunkId: "chunk-0",
        description: "Pages 1-5",
        pageRange: { start: 1, end: 5 },
        estimatedItems: 50,
      };

      const prompt = buildPageRangePrompt(chunk);

      expect(prompt).toContain("Extract products from pages 1-5");
      expect(prompt).toContain("Expected product count: ~50");
    });

    it("should generate prompt for chunk with section", () => {
      const chunk: Chunk = {
        chunkId: "chunk-0",
        description: "Section: BEBIDAS (pages 1-5)",
        pageRange: { start: 1, end: 5 },
        sectionTitle: "BEBIDAS",
        estimatedItems: 50,
      };

      const prompt = buildPageRangePrompt(chunk);

      expect(prompt).toContain("Section: BEBIDAS");
      expect(prompt).toContain("pages 1-5");
    });
  });

  describe("estimateItemsInPages", () => {
    it("should estimate items for table pages", () => {
      const pages: PageMetadata[] = [
        {
          pageNumber: 1,
          layoutType: "table",
          tables: [{ rowCount: 20, hasHeader: true, confidence: 0.95 }],
        },
        {
          pageNumber: 2,
          layoutType: "table",
          tables: [{ rowCount: 15, hasHeader: true, confidence: 0.9 }],
        },
      ];

      const estimate = estimateItemsInPages(pages);

      expect(estimate).toBe(24); // 12 + 12 (average per table page)
    });

    it("should estimate items for list pages", () => {
      const pages: PageMetadata[] = [
        { pageNumber: 1, layoutType: "list" },
        { pageNumber: 2, layoutType: "list" },
      ];

      const estimate = estimateItemsInPages(pages);

      expect(estimate).toBe(6); // 3 + 3 (average per list page)
    });

    it("should return 0 for empty array", () => {
      const estimate = estimateItemsInPages([]);
      expect(estimate).toBe(0);
    });

    it("should return at least 1 for non-empty pages", () => {
      const pages: PageMetadata[] = [
        { pageNumber: 1, layoutType: "empty" },
      ];

      const estimate = estimateItemsInPages(pages);
      expect(estimate).toBeGreaterThanOrEqual(1);
    });
  });

  describe("calculateProgress", () => {
    it("should calculate progress percentage", () => {
      expect(calculateProgress(0, 10)).toBe(0);
      expect(calculateProgress(5, 10)).toBe(50);
      expect(calculateProgress(10, 10)).toBe(100);
    });

    it("should handle zero total chunks", () => {
      expect(calculateProgress(5, 0)).toBe(100);
    });

    it("should round to integer", () => {
      expect(calculateProgress(1, 3)).toBe(33); // 33.33... rounded
    });
  });

  describe("validateChunks", () => {
    it("should validate proper chunks", () => {
      const chunks: Chunk[] = [
        {
          chunkId: "chunk-0",
          description: "Pages 1-5",
          pageRange: { start: 1, end: 5 },
          estimatedItems: 50,
        },
        {
          chunkId: "chunk-1",
          description: "Pages 6-10",
          pageRange: { start: 6, end: 10 },
          estimatedItems: 50,
        },
      ];

      const isValid = validateChunks(chunks, 10);
      expect(isValid).toBe(true);
    });

    it("should detect gaps in coverage", () => {
      const chunks: Chunk[] = [
        {
          chunkId: "chunk-0",
          description: "Pages 1-5",
          pageRange: { start: 1, end: 5 },
          estimatedItems: 50,
        },
        {
          chunkId: "chunk-1",
          description: "Pages 7-10",
          pageRange: { start: 7, end: 10 },
          estimatedItems: 40,
        },
      ];

      const isValid = validateChunks(chunks, 10);
      expect(isValid).toBe(false); // Page 6 is missing
    });

    it("should detect overlaps", () => {
      const chunks: Chunk[] = [
        {
          chunkId: "chunk-0",
          description: "Pages 1-5",
          pageRange: { start: 1, end: 5 },
          estimatedItems: 50,
        },
        {
          chunkId: "chunk-1",
          description: "Pages 5-10",
          pageRange: { start: 5, end: 10 },
          estimatedItems: 50,
        },
      ];

      const isValid = validateChunks(chunks, 10);
      expect(isValid).toBe(false); // Page 5 is in both chunks
    });

    it("should handle empty chunks for empty document", () => {
      const isValid = validateChunks([], 0);
      expect(isValid).toBe(true);
    });
  });
});

// Helper function to create mock page metadata
function createMockPages(count: number): PageMetadata[] {
  const pages: PageMetadata[] = [];
  for (let i = 1; i <= count; i++) {
    pages.push({
      pageNumber: i,
      layoutType: "table",
      tables: [{ rowCount: 15, hasHeader: true, confidence: 0.9 }],
    });
  }
  return pages;
}
