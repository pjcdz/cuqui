# Architecture — Cuqui v1.0

## System Overview

Cuqui is a B2B food catalog platform with a 3-tier architecture:

```
┌──────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Provider  │ │ Commerce │ │ Upload   │ │ Stats    ││
│  │ Dashboard │ │ Search   │ │ Pipeline │ │ Dashboard ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│         │           │           │           │         │
│    ┌─────┴───────────┴───────────┴───────────┐       │
│    │         Convex React Hooks              │       │
│    └─────────────────┬───────────────────────┘       │
│                      │ Clerk Auth                     │
└──────────────────────┼───────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────┐
│                Backend (Convex)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Queries  │ │Mutations │ │ Actions  │             │
│  │(read)    │ │(write)   │ │(external)│             │
│  └─────┬────┘ └─────┬────┘ └─────┬────┘             │
│        │            │            │                    │
│   ┌────┴────────────┴────────────┴────┐              │
│   │          Convex Database           │              │
│   │  providers | products | dupPairs  │              │
│   │  ingestionRuns | (backups)        │              │
│   └───────────────────────────────────┘              │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────┼───────────────────────────────┐
│               External Services                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐│
│  │ Clerk Auth   │  │ Gemini Files │  │ Gemini Flash ││
│  │ (identity)   │  │ API (upload) │  │ Lite (AI)    ││
│  └──────────────┘  └──────────────┘  └─────────────┘│
└──────────────────────────────────────────────────────┘
```

## Data Model

### providers
```
id: Id<providers>
clerkId: string (indexed, unique)
name: string
email: string
businessName: string?
createdAt: number
```

### products
```
id: Id<products>
name: string
brand: string
presentation: string
price: number
category: string
tags: string[] (indexed)
providerId: string (indexed)
imageUrl?: string
active?: boolean
createdAt: number
updatedAt: number

# Normalized pricing
normalizedPrice?: number
unitOfMeasure?: string
quantity?: number
multiplier?: number

# Pipeline fields
rawText?: string
canonicalName?: string
subcategory?: string
packagingType?: string
saleFormat?: string
priceType?: string
confidence?: number
reviewStatus?: string ("ok" | "needs_review")
ambiguityNotes?: string[]
ingestionRunId?: Id<ingestionRuns>
sourceRowId?: string

# Statistics
viewCount?: number
searchAppearances?: number
```

### duplicatePairs
```
id: Id<duplicatePairs>
providerId: string (indexed)
productA: Id<products>
productB: Id<products>
nameDistance: number
similarity: number
status: string ("pending" | "ignored")
detectedAt: number
ignoredAt?: number
```

### ingestionRuns
```
id: Id<ingestionRuns>
providerId: string (indexed)
status: string
progressPercent: number
message: string
currentBatch?: number
totalBatches?: number
processedRows?: number
totalRows?: number
errorMessage?: string
fileSha256?: string
startedAt: number
updatedAt: number
completedAt?: number
geminiFileName?: string
geminiFileUri?: string
geminiFileMimeType?: string
metadataJson?: string
rowsJson?: string
processedCount?: number
needsReviewCount?: number
failedProductsCount?: number
failedBatchesJson?: string
durationMs?: number
```

## API Surface

### Convex Queries (read)
- `products.list` — All products (filtered)
- `products.getByTags` — Products by tag combination
- `products.search` — Full-text search via searchIndex
- `products.searchOwn` — Provider's own products
- `products.getById` — Single product by ID
- `products.getTreeOptions` — Dynamic tree options for tags
- `providers.getByClerkId` — Provider by Clerk identity
- `stats.getDashboardStats` — Provider dashboard metrics
- `stats.topViewed` — Top viewed products
- `ingestionProgress.get` — Ingestion run status

### Convex Mutations (write)
- `products.create` — Create single product
- `products.updateProduct` — Update product fields
- `products.batchPriceUpdate` — Update prices in bulk
- `products.toggleActive` — Activate/deactivate product
- `products.remove` — Permanent delete
- `products.batchPublishAll` — Publish reviewed products
- `products.batchInsertProducts` — Internal batch insert
- `providers.createOrUpdate` — Create/update provider
- `duplicates.detectDuplicates` — Run duplicate detection
- `duplicates.mergeDuplicates` — Merge two products
- `duplicates.ignoreDuplicatePair` — Dismiss duplicate
- `ingestionProgress.create` — Create ingestion run
- `ingestionProgress.update` — Update ingestion run

### Convex Actions (external calls)
- `ingest.ingestCatalog` — Full 3-stage pipeline
- `ingest.resumeIngestion` — Resume failed ingestion

### Next.js API Routes
- `GET /api/tree/structure?tags=a,b` — Tree structure with cache + ETag
- `GET /api/health` — Health check endpoint (planned)

## Pipeline Architecture (3-Stage)

```
Upload File
    ↓
Stage 1: Extract Metadata (gemini-3.1-pro)
    → DocumentMetadata (type, pages, tables, rules)
    ↓
Stage 2: Extract Rows (gemini-3.1-pro)
    → DocumentRows (row-based, each row = product line)
    ↓
Create Batches of 10 rows
    ↓
Stage 3: Process Batches (gemini-3.1-flash-lite-preview)
    → ProductBatchResponse (structured products)
    → Status: "ok" | "needs_review"
    ↓
Persist to Convex DB
```

## Security Model

1. **Authentication**: Clerk JWT tokens, validated by Convex auth
2. **Authorization**: Role-based via Clerk metadata (provider/comercio)
3. **Route Protection**: Next.js middleware checks auth + role
4. **Data Isolation**: Providers can only CRUD their own products
5. **Rate Limiting**: Sliding window, 100 req/min per user
6. **Input Validation**: Zod schemas on all mutations
7. **XSS Protection**: React auto-escaping + Zod validation

## Infrastructure

- **Hosting**: Vercel (Next.js) + Convex (backend)
- **Auth**: Clerk (external)
- **AI**: Gemini Files API + Flash Lite
- **No self-hosted services** — all managed platforms
