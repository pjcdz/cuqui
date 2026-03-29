# Cuqui v1.0 - Execution Phases

Generated from SRS v1.1 analysis. All phases traceable to SRS requirements.

## Phase 1: Progressive Tree Navigation (CORE)
**SRS**: RF-006, RF-007, RF-011, RF-012, RF-013, RF-014
**Status**: PENDING
**Agent**: FRONTEND + BACKEND
**Dependencies**: None

The current tree is a flat tag cloud. SRS requires a **4-level progressive tree**:
Level 1 → Category (lacteos, carnes, panificados)
Level 2 → Subcategory (leches, yogures, quesos)
Level 3 → Brand (serenísima, sancor)
Level 4 → Presentation (5l, 1l)

**Acceptance Criteria**:
- [ ] Tree shows one level at a time, progressively
- [ ] Each level shows ONLY options with available products (RF-014)
- [ ] AND logic accumulates across levels (RF-012)
- [ ] Breadcrumb navigation (Lácteos > Leches > Serenísima)
- [ ] Product count per option
- [ ] Can navigate back to any level
- [ ] Backend query: getTreeLevels(selectedTags) returns available options

**Files to modify**:
- `convex/products.ts` — add getTreeLevels query
- `src/components/tree-navigation.tsx` — rewrite as progressive tree
- `src/app/page.tsx` — update integration

---

## Phase 2: Route Structure & Navigation
**SRS**: RF-006, RF-008, Section 5.1.1, 5.1.2
**Status**: PENDING
**Agent**: FRONTEND
**Dependencies**: Phase 1

Create proper Next.js pages per SRS section 5.1.

**Routes to create**:
- `/` — Landing / redirect to role-appropriate page
- `/buscar` — Commerce search (tree + results)
- `/producto/[id]` — Product detail page
- `/proveedor/dashboard` — Provider dashboard
- `/proveedor/subir` — Upload catalog
- `/proveedor/productos` — Provider's product table

**Acceptance Criteria**:
- [ ] All 6 routes render without errors
- [ ] Navigation between pages works
- [ ] Shared layout with nav header

---

## Phase 3: Product Display & Detail
**SRS**: RF-008, RF-009
**Status**: PENDING
**Agent**: FRONTEND
**Dependencies**: Phase 2

**Acceptance Criteria**:
- [ ] TanStack React Table with sorting by any column
- [ ] Pagination (20 per page)
- [ ] Grid view alternative (toggle table/grid)
- [ ] Click product → modal with full details
- [ ] Price range filter (min/max inputs)
- [ ] Provider checkbox filter
- [ ] Sort by price (asc/desc) and name (A-Z, Z-A)
- [ ] "Clear filters" button
- [ ] Result count display

---

## Phase 4: Provider Catalog Management
**SRS**: RF-003, RF-004
**Status**: PENDING
**Agent**: FULLSTACK
**Dependencies**: Phase 2

**Acceptance Criteria**:
- [ ] Table with inline editing of product fields (RF-003)
- [ ] Delete product with confirmation dialog
- [ ] Batch price update
- [ ] Zod validation before save
- [ ] "Publish all" batch action
- [ ] Search products by name/code in provider view
- [ ] Price change history tracking

**Backend additions**:
- `convex/products.ts` — update mutation, batchUpdate mutation, price history query
- Schema: add `active` field to products, add `priceHistory` table

---

## Phase 5: Search Enhancements
**SRS**: RF-010
**Status**: PENDING
**Agent**: FULLSTACK
**Dependencies**: Phase 1

**Acceptance Criteria**:
- [ ] Fuzzy search tolerates typos (Convex search index already handles this)
- [ ] Autocomplete suggestions (5 results while typing)
- [ ] Search across name, brand, tags
- [ ] Highlight matching text in results
- [ ] "Search" and "Clear" buttons

---

## Phase 6: Dark Mode & Theming
**SRS**: RNF-019, RNF-013, RNF-020
**Status**: PENDING
**Agent**: FRONTEND
**Dependencies**: Phase 2

**Acceptance Criteria**:
- [ ] Dark/light mode toggle using next-themes
- [ ] Consistent shadcn/ui design system
- [ ] Argentine Spanish formatting (ARS currency, dd/mm/yyyy dates)
- [ ] Geist Sans + Geist Mono fonts (already configured)

---

## Phase 7: Authorization & Security
**SRS**: RNF-006, RNF-007
**Status**: PENDING
**Agent**: FULLSTACK
**Dependencies**: Phase 2

**Acceptance Criteria**:
- [ ] Provider can only edit THEIR products
- [ ] Commerce role has read-only access
- [ ] Clerk metadata stores role (provider/comercio)
- [ ] Convex mutations check role before write
- [ ] Protected routes redirect unauthenticated users

---

## Phase 8: Statistics Dashboard (Optative)
**SRS**: RF-005
**Status**: PENDING
**Agent**: FULLSTACK
**Dependencies**: Phase 4

**Acceptance Criteria**:
- [ ] Total active products count
- [ ] Top 10 most viewed products
- [ ] Date range filter
- [ ] Simple charts (bar/line)

---

## Phase 9: Testing & Build Verification
**SRS**: RNF-030, RNF-031
**Status**: PENDING
**Agent**: TESTING
**Dependencies**: All phases

**Acceptance Criteria**:
- [ ] Existing 37 tests still pass
- [ ] New tests for tree navigation logic
- [ ] New tests for product CRUD
- [ ] Build succeeds: `next build` clean
- [ ] Lint passes: `eslint` clean
- [ ] TypeScript strict: no errors

---

## Phase 10: Final Coverage Report
**SRS**: All
**Status**: PENDING
**Agent**: QA_VALIDATOR
**Dependencies**: Phase 9

**Acceptance Criteria**:
- [ ] SRS_COVERAGE_REPORT.md exists
- [ ] Every RF mapped to implementation artifact
- [ ] Every RNF addressed with evidence
- [ ] All phases marked DONE
