# API Reference

## Next.js API Routes

- `GET /api/tree/structure?tags=a,b` — Dynamic tree structure with 5-min cache + ETag
- `GET /api/health` — System health check (Convex connectivity)
- `GET /api/backups` — List available backup snapshots
- `GET /api/backups/[id]` — Download specific backup as JSON

## Convex Queries (Public - Comercio)

- `products.list` - List all products (limit)
- `products.getByTags` - Filter products by tags (AND logic)
- `products.search` - Full-text search with optional category/brand filter

## Convex Queries (Provider)

- `products.listOwn` - List provider's own products (auth required)
- `products.searchOwn` - Search provider's own products by name

## Convex Queries (Backups)

- `backups.list` - List all backup snapshots
- `backups.getById` - Get specific backup by ID

## Convex Mutations

- `products.create` - Create product (auth required, provider scoped)
- `products.updateProduct` - Update product fields (auth required, owner only)
- `products.batchPriceUpdate` - Update prices in bulk (auth required)
- `products.toggleActive` - Activate/deactivate product (auth required)
- `products.remove` - Delete product (auth required, owner only)
- `products.batchInsertProducts` - Internal: batch insert from pipeline
- `products.batchPublishAll` - Publish all reviewed products (auth required)
- `providers.createOrUpdate` - Create/update provider (auth required)
- `ingestionProgress.createRun` - Create ingestion run (auth required)
- `ingestionProgress.updateInternal` - Internal: update progress
- `backups.createBackup` - Internal: create daily backup snapshot

## Convex Actions (Gemini Pipeline)

- `ingest.ingestCatalog` - Upload + Stage 1 + Stage 2 (auth required)
- `ingest.processBatches` - Stage 3 batch processing (auth required)
- `ingest.resumeIngestion` - Resume failed ingestion (auth required)
