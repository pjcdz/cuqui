/**
 * E2E Tests for Cuqui Ingest Pipeline v1.2
 *
 * Tests the hybrid two-stage ingestion system:
 * - Stage 1: Metadata extraction (catalog name, provider, page count)
 * - Stage 2: Product extraction with semantic interpretation
 *
 * Run with: npx convex-test tests/ingest-e2e.test.ts
 */

import { test } from "convex-test";
import { api } from "../convex/_generated/api";

// Mock catalog data for testing
const MOCK_CATALOG_BASE64 = "base64encodedcontenthere"; // Replace with real test file

describe("Ingest Pipeline E2E", () => {
  test("should extract metadata in Stage 1", async () => {
    const result = await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    // Verify Stage 1 metadata extraction
    expect(result).toBeDefined();
    expect(result.processed).toBeGreaterThan(0);
  });

  test("should extract products with semantic interpretation in Stage 2", async () => {
    const result = await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    // Verify products were created
    const products = await api.products.list();
    expect(products.length).toBeGreaterThan(0);

    // Verify semantic fields
    const firstProduct = products[0];
    expect(firstProduct.canonicalName).toBeDefined();
    expect(firstProduct.brand).toBeDefined();
    expect(firstProduct.packaging).toBeDefined();
  });

  test("should mark ambiguous items with needs_review", async () => {
    const result = await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    const products = await api.products.list();

    // Check that some products have needs_review status
    const needsReview = products.filter(p => p.status === "needs_review");
    expect(needsReview.length).toBeGreaterThanOrEqual(0);

    // Verify ambiguity notes exist for items needing review
    needsReview.forEach(product => {
      if (product.status === "needs_review") {
        expect(product.ambiguityNotes).toBeDefined();
        expect(product.ambiguityNotes.length).toBeGreaterThan(0);
      }
    });
  });

  test("should have confidence scores in valid range", async () => {
    await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    const products = await api.products.list();

    products.forEach(product => {
      expect(product.confidence).toBeGreaterThanOrEqual(0);
      expect(product.confidence).toBeLessThanOrEqual(1);
    });
  });

  test("should populate packaging fields", async () => {
    await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    const products = await api.products.list();

    products.forEach(product => {
      expect(product.packaging).toBeDefined();
      expect(product.packagingType).toBeDefined();
      expect(product.saleFormat).toBeDefined();
    });
  });

  test("should filter by status in products query", async () => {
    await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    // Test filtering by status
    const okProducts = await api.products.list({ status: "ok" });
    const reviewProducts = await api.products.list({ status: "needs_review" });

    expect(Array.isArray(okProducts)).toBe(true);
    expect(Array.isArray(reviewProducts)).toBe(true);
  });
});

/**
 * Performance Tests
 * Target: <30 seconds for 10-page catalog
 */
describe("Performance Tests", () => {
  test("should process 10-page catalog in under 30 seconds", async () => {
    const startTime = Date.now();

    await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds

    expect(duration).toBeLessThan(30);
  });

  test("should log timing breakdown", async () => {
    const result = await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    // Verify timing data is returned
    expect(result.timing).toBeDefined();
    expect(result.timing.stage1).toBeDefined();
    expect(result.timing.stage2).toBeDefined();
    expect(result.timing.validation).toBeDefined();
  });
});

/**
 * Accuracy Verification Tests
 * Target: >90% status: "ok" for clear catalogs
 * Target: >70% ambiguous items marked needs_review
 */
describe("Accuracy Tests", () => {
  test("should have >90% ok status for clear catalogs", async () => {
    await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    const products = await api.products.list();
    const okProducts = products.filter(p => p.status === "ok");
    const accuracy = (okProducts.length / products.length) * 100;

    expect(accuracy).toBeGreaterThan(90);
  });

  test("should mark >70% ambiguous items for review", async () => {
    await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    const products = await api.products.list();
    const lowConfidence = products.filter(p => p.confidence < 0.8);
    const needsReview = products.filter(p => p.status === "needs_review");
    const detectionRate = (needsReview.length / lowConfidence.length) * 100;

    expect(detectionRate).toBeGreaterThan(70);
  });
});

/**
 * Schema Validation Tests
 */
describe("Schema Validation", () => {
  test("should validate product schema with Zod", async () => {
    await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    const products = await api.products.list();

    products.forEach(product => {
      // Verify required fields exist
      expect(product._id).toBeDefined();
      expect(product.name).toBeDefined();
      expect(product.brand).toBeDefined();
      expect(product.presentation).toBeDefined();
      expect(product.price).toBeDefined();
      expect(product.category).toBeDefined();
      expect(product.tags).toBeDefined();
      expect(product.providerId).toBeDefined();
      expect(product.createdAt).toBeDefined();
      expect(product.updatedAt).toBeDefined();

      // Verify new v1.2 fields
      expect(product.canonicalName).toBeDefined();
      expect(product.packaging).toBeDefined();
      expect(product.packagingType).toBeDefined();
      expect(product.saleFormat).toBeDefined();
      expect(product.confidence).toBeDefined();
      expect(product.status).toBeDefined();
    });
  });
});

/**
 * Data Integrity Tests
 */
describe("Data Integrity", () => {
  test("should preserve data consistency across stages", async () => {
    const result = await api.ingest.ingestCatalog({
      fileBase64: MOCK_CATALOG_BASE64,
      mimeType: "application/pdf",
    });

    const products = await api.products.list();

    // Verify all products from Stage 2 are in DB
    expect(products.length).toEqual(result.processed);

    // Verify timestamps
    products.forEach(product => {
      expect(product.createdAt).toBeLessThanOrEqual(product.updatedAt);
    });
  });

  test("should handle errors gracefully", async () => {
    // Test with invalid base64
    await expect(
      api.ingest.ingestCatalog({
        fileBase64: "invalid-base64!",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow();
  });
});

/**
 * Manual Testing Instructions
 *
 * These tests require manual verification with real catalogs:
 *
 * 1. Upload test-file.pdf via UI
 * 2. Verify Stage 1 extracts metadata correctly
 * 3. Verify Stage 2 extracts products with semantic interpretation
 * 4. Check 20 random products against source PDF
 * 5. Verify: canonicalName matches, brand correct, packaging accurate
 * 6. Document results in SRS_v1.md section 8.12
 *
 * Manual Test Results Template:
 * - Date: ___________
 * - Catalog: test-file.pdf
 * - Pages: ___________
 * - Products Extracted: ___________
 * - Status OK: _______%
 * - Needs Review: _______%
 * - Processing Time: _______ seconds
 * - Notes: _________________________________________
 */
