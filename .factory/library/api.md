# API Reference

## Convex Queries (Public - Comercio)

- `products.list` - List all products (limit)
- `products.getByTags` - Filter products by tags (AND logic)
- `products.search` - Full-text search with optional category/brand filter

## Convex Queries (Provider)

- `products.listOwn` - List provider's own products (auth required)

## Convex Mutations

- `products.create` - Create product (auth required, provider scoped)
- `products.remove` - Delete product (auth required, owner only)
- `products.batchInsertProducts` - Internal: batch insert from pipeline
- `ingestionProgress.createRun` - Create ingestion run (auth required)
- `ingestionProgress.updateInternal` - Internal: update progress

## Convex Actions (Gemini Pipeline)

- `ingest.ingestCatalog` - Upload + Stage 1 + Stage 2 (auth required)
- `ingest.processBatches` - Stage 3 batch processing (auth required)
- `ingest.resumeIngestion` - Resume failed ingestion (auth required)
