# Architecture

## System Overview

Cuqui is a B2B food catalog platform connecting **proveedores** (providers/suppliers) with **comercios** (businesses/buyers). The system automates catalog ingestion from PDF/Excel files using Google Gemini AI, normalizes product data, and provides progressive tree-based navigation for product discovery.

**Tech stack**: Next.js 16 (App Router) + Convex (backend/database) + Clerk (auth) + Gemini (AI document processing)

## User Roles

| Role | Purpose | Key Actions |
|------|---------|-------------|
| **proveedor** (provider) | Uploads and manages product catalogs | Upload PDF/XLSX, review extraction results, manage products, view statistics |
| **comercio** (business) | Searches and browses the product catalog | Browse tree navigation, search products, filter by category/brand, view product details |

## Data Model

### `products` table
Core entity representing a product from a provider's catalog.

| Field | Type | Notes |
|-------|------|-------|
| name, brand, presentation, price | string/number | Core product info |
| category, tags | string/string[] | Classification & filtering |
| providerId | string | Clerk tokenIdentifier, links to provider |
| normalizedPrice, unitOfMeasure, quantity, multiplier | optional | Normalized pricing (per kg/liter/unit) |
| rawText, canonicalName, subcategory | optional | Pipeline extraction fields |
| packagingType, saleFormat, priceType | optional | Packaging metadata |
| confidence, reviewStatus, ambiguityNotes | optional | Quality control flags |
| ingestionRunId, sourceRowId | optional | Pipeline lineage |

**Indexes**: `by_provider`, `by_tags` (array element), `by_category`, `by_review_status`, `by_ingestion_run`
**Search index**: `search` on `name` with filter fields `category`, `brand`, `providerId`

### `ingestionRuns` table
Tracks the lifecycle of a catalog upload through the 3-stage pipeline.

| Field | Type | Notes |
|-------|------|-------|
| providerId, status, progressPercent, message | string/number | Progress tracking |
| currentBatch, totalBatches, processedRows, totalRows | optional number | Batch progress |
| geminiFileName, geminiFileUri, geminiFileMimeType | optional string | Gemini Files API references |
| metadataJson, rowsJson | optional string | Intermediate pipeline state (JSON) |
| fileSha256 | optional string | Deduplication |
| processedCount, needsReviewCount, failedProductsCount | optional number | Result counters |
| failedBatchesJson, durationMs | optional | Diagnostics |

**Indexes**: `by_provider`, `by_provider_hash` (deduplication)

## Ingestion Pipeline: 3-Stage Gemini Processing

```
PDF/XLSX Upload
      │
      ▼
┌──────────────────────────────────┐
│  Upload to Gemini Files API      │  Buffer → temp file → upload → poll until ACTIVE
│  + SHA-256 deduplication check   │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Stage 1: Document Metadata      │  Model: gemini-3.1-pro
│  Extract page count, document    │  Input: file URI + prompt
│  type, currency, ambiguities     │  Output: DocumentMetadata (Zod validated)
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Stage 2: Row Extraction         │  Model: gemini-3.1-pro
│  Extract structured rows from    │  Input: file URI + metadata + prompt
│  document with page references   │  Output: DocumentRows (Zod validated)
└──────────┬───────────────────────┘
           │
           ▼  (state stored in ingestionRuns.metadataJson / rowsJson)
┌──────────────────────────────────┐
│  Stage 3: Batch Processing       │  Model: gemini-3.1-flash-lite-preview
│  Process rows in batches of 10.  │  Input: metadata + page context + batch rows
│  Each batch → product extraction │  Output: ProductBatchResponse (Zod validated)
│  + normalization + persistence   │  Products with confidence < 0.5 → needs_review
└──────────┬───────────────────────┘
           │
           ▼
   Products inserted into DB
```

**Key pipeline properties**:
- **Idempotency**: SHA-256 hash prevents duplicate file uploads within 24h
- **Resumability**: Failed ingestions can resume from last unprocessed batch
- **Validation**: Every Gemini response validated against Zod schemas before acceptance
- **Batch context integrity**: Each batch response is validated against expected row IDs and page numbers

### Convex actions for pipeline

| Action | Purpose |
|--------|---------|
| `ingest.ingestCatalog` | Upload + Stage 1 + Stage 2 (stores state, does NOT process batches) |
| `ingest.processBatches` | Stage 3 batch processing (supports `startFromBatch` for resume) |
| `ingest.resumeIngestion` | Resume failed ingestion from last unprocessed batch |

## Tree Navigation: Progressive AND Filtering

The tree navigation provides 4 levels of progressive filtering using AND logic:

```
Level 0: No filter → show all products
Level 1: category selected → filter by category
Level 2: subcategory selected → filter by category AND subcategory
Level 3: brand selected → filter by category AND subcategory AND brand
```

Each level shows counts of available products. Implemented client-side using `TreeFilter` state (`{ category, subcategory, brand }`). Products are fetched via `products.list` and filtered in memory by tag matching using `products.getByTags`.

## Route Structure

```
/                           → Landing page / redirect based on role
/proveedor/*                → Provider-specific routes (auth required, role: proveedor)
  /proveedor/catalogo       → Upload catalog, review ingestion progress
  /proveedor/productos      → Manage products table
  /proveedor/estadisticas   → Provider statistics
/buscar                     → Product search / tree navigation (comercio)
/producto/[id]              → Product detail page (comercio)
```

## Key Patterns

### Convex Functions
- **Queries** (`query`): Read data. Public queries for comercio, authenticated queries for proveedor.
- **Mutations** (`mutation`): Write data. Require auth, enforce provider scoping.
- **Internal mutations** (`internalMutation`): Used by pipeline for batch inserts.
- **Actions** (`action`, `"use node"`): Node.js environment for Gemini API calls. Handle file I/O, external API calls, and orchestrate multi-stage processing.

### Zod Validation
All Gemini responses are validated with Zod schemas defined in `convex/lib/schemas.ts`:
- `DocumentMetadataSchema` — Stage 1 output
- `DocumentRowsSchema` — Stage 2 output
- `ProductBatchResponseSchema` — Stage 3 output

JSON schemas derived via `zod-to-json-schema` are passed to Gemini's `responseJsonSchema` config for structured output.

### TanStack React Table
Provider product management uses `@tanstack/react-table` for sortable, filterable data tables with pagination.

### Authentication (Clerk)
- `ctx.auth.getUserIdentity()` for Convex function auth
- `identity.tokenIdentifier` as provider ID
- Role-based access via Clerk metadata (`proveedor` / `comercio`)

### Encryption (RNF-008)
- `convex/lib/encryption.ts` — AES-256-GCM encrypt/decrypt using Node.js `crypto`
- Provider email and businessName encrypted on write, decrypted on read
- Key from `ENCRYPTION_KEY` env var; graceful passthrough if missing
- IV and authTag stored alongside ciphertext as hex strings

### Backups (RNF-028)
- `convex/crons.ts` — Daily cron creates backup snapshot
- `backups` table with 30-day TTL for automatic retention
- `GET /api/backups` — List available backups
- `GET /api/backups/[id]` — Download specific backup as JSON
- Backup data includes providers (encrypted fields as-is) + products

### Health Monitoring (RNF-029)
- `GET /api/health` — Returns system status with Convex connectivity check
- Returns `{ status: "ok"|"degraded", timestamp, components: { convex } }`
- Convex cron periodically records health check results
