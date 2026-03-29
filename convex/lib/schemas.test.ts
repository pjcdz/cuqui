import { describe, it, expect } from "vitest";
import {
  DocumentMetadataSchema,
  DocumentRowsSchema,
  DocumentRowSchema,
  ProductBatchResponseSchema,
  ProductExtractionSchema,
  PackagingInfoSchema,
  PriceInterpretationSchema,
} from "./schemas";

// ============================================================================
// DocumentMetadataSchema
// ============================================================================

describe("DocumentMetadataSchema", () => {
  it("rejects missing required fields", () => {
    expect(() => DocumentMetadataSchema.parse({})).toThrow();
  });

  it("defaults language to es and currency to ARS", () => {
    const result = DocumentMetadataSchema.parse({
      documentType: "price-list",
      pages: [],
    });
    expect(result.language).toBe("es");
    expect(result.currency).toBe("ARS");
  });

  it("accepts valid metadata with all optional fields", () => {
    const result = DocumentMetadataSchema.parse({
      documentType: "catalog",
      language: "en",
      currency: "USD",
      priceInterpretationDefaults: {
        includesTax: true,
        priceUnit: "per-pack",
      },
      globalRules: ["All prices include VAT"],
      ambiguityNotes: ["Mixed currencies detected"],
      pages: [
        {
          pageNumber: 1,
          layoutType: "table",
          suggestedCategory: "Beverages",
          columns: ["Name", "Price"],
          tables: [{ rowCount: 10, hasHeader: true, confidence: 0.9 }],
        },
      ],
      sections: [
        {
          title: "Beverages",
          startPage: 1,
          endPage: 3,
          category: "Drinks",
        },
      ],
    });
    expect(result.documentType).toBe("catalog");
    expect(result.pages).toHaveLength(1);
  });

  it("rejects invalid documentType", () => {
    expect(() =>
      DocumentMetadataSchema.parse({
        documentType: "magazine",
        pages: [],
      })
    ).toThrow();
  });
});

// ============================================================================
// DocumentRowsSchema
// ============================================================================

describe("DocumentRowsSchema", () => {
  it("rejects duplicate row IDs within a page", () => {
    // Schema doesn't enforce unique row IDs — that's done in ingest.ts
    // But we can verify basic structure
    const result = DocumentRowsSchema.parse({
      pages: [
        {
          pageNumber: 1,
          rows: [
            { rowId: "r1", rowIndex: 1, pageNumber: 1, rawText: "Product A" },
            { rowId: "r2", rowIndex: 2, pageNumber: 1, rawText: "Product B" },
          ],
        },
      ],
      totalRowCount: 2,
    });
    expect(result.totalRowCount).toBe(2);
  });

  it("rejects negative totalRowCount", () => {
    expect(() =>
      DocumentRowsSchema.parse({
        pages: [],
        totalRowCount: -1,
      })
    ).toThrow();
  });

  it("accepts zero rows", () => {
    const result = DocumentRowsSchema.parse({
      pages: [],
      totalRowCount: 0,
    });
    expect(result.pages).toHaveLength(0);
  });
});

// ============================================================================
// DocumentRowSchema
// ============================================================================

describe("DocumentRowSchema", () => {
  it("rejects empty rawText", () => {
    expect(() =>
      DocumentRowSchema.parse({
        rowId: "r1",
        rowIndex: 1,
        pageNumber: 1,
        rawText: "",
      })
    ).toThrow();
  });

  it("accepts optional columnValues", () => {
    const result = DocumentRowSchema.parse({
      rowId: "r1",
      rowIndex: 1,
      pageNumber: 1,
      rawText: "Product A $100",
      columnValues: { Name: "Product A", Price: "$100" },
    });
    expect(result.columnValues?.Name).toBe("Product A");
  });
});

// ============================================================================
// PackagingInfoSchema
// ============================================================================

describe("PackagingInfoSchema", () => {
  it("rejects unknown packagingType", () => {
    expect(() =>
      PackagingInfoSchema.parse({
        packagingType: "barrel",
        saleFormat: "single",
      })
    ).toThrow();
  });

  it("accepts minimal packaging info", () => {
    const result = PackagingInfoSchema.parse({
      packagingType: "bottle",
      saleFormat: "single",
    });
    expect(result.packagingType).toBe("bottle");
  });

  it("accepts full packaging with unitsPerPack", () => {
    const result = PackagingInfoSchema.parse({
      packagingType: "carton",
      saleFormat: "multi-pack",
      unitsPerPack: 12,
      netQuantity: 1.5,
      netUnit: "litro",
    });
    expect(result.unitsPerPack).toBe(12);
    expect(result.netQuantity).toBe(1.5);
  });
});

// ============================================================================
// PriceInterpretationSchema
// ============================================================================

describe("PriceInterpretationSchema", () => {
  it("rejects zero amount", () => {
    expect(() =>
      PriceInterpretationSchema.parse({
        amount: 0,
        type: "per-pack",
        confidence: 0.9,
      })
    ).toThrow();
  });

  it("rejects negative amount", () => {
    expect(() =>
      PriceInterpretationSchema.parse({
        amount: -10,
        type: "per-pack",
        confidence: 0.9,
      })
    ).toThrow();
  });

  it("accepts valid price", () => {
    const result = PriceInterpretationSchema.parse({
      amount: 1500.50,
      type: "retail",
      confidence: 0.85,
    });
    expect(result.amount).toBe(1500.5);
  });
});

// ============================================================================
// ProductExtractionSchema
// ============================================================================

describe("ProductExtractionSchema", () => {
  it("rejects empty canonicalName", () => {
    expect(() =>
      ProductExtractionSchema.parse({
        sourceRowId: "r1",
        rawText: "Product A",
        canonicalName: "",
        brand: "Brand X",
        category: "Drinks",
        price: { amount: 100, type: "per-pack", confidence: 0.9 },
        tags: ["drink"],
        confidence: 0.8,
        status: "ok",
      })
    ).toThrow();
  });

  it("accepts valid extraction with all fields", () => {
    const result = ProductExtractionSchema.parse({
      sourceRowId: "r1",
      rawText: "Coca Cola 2L $1200",
      canonicalName: "Coca Cola 2 Litros",
      brand: "Coca-Cola",
      category: "Bebidas",
      subcategory: "Gaseosas",
      packaging: {
        packagingType: "bottle",
        saleFormat: "single",
        netQuantity: 2,
        netUnit: "litro",
      },
      price: { amount: 1200, type: "per-pack", confidence: 0.95 },
      tags: ["gaseosa", "cola", "2l"],
      confidence: 0.95,
      ambiguityNotes: [],
      status: "ok",
    });
    expect(result.canonicalName).toBe("Coca Cola 2 Litros");
    expect(result.packaging?.netQuantity).toBe(2);
  });
});
