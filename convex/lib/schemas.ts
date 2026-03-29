import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/** Zod schema for page-level metadata within a catalog document. */
export const PageMetadataSchema = z.object({
  pageNumber: z.number().int().min(1),
  layoutType: z.enum([
    "table",
    "list",
    "mixed",
    "full-page-image",
    "title-page",
    "empty",
    "unrecognized",
  ]),
  suggestedCategory: z.string().optional(),
  columns: z.array(z.string()).optional(),
  interpretationRules: z.array(z.string()).optional(),
  tables: z
    .array(
      z.object({
        rowCount: z.number().int().nonnegative(),
        hasHeader: z.boolean(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .optional(),
});

export type PageMetadata = z.infer<typeof PageMetadataSchema>;

/** Zod schema for a named section within a catalog document. */
export const SectionMetadataSchema = z.object({
  title: z.string(),
  startPage: z.number().int().min(1),
  endPage: z.number().int().min(1),
  category: z.string().optional(),
  notes: z.array(z.string()).optional(),
});

export type SectionMetadata = z.infer<typeof SectionMetadataSchema>;

/** Zod schema for the top-level document metadata extracted in Stage 1. */
export const DocumentMetadataSchema = z.object({
  documentType: z.enum(["price-list", "catalog", "invoice", "order-form", "unknown"]),
  language: z.string().default("es"),
  currency: z.string().default("ARS"),
  priceInterpretationDefaults: z
    .object({
      includesTax: z.boolean(),
      priceUnit: z.enum(["per-pack", "per-unit", "per-kg", "per-liter", "variable", "unknown"]),
    })
    .optional(),
  globalRules: z.array(z.string()).optional(),
  ambiguityNotes: z.array(z.string()).optional(),
  pages: z.array(PageMetadataSchema),
  sections: z.array(SectionMetadataSchema).optional(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

/** Zod schema for a single row extracted from a catalog page in Stage 2. */
export const DocumentRowSchema = z.object({
  rowId: z.string(),
  rowIndex: z.number().int().min(1),
  pageNumber: z.number().int().min(1),
  rawText: z.string().min(1),
  columnValues: z.record(z.string(), z.string()).optional(),
  rowNotes: z.array(z.string()).optional(),
});

export type DocumentRow = z.infer<typeof DocumentRowSchema>;

/** Zod schema for a page grouping of rows within Stage 2 output. */
export const DocumentPageRowsSchema = z.object({
  pageNumber: z.number().int().min(1),
  pageSummary: z.string().optional(),
  rows: z.array(DocumentRowSchema),
});

export type DocumentPageRows = z.infer<typeof DocumentPageRowsSchema>;

/** Zod schema for the complete Stage 2 row-based document representation. */
export const DocumentRowsSchema = z.object({
  pages: z.array(DocumentPageRowsSchema),
  totalRowCount: z.number().int().nonnegative(),
});

export type DocumentRows = z.infer<typeof DocumentRowsSchema>;

/** Zod schema for packaging information of an extracted product. */
export const PackagingInfoSchema = z.object({
  packagingType: z.enum([
    "bottle",
    "carton",
    "box",
    "bag",
    "crate",
    "unit",
    "jar",
    "can",
    "sachet",
    "unknown",
  ]),
  saleFormat: z.enum(["single", "multi-pack", "bulk", "variable", "unknown"]),
  unitsPerPack: z.number().int().min(1).optional(),
  netQuantity: z.number().positive().optional(),
  netUnit: z.enum(["litro", "ml", "kg", "g", "unidad"]).optional(),
});

export type PackagingInfo = z.infer<typeof PackagingInfoSchema>;

/** Zod schema for price interpretation of an extracted product. */
export const PriceInterpretationSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(["per-pack", "per-unit", "per-kg", "per-liter", "wholesale", "retail", "unknown"]),
  confidence: z.number().min(0).max(1),
});

export type PriceInterpretation = z.infer<typeof PriceInterpretationSchema>;

/** Zod enum schema for product extraction status values. */
export const ProductExtractionStatusSchema = z.enum(["ok", "needs_review"]);
export type ProductExtractionStatus = z.infer<typeof ProductExtractionStatusSchema>;

/** Zod schema for a single extracted product from Stage 3 batch processing. */
export const ProductExtractionSchema = z.object({
  sourceRowId: z.string(),
  rawText: z.string().min(1),
  canonicalName: z.string().min(1),
  brand: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  packaging: PackagingInfoSchema.optional(),
  price: PriceInterpretationSchema,
  tags: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  ambiguityNotes: z.array(z.string()).optional(),
  status: ProductExtractionStatusSchema,
});

export type ProductExtraction = z.infer<typeof ProductExtractionSchema>;

/** Zod schema for the batch context metadata included in Stage 3 responses. */
export const ProductBatchContextSchema = z.object({
  batchId: z.string(),
  batchIndex: z.number().int().nonnegative(),
  totalBatches: z.number().int().min(1),
  rowIds: z.array(z.string()).min(1),
  pageNumbers: z.array(z.number().int().min(1)).min(1),
});

export type ProductBatchContext = z.infer<typeof ProductBatchContextSchema>;

/** Zod schema for the complete Stage 3 batch response containing extracted products and context. */
export const ProductBatchResponseSchema = z.object({
  items: z.array(ProductExtractionSchema),
  batchContext: ProductBatchContextSchema,
});

export type ProductBatchResponse = z.infer<typeof ProductBatchResponseSchema>;

type JsonSchema = Record<string, unknown>;

/** JSON Schema (OpenAPI 3) for DocumentMetadata, derived from the Zod schema. */
export const DocumentMetadataJsonSchema = zodToJsonSchema(DocumentMetadataSchema as never, {
  name: "DocumentMetadata",
  target: "openApi3",
}) as JsonSchema;

/** JSON Schema (OpenAPI 3) for DocumentRows, derived from the Zod schema. */
export const DocumentRowsJsonSchema = zodToJsonSchema(DocumentRowsSchema as never, {
  name: "DocumentRows",
  target: "openApi3",
}) as JsonSchema;

/** JSON Schema (OpenAPI 3) for ProductBatchResponse, derived from the Zod schema. */
export const ProductBatchResponseJsonSchema = zodToJsonSchema(ProductBatchResponseSchema as never, {
  name: "ProductBatchResponse",
  target: "openApi3",
}) as JsonSchema;

/** JSON Schema for Stage 1 document metadata extraction (alias for DocumentMetadataJsonSchema). */
export const DOCUMENT_METADATA_JSON_SCHEMA = DocumentMetadataJsonSchema;
/** JSON Schema for Stage 2 row extraction (alias for DocumentRowsJsonSchema). */
export const DOCUMENT_ROWS_JSON_SCHEMA = DocumentRowsJsonSchema;
/** JSON Schema for Stage 3 batch product extraction (alias for ProductBatchResponseJsonSchema). */
export const PRODUCT_BATCH_JSON_SCHEMA = ProductBatchResponseJsonSchema;

/** System prompt for Stage 1: Extract document metadata from an uploaded catalog file. */
export const DOCUMENT_METADATA_PROMPT = `
You are analyzing a provider catalog for a B2B ingestion system.

Extract structured document metadata from the uploaded file.

Return:
- document type
- language
- currency
- default price interpretation rules
- page-level metadata for every page
- sections if they exist
- global rules for later extraction
- ambiguity notes when needed

At page level, describe:
- layout type
- suggested category
- column headers
- interpretation rules
- detected tables with row counts

Edge cases to handle:
- Mixed currencies: If multiple currencies appear (e.g., USD and ARS), note this in ambiguityNotes and set currency to the most frequent one. Add per-row notes for rows using a different currency.
- Scanned/handwritten pages: If a page appears to be a scanned image, set layoutType to "full-page-image" and note low confidence in tables.
- Rotated tables: If tables appear rotated or sideways, still count them and note the rotation in interpretationRules.
- Multi-page tables: If a table spans multiple pages, note this in interpretationRules with the page range.
- Very small documents (1-2 pages): Process normally; do not inflate ambiguity.
- Very large documents (50+ pages): Focus on consistent metadata across all pages. Note if layout changes mid-document.
- Password-protected or encrypted files: If you cannot read the file contents, set documentType to "unknown", add a note "File appears password-protected or encrypted" to ambiguityNotes, and return minimal metadata.

Be precise. Do not invent certainty. If unclear, use ambiguityNotes.
Return JSON only, following the schema.
`;

/** Function that generates the Stage 2 prompt for row-based document extraction. */
export const DOCUMENT_ROWS_PROMPT = (metadata: DocumentMetadata) => `
You are converting an uploaded catalog into a readable row-based representation.

DOCUMENT METADATA:
${JSON.stringify(metadata, null, 2)}

Task:
- Read the uploaded file directly.
- Produce a page-grouped list of rows.
- Each row must represent one candidate product line or sale line.
- Preserve raw text exactly as seen in the document.
- Keep rows grouped by page.
- If a page is tabular, emit one row per product row.
- If a page is list-like, emit one row per product line.
- Skip decorative headers/footers that are clearly not products.
- Include incomplete or ambiguous candidate rows anyway.

Special handling:
- Multi-page tables: Rows should continue with incrementing rowIndex across pages. Use columnValues from the header row on the first page for subsequent pages.
- Rotated content: Read the text as it would appear when upright. Do not skip rotated rows.
- Currency symbols: Preserve exact currency symbols in rawText (e.g., "USD 5.00", "$ 1.200"). Do not normalize currencies.
- Sparse rows: If a row has missing cells (common in multi-column layouts), include it with whatever data exists and add a rowNote like "incomplete row, missing price column".

For each row return:
- rowId
- rowIndex within its page
- pageNumber
- rawText
- optional columnValues
- optional rowNotes

Return JSON only, following the schema.
`;

/** Function that generates the Stage 3 prompt for batch product normalization. */
export const PRODUCT_BATCH_PROMPT = (
  metadata: DocumentMetadata,
  pageMetadata: PageMetadata[],
  batchContext: ProductBatchContext,
  rows: DocumentRow[],
) => `
You are normalizing provider catalog rows into structured products.

GLOBAL DOCUMENT METADATA:
${JSON.stringify(metadata, null, 2)}

PAGE METADATA FOR THIS BATCH:
${JSON.stringify(pageMetadata, null, 2)}

BATCH CONTEXT:
${JSON.stringify(batchContext, null, 2)}

ROWS TO PROCESS:
${JSON.stringify(rows, null, 2)}

Task:
- Process only the rows in this batch.
- Use the metadata to interpret category, layout, packaging, and price semantics.
- Normalize each valid product row into structured JSON.
- Do not use rows outside this batch.

Rules:
- Every item must reference a sourceRowId present in batchContext.rowIds.
- status must be "ok" or "needs_review" only.
- If packaging, quantity, or price meaning is ambiguous, use "needs_review".
- Do not invent missing facts.
- tags must be useful for search/navigation.
- canonicalName should be a clean normalized product name.
- brand should be normalized but human-readable.

Special cases:
- Mixed currencies in this batch: If rows contain different currencies, set status to "needs_review" and add an ambiguityNote specifying which currencies were found.
- Ambiguous packaging: If you cannot determine netQuantity or netUnit with confidence > 0.7, omit the packaging field entirely and set status to "needs_review".
- Very small batch (1-2 rows): Process normally; do not over-interpret sparse data.
- Duplicate-looking rows: If two rows appear to describe the same product at different prices (e.g., wholesale vs retail), extract both but differentiate via price.type and add relevant tags.

Return JSON only, following the schema and echoing the same batchContext exactly.
`;

export default {
  DocumentMetadataSchema,
  PageMetadataSchema,
  SectionMetadataSchema,
  DocumentRowsSchema,
  DocumentPageRowsSchema,
  DocumentRowSchema,
  ProductExtractionSchema,
  ProductBatchResponseSchema,
  ProductBatchContextSchema,
  PackagingInfoSchema,
  PriceInterpretationSchema,
  ProductExtractionStatusSchema,
  DocumentMetadataJsonSchema,
  DocumentRowsJsonSchema,
  ProductBatchResponseJsonSchema,
};
