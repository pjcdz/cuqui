# SRS Catalog — Cuqui v1.0

**Source**: SRS v1.1 (2026-03-27)
**Standard**: IEEE 830-1998

---

## Functional Requirements

### RF-001: Carga de Catálogos
- **Priority**: Essential
- **Description**: Providers upload catalogs in PDF, XLSX, XLS, TXT, JPG, PNG formats. System validates size (<50MB), uploads to Gemini Files API, shows progress.
- **Acceptance Criteria**:
  - [x] Supports PDF, XLSX, XLS, TXT, JPG, PNG
  - [x] Rejects files > 50 MB
  - [x] Shows upload progress bar
  - [ ] Allows canceling upload in progress
- **Verification**: Upload component test, file validation test

### RF-002: Visualización del Estado de Procesamiento
- **Priority**: Essential
- **Description**: Real-time display of document processing status (CARGADO → PROCESANDO → NORMALIZANDO → COMPLETADO → ERROR).
- **Acceptance Criteria**:
  - [x] Real-time status updates via Convex reactivity
  - [x] Shows extracted product count
  - [x] Estimated completion time
  - [x] Retry on error
- **Verification**: Ingestion progress query test

### RF-003: Revisión y Edición de Productos Normalizados
- **Priority**: Conditional
- **Description**: Providers review and edit AI-extracted products before publishing.
- **Acceptance Criteria**:
  - [x] TanStack React Table with products
  - [x] Inline field editing
  - [x] Zod validation before save
  - [x] "Publish all" batch action
- **Verification**: Product review test, products table component test

### RF-004: Gestión de Catálogo
- **Priority**: Essential
- **Description**: Manage active product catalog — update prices, activate/deactivate, delete, export.
- **Acceptance Criteria**:
  - [x] Update individual product price
  - [x] Batch price update
  - [x] Soft delete (deactivate) / reactivate
  - [x] Permanent delete with confirmation
  - [x] Export to Excel
  - [x] Search by name or code
  - [x] Price change history
- **Verification**: Catalog management test

### RF-005: Visualización de Estadísticas
- **Priority**: Optative
- **Description**: Provider dashboard with visibility metrics.
- **Acceptance Criteria**:
  - [x] Total active products count
  - [x] Top 10 most viewed products
  - [x] Search appearances
  - [x] Last catalog update date
  - [x] Date range filter
  - [x] PDF export
- **Verification**: Statistics dashboard test

### RF-006: Búsqueda por Árbol Progresivo
- **Priority**: Essential
- **Description**: Progressive tree navigation filtering by Category → Subcategory → Brand → Presentation using AND logic.
- **Acceptance Criteria**:
  - [x] Each level shows only available options
  - [x] Back navigation to previous level
  - [x] Product count per option
  - [x] Breadcrumb navigation
- **Verification**: Tree filters test, tree navigation component test

### RF-007: Navegación Dinámica
- **Priority**: Essential
- **Description**: Tree options generated dynamically from available products.
- **Acceptance Criteria**:
  - [x] Real-time option calculation
  - [x] No products = no options
  - [x] Auto-update on data change
  - [x] Performance caching
- **Verification**: Tree filters test

### RF-008: Visualización de Productos Resultantes
- **Priority**: Essential
- **Description**: Display filtered products with all attributes.
- **Acceptance Criteria**:
  - [x] TanStack React Table
  - [x] Sortable columns
  - [x] Pagination (20 per page)
  - [x] Grid/card view toggle
  - [x] Product detail modal
- **Verification**: Product display test

### RF-009: Filtros Adicionales
- **Priority**: Conditional
- **Description**: Additional filters beyond tree navigation.
- **Acceptance Criteria**:
  - [x] Price range (min/max)
  - [x] Provider checkbox filter
  - [x] Image-only toggle
  - [x] Sort by price/name
  - [x] Filters accumulate with AND
  - [x] Result count display
  - [x] "Clear filters" button
- **Verification**: Product filters test

### RF-010: Búsqueda de Texto Libre
- **Priority**: Conditional
- **Description**: Free text search across name, brand, tags with autocomplete.
- **Acceptance Criteria**:
  - [x] 5 autocomplete suggestions while typing
  - [x] Enter triggers search
  - [x] Highlighted matching text
  - [x] Search and Clear buttons
- **Verification**: Product filters test, product search component test

### RF-011: Sistema de Tags por Producto
- **Priority**: Essential
- **Description**: Each product has an array of tags for classification and search.
- **Acceptance Criteria**:
  - [x] Tags in array format (Convex)
  - [x] Indexed by tags
  - [x] Query by tag combination
  - [x] Case-insensitive tags
- **Verification**: Tree filters test, schema verification

### RF-012: Lógica AND Progresiva
- **Priority**: Essential
- **Description**: Progressive tree applies AND logic across selected tags.
- **Acceptance Criteria**:
  - [x] Each selection accumulates with AND
  - [x] Order-independent filtering
  - [x] Instant result updates
  - [x] Maximum 4 levels deep
- **Verification**: Tree filters test, cross-area flows test

### RF-013: Generación Dinámica de Opciones
- **Priority**: Essential
- **Description**: Options at each level generated from tags in filtered products.
- **Acceptance Criteria**:
  - [x] Unique options (no duplicates)
  - [x] Alphabetical sort
  - [x] Only present tags shown
  - [x] Recalculation on each selection
- **Verification**: Tree filters test

### RF-014: Regla de Visibilidad
- **Priority**: Essential
- **Description**: Options with zero matching products are not shown.
- **Acceptance Criteria**:
  - [x] Zero products = option invisible
  - [x] Empty state message
- **Verification**: Tree filters test

### RF-015: Procesamiento con Gemini Files API
- **Priority**: Essential
- **Description**: Automated document processing using Gemini Files API with 3-stage pipeline.
- **Acceptance Criteria**:
  - [x] Upload to Gemini Files API
  - [x] Retry on API error (3 retries)
  - [x] 30-second timeout per stage
  - [x] Processing logs
  - [x] Gemini file ID storage
- **Verification**: Product review test, ingest pipeline test

### RF-016: Normalización con Gemini Flash Lite
- **Priority**: Essential
- **Description**: AI-powered data extraction and normalization from documents.
- **Acceptance Criteria**:
  - [x] Valid JSON output validated by Zod
  - [x] Tolerant to input format variations
  - [x] Brand normalization (La Serenísima → serenísima)
  - [x] Unit detection (L, ml, kg, g, unidades)
  - [x] Normalized price calculation
- **Verification**: Schemas test, validation test, product review test

### RF-017: Indexación de Productos
- **Priority**: Essential
- **Description**: Products indexed by tags in Convex for fast search.
- **Acceptance Criteria**:
  - [x] Convex indexes (by_tags, by_provider, by_category, by_review_status)
  - [x] Search index (full-text)
  - [x] Indexed queries using .withIndex()
  - [x] Response time < 500ms
- **Verification**: Cross-area flows test, schema verification

### RF-018: Detección de Duplicados
- **Priority**: Conditional
- **Description**: Detect similar/duplicate products using Levenshtein distance and alert providers.
- **Acceptance Criteria**:
  - [x] Configurable similarity threshold (default 30%)
  - [x] Visual alert in edit mode
  - [x] "Merge products" option
  - [x] "They are different, ignore" option
- **Verification**: Levenshtein test, catalog management test, duplicate detection component test

### RF-019: Generación de Estructura de Árbol
- **Priority**: Essential
- **Description**: API endpoint for dynamic tree structure with cache.
- **Acceptance Criteria**:
  - [x] GET /api/tree/structure endpoint
  - [x] Returns available options with product counts
  - [x] 5-minute cache (s-maxage=300)
  - [x] ETag support with conditional 304 responses
- **Verification**: Tree API test

---

## Non-Functional Requirements

### Performance

| ID | Requirement | Metric | Status |
|----|------------|--------|--------|
| RNF-001 | Search response time | < 500ms (p95) | ✅ Indexed queries |
| RNF-002 | Document processing | < 30s per document | ✅ Pipeline timeout |
| RNF-003 | Product indexing throughput | 10,000 products/min | ✅ Benchmark test |
| RNF-004 | Initial page load | < 2s | ⚠️ Lighthouse config exists, CLI not installed |
| RNF-005 | JS bundle size | < 500KB gzipped | ✅ size-limit configured |

### Security

| ID | Requirement | Description | Status |
|----|------------|-------------|--------|
| RNF-006 | Authentication | All endpoints require Clerk auth | ✅ |
| RNF-007 | Authorization | Role-based (provider/comercio) | ✅ |
| RNF-008 | Encryption | AES-256 for sensitive data at rest | ❌ Not implemented |
| RNF-009 | XSS protection | Input sanitization | ✅ React auto-escape + Zod |
| RNF-010 | Rate limiting | 100 req/min per user | ✅ RateLimiter with sliding window |
| RNF-011 | CSRF protection | Tokens in Convex mutations | ✅ Clerk provides CSRF tokens |
| RNF-012 | HTTPS mandatory | HTTP → HTTPS redirect | ✅ Vercel platform |

### Usability

| ID | Requirement | Description | Status |
|----|------------|-------------|--------|
| RNF-013 | Intuitive UI | shadcn/ui design system | ✅ |
| RNF-014 | Automated processing | Zero manual intervention | ✅ 3-stage pipeline |
| RNF-015 | Natural search | Colloquial language support | ✅ Convex searchIndex |
| RNF-016 | Clear feedback | Specific status messages | ✅ Sonner + progress UI |
| RNF-017 | Responsive | Desktop/tablet/mobile | ✅ Tailwind responsive |
| RNF-018 | Accessibility | WCAG 2.1 AA | ✅ ARIA labels, keyboard nav |
| RNF-019 | Dark mode | Theme toggle | ✅ next-themes |
| RNF-020 | Language | Argentine Spanish | ✅ es-AR locale |

### Scalability

| ID | Requirement | Description | Status |
|----|------------|-------------|--------|
| RNF-021 | 100 concurrent providers | Platform-level | N/A (Vercel + Convex auto-scale) |
| RNF-022 | 100K+ products | No degradation | ⚠️ No load testing |
| RNF-023 | Modular architecture | Ready for v2.0 marketplace | ✅ |
| RNF-024 | Horizontal scaling | Vercel + Convex edge | N/A (Platform-level) |

### Reliability

| ID | Requirement | Metric | Status |
|----|------------|--------|--------|
| RNF-025 | Availability | 99.9% uptime | N/A (Platform SLA) |
| RNF-026 | Data consistency | ACID compliance | ✅ Convex guarantees |
| RNF-027 | Fault recovery | Auto-retry | ✅ withRetry + Convex OCC |
| RNF-028 | Backups | Daily, 30-day retention | ❌ Not implemented |
| RNF-029 | Monitoring | Alerts on >5min downtime | ❌ Not implemented |

### Maintainability

| ID | Requirement | Description | Status |
|----|------------|-------------|--------|
| RNF-030 | Clean code | ESLint + TypeScript strict | ✅ |
| RNF-031 | Technical validation | lint + build + test clean | ✅ |
| RNF-032 | Documentation | JSDoc on exported functions | ✅ Coverage test |
| RNF-033 | Structured logging | JSON logging | ✅ Logger utility |
| RNF-034 | Zero-downtime deploy | Vercel rolling deploys | ✅ |

---

## User Roles

### Proveedor (Provider)
- Upload catalogs (RF-001)
- Review extracted products (RF-003)
- Manage catalog (RF-004)
- View statistics (RF-005)
- Can only edit their own products

### Comercio (Commerce)
- Navigate search tree (RF-006)
- View products (RF-008)
- Apply filters (RF-009)
- Free text search (RF-010)
- Read-only access

---

## Business Rules

1. Tags are case-insensitive, stored lowercase
2. AND logic is commutative (order doesn't matter)
3. Maximum 4 levels of tree depth
4. Products with `active: false` are hidden from commerce
5. Review status is either "ok" or "needs_review"
6. Duplicate detection threshold is configurable (default 30%)
7. Geography limited to Argentina (MVP)
8. Language: Argentine Spanish only
9. No transactions in v1.0

---

## Constraints

- File size: max 50MB per document
- Formats: PDF, XLSX, XLS, TXT, JPG, PNG
- Processing timeout: 30 seconds per stage
- Concurrent uploads: up to 100 providers
- No new dependencies allowed beyond TECH_INVENTORY
