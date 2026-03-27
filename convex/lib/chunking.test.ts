/**
 * Tests for chunking strategy
 */

import { describe, it, expect } from "vitest";
import {
  buildChunksFromMetadata,
  buildPageRangePrompt,
  estimateItemsInPages,
  validateChunks,
  calculateProgress,
  type DocumentMetadata,
  type Chunk,
} from "./chunking";

describe("chunking", () => {
  describe("buildChunksFromMetadata", () => {
    it("should create chunks from sections (PRIORITY 1)", () => {
      const metadata: DocumentMetadata = {
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

      const chunks = buildChunksFromMetadata(metadata, 5);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].sectionTitle).toBe("Dairy");
      expect(chunks[0].pageRange.start).toBe(1);
      expect(chunks[0].pageRange.end).toBe(10);
      expect(chunks[1].sectionTitle).toBe("Beverages");
      expect(chunks[1].pageRange.start).toBe(11);
      expect(chunks[1].pageRange.end).toBe(20);
    });

    it("should create chunks by page count when no sections (PRIORITY 2)", () => {
      const metadata: DocumentMetadata = {
        totalPages: 12,
        pages: Array.from({ length: 12 }, (_, i) => ({
          pageNumber: i + 1,
          hasTable: false,
          isSectionStart: false,
        })),
      };

      const chunks = buildChunksFromMetadata(metadata, 5);

      expect(chunks).toHaveLength(3);
      expect(chunks[0].pageRange).toEqual({ start: 1, end: 5 });
      expect(chunks[1].pageRange).toEqual({ start: 6, end: 10 });
      expect(chunks[2].pageRange).toEqual({ start: 11, end: 12 });
    });

    it("should respect table boundaries", () => {
      const metadata: DocumentMetadata = {
        totalPages: 10,
        pages: [
          { pageNumber: 1, hasTable: false, isSectionStart: false },
          { pageNumber: 2, hasTable: false, isSectionStart: false },
          { pageNumber: 3, hasTable: false, isSectionStart: false },
          { pageNumber: 4, hasTable: false, isSectionStart: false },
          { pageNumber: 5, hasTable: false, isSectionStart: false },
          { pageNumber: 6, hasTable: true, isSectionStart: false },
          { pageNumber: 7, hasTable: true, isSectionStart: false },
          { pageNumber: 8, hasTable: false, isSectionStart: false },
          { pageNumber: 9, hasTable: false, isSectionStart: false },
          { pageNumber: 10, hasTable: false, isSectionStart: false },
        ],
      };

      const chunks = buildChunksFromMetadata(metadata, 5);

      expect(chunks).toHaveLength(2);
      // First chunk should extend to include the full table
      expect(chunks[0].pageRange).toEqual({ start: 1, end: 7 });
      expect(chunks[1].pageRange).toEqual({ start: 8, end: 10 });
    });

    it("should handle empty documents", () => {
      const metadata: DocumentMetadata = {
        totalPages: 0,
        pages: [],
      };

      const chunks = buildChunksFromMetadata(metadata, 5);

      expect(chunks).toHaveLength(0);
    });

    it("should handle single page documents", () => {
      const metadata: DocumentMetadata = {
        totalPages: 1,
        pages: [{ pageNumber: 1, hasTable: false, isSectionStart: false }],
      };

      const chunks = buildChunksFromMetadata(metadata, 5);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].pageRange).toEqual({ start: 1, end: 1 });
    });
  });

  describe("buildPageRangePrompt", () => {
    it("should generate prompt for chunk without section", () => {
      const chunk: Chunk = {
        chunkId: "chunk-1",
        description: "Pages 1-5",
        pageRange: { start: 1, end: 5 },
        estimatedItems: 15,
      };

      const prompt = buildPageRangePrompt(chunk);

      expect(prompt).toContain("pages 1-5");
      expect(prompt).toContain("Expected product count: ~15");
      expect(prompt).toContain('"items"');
      expect(prompt).not.toContain("Section:");
    });

    it("should generate prompt for chunk with section", () => {
      const chunk: Chunk = {
        chunkId: "chunk-1",
        description: "Section: Dairy",
        pageRange: { start: 1, end: 10 },
        sectionTitle: "Dairy",
        estimatedItems: 50,
      };

      const prompt = buildPageRangePrompt(chunk);

      expect(prompt).toContain("pages 1-10");
      expect(prompt).toContain("Section: Dairy");
      expect(prompt).toContain("Expected product count: ~50");
    });
  });

  describe("estimateItemsInPages", () => {
    it("should estimate 0 for empty pages", () => {
      const estimate = estimateItemsInPages([]);
      expect(estimate).toBe(0);
    });

    it("should estimate higher for pages with tables", () => {
      const pages = [
        { pageNumber: 1, hasTable: true, isSectionStart: false },
        { pageNumber: 2, hasTable: true, isSectionStart: false },
      ];

      const estimate = estimateItemsInPages(pages);

      // Tables average 12 items each
      expect(estimate).toBe(24);
    });

    it("should estimate lower for pages without tables", () => {
      const pages = [
        { pageNumber: 1, hasTable: false, isSectionStart: false },
        { pageNumber: 2, hasTable: false, isSectionStart: false },
      ];

      const estimate = estimateItemsInPages(pages);

      // Non-tables average 3 items each
      expect(estimate).toBe(6);
    });

    it("should reduce estimate for section starts", () => {
      const pages = [
        { pageNumber: 1, hasTable: false, isSectionStart: true },
        { pageNumber: 2, hasTable: false, isSectionStart: false },
      ];

      const estimate = estimateItemsInPages(pages);

      // 3 + 3 - 1 (section start) = 5
      expect(estimate).toBe(5);
    });

    it("should never return less than 1 for non-empty pages", () => {
      const pages = [
        { pageNumber: 1, hasTable: false, isSectionStart: true },
      ];

      const estimate = estimateItemsInPages(pages);

      // Even with section start penalty, minimum is 1
      expect(estimate).toBe(1);
    });
  });

  describe("validateChunks", () => {
    it("should validate correct chunks", () => {
      const chunks: Chunk[] = [
        { chunkId: "1", description: "", pageRange: { start: 1, end: 5 }, estimatedItems: 10 },
        { chunkId: "2", description: "", pageRange: { start: 6, end: 10 }, estimatedItems: 10 },
      ];

      const isValid = validateChunks(chunks, 10);

      expect(isValid).toBe(true);
    });

    it("should detect gaps", () => {
      const chunks: Chunk[] = [
        { chunkId: "1", description: "", pageRange: { start: 1, end: 5 }, estimatedItems: 10 },
        { chunkId: "2", description: "", pageRange: { start: 7, end: 10 }, estimatedItems: 10 },
      ];

      const isValid = validateChunks(chunks, 10);

      expect(isValid).toBe(false);
    });

    it("should detect overlaps", () => {
      const chunks: Chunk[] = [
        { chunkId: "1", description: "", pageRange: { start: 1, end: 6 }, estimatedItems: 10 },
        { chunkId: "2", description: "", pageRange: { start: 6, end: 10 }, estimatedItems: 10 },
      ];

      const isValid = validateChunks(chunks, 10);

      expect(isValid).toBe(false);
    });

    it("should detect incomplete coverage", () => {
      const chunks: Chunk[] = [
        { chunkId: "1", description: "", pageRange: { start: 1, end: 5 }, estimatedItems: 10 },
        { chunkId: "2", description: "", pageRange: { start: 6, end: 9 }, estimatedItems: 10 },
      ];

      const isValid = validateChunks(chunks, 10);

      expect(isValid).toBe(false);
    });

    it("should validate empty chunks for zero pages", () => {
      const isValid = validateChunks([], 0);

      expect(isValid).toBe(true);
    });
  });

  describe("calculateProgress", () => {
    it("should calculate progress correctly", () => {
      expect(calculateProgress(0, 10)).toBe(0);
      expect(calculateProgress(5, 10)).toBe(50);
      expect(calculateProgress(10, 10)).toBe(100);
    });

    it("should handle zero total chunks", () => {
      expect(calculateProgress(0, 0)).toBe(100);
    });

    it("should cap at 100", () => {
      expect(calculateProgress(15, 10)).toBe(100);
    });
  });
});
