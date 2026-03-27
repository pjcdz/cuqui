import { z } from "zod";

/**
 * Schema for document metadata extracted by Stage 1
 * Uses high-capacity model (gemini-3.1-pro) for global analysis
 */
export const DocumentMetadataSchema = z.object({
  // Document classification
  documentType: z.enum(["catalog", "pricelist", "menu", "other"]),
  language: z.string().default("es"),
  currency: z.string().default("USD"),

  // Document structure
  pages: z.number().int().positive(),
  sections: z.array(z.object({
    title: z.string(),
    pageStart: z.number().int().nonnegative(),
    pageEnd: z.number().int().nonnegative(),
    description: z.string().optional(),
  })).default([]),

  // Content analysis
  tables: z.number().int().nonnegative().default(0),

  // Global rules for Stage 2
  globalRules: z.object({
    priceFormat: z.enum(["per_unit", "per_kg", "per_liter", "per_pack", "other"]).default("per_unit"),
    decimalSeparator: z.enum([".", ","]).default("."),
    thousandsSeparator: z.enum([".", ",", "", "none"]).default(","),
    hasTaxIncluded: z.boolean().default(false),
    taxRate: z.number().optional(),
  }).optional(),

  // Ambiguities and warnings
  ambiguities: z.array(z.string()).default([]),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

/**
 * JSON Schema for Gemini's responseJsonSchema
 * Defines the structure for structured output from Stage 1
 */
export const DOCUMENT_METADATA_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    documentType: {
      type: "string" as const,
      enum: ["catalog", "pricelist", "menu", "other"],
      description: "Type of document being analyzed",
    },
    language: {
      type: "string" as const,
      description: "Primary language of the document (ISO code)",
    },
    currency: {
      type: "string" as const,
      description: "Currency used in prices (ISO code)",
    },
    pages: {
      type: "number" as const,
      description: "Total number of pages in the document",
    },
    sections: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          pageStart: { type: "number" as const },
          pageEnd: { type: "number" as const },
          description: { type: "string" as const },
        },
        required: ["title", "pageStart", "pageEnd"],
      },
      description: "Major sections or categories in the document",
    },
    tables: {
      type: "number" as const,
      description: "Number of tables detected in the document",
    },
    globalRules: {
      type: "object" as const,
      properties: {
        priceFormat: {
          type: "string" as const,
          enum: ["per_unit", "per_kg", "per_liter", "per_pack", "other"],
          description: "How prices are formatted in the document",
        },
        decimalSeparator: {
          type: "string" as const,
          enum: [".", ","],
          description: "Character used for decimal separation",
        },
        thousandsSeparator: {
          type: "string" as const,
          enum: [".", ",", "", "none"],
          description: "Character used for thousands separation",
        },
        hasTaxIncluded: {
          type: "boolean" as const,
          description: "Whether prices include tax",
        },
        taxRate: {
          type: "number" as const,
          description: "Tax rate if applicable (e.g., 0.21 for 21%)",
        },
      },
      description: "Global formatting rules for price extraction",
    },
    ambiguities: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Any ambiguities or potential issues detected",
    },
  },
  required: ["documentType", "language", "currency", "pages", "sections", "tables", "globalRules", "ambiguities"],
};

/**
 * Prompt for Stage 1: Document Metadata Extraction
 */
export const DOCUMENT_METADATA_PROMPT = `
Analyze this document and extract global metadata in JSON format. Focus on understanding the document structure, formatting patterns, and any ambiguities.

Return a JSON object with this exact structure:
{
  "documentType": "catalog|pricelist|menu|other",
  "language": "ISO language code (e.g., 'es', 'en')",
  "currency": "ISO currency code (e.g., 'USD', 'EUR')",
  "pages": number_of_pages,
  "sections": [
    {
      "title": "section_name",
      "pageStart": starting_page_number,
      "pageEnd": ending_page_number,
      "description": "brief_description_optional"
    }
  ],
  "tables": number_of_tables_detected,
  "globalRules": {
    "priceFormat": "per_unit|per_kg|per_liter|per_pack|other",
    "decimalSeparator": "." | ",",
    "thousandsSeparator": "." | "," | "" | "none",
    "hasTaxIncluded": true|false,
    "taxRate": tax_rate_as_decimal_if_applicable
  },
  "ambiguities": ["list any ambiguities or potential issues"]
}

Guidelines:
- documentType: Classify the main type of this document
- sections: Identify major product categories or sections with their page ranges
- globalRules: Analyze price formatting patterns throughout the document
- ambiguities: Note any unclear elements, missing information, or potential issues
- Be thorough but efficient - this is global analysis, not detailed extraction
`;
