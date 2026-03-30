# Tech Inventory — Cuqui v0.1.0

## Runtime & Framework
- Node.js v25.x
- Next.js 16.2.1 (App Router)
- React 19.2.4
- TypeScript 5.x (strict mode)
- TypeScript target: ES2017 (frontend), ESNext (Convex backend)

## Backend
- Convex ^1.34.0 (database, queries, mutations, actions)
- Clerk ^7.0.6 (authentication via `@clerk/nextjs`)
- `clerkMiddleware` with role-based route protection (`proveedor` role)

## UI & Styling
- Tailwind CSS 4.2.2 (via `@tailwindcss/postcss`)
- shadcn/ui 4.1.0 (base-nova style, RSC-enabled)
- `tw-animate-css` ^1.4.0 (animation utilities)
- `class-variance-authority` ^0.7.1 (variant styling)
- `tailwind-merge` ^3.5.0 (class merging)
- `clsx` ^2.1.1 (conditional classes)
- Lucide React ^1.7.0 (icons)
- `next-themes` ^0.4.6 (dark mode)
- `sonner` ^2.0.7 (toast notifications)
- `@base-ui/react` ^1.3.0 (unstyled headless UI primitives)

## Data & Validation
- Zod ^4.3.6 (schema validation)
- `zod-to-json-schema` ^3.25.1 (Zod → JSON Schema conversion)
- `@tanstack/react-table` ^8.21.3 (data tables)
- `xlsx` ^0.18.5 (Excel file parsing/export)
- `jspdf` ^4.2.1 (PDF generation)
- `jspdf-autotable` ^5.0.7 (PDF table generation)

## AI / ML
- `@google/genai` ^1.46.0 (Google Gemini API)

## Testing
- Vitest ^4.1.2 (test runner)
- `tsx` ^4.19.0 (TypeScript execution for tests)

### Test Files
#### Unit Tests (convex/lib/)
- `convex/lib/levenshtein.test.ts` — Levenshtein distance utility
- `convex/lib/logger.test.ts` — Structured JSON logger
- `convex/lib/rateLimiter.test.ts` — Rate limiter
- `convex/lib/schemas.test.ts` — Zod schema validation
- `convex/lib/validation.test.ts` — Input validation helpers

#### Integration / Feature Tests (tests/)
- `tests/auth-routes.test.ts` — Authentication route protection
- `tests/catalog-management.test.ts` — Catalog CRUD operations
- `tests/cross-area-flows.test.ts` — Cross-area integration flows
- `tests/dark-mode-accessibility.test.ts` — Dark mode & accessibility
- `tests/jsdoc-coverage.test.ts` — JSDoc documentation coverage
- `tests/product-display.test.ts` — Product display rendering
- `tests/product-filters.test.ts` — Product filtering logic
- `tests/product-review.test.ts` — Product review workflows
- `tests/rate-limiting.test.ts` — API rate limiting
- `tests/statistics-dashboard.test.ts` — Statistics dashboard
- `tests/tree-api.test.ts` — Tree structure API endpoint
- `tests/tree-filters.test.ts` — Tree-based filter navigation

#### Performance Tests
- `tests/performance/batch-throughput.test.ts` — Batch insert throughput benchmark

## Build & Quality Tools
- ESLint 9.x with `eslint-config-next` (core-web-vitals + typescript)
- PostCSS 8.x + `@tailwindcss/postcss` + Autoprefixer 10.x
- `size-limit` 12.x + `@size-limit/preset-app` (500 KB bundle budget, gzipped)
- `dotenv` ^17.3.1 (environment variable loading)

## Environment Variables
- `CONVEX_DEPLOYMENT` — Convex deployment identifier
- `NEXT_PUBLIC_CONVEX_URL` — Convex cloud URL (client-facing)
- `NEXT_PUBLIC_CONVEX_SITE_URL` — Convex site URL (HTTP API)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk public key
- `CLERK_SECRET_KEY` — Clerk server-side secret
- `CLERK_FRONTEND_API_URL` — Clerk frontend API domain
- `GEMINI_API_KEY` — Google Gemini API key
- `TEST_CLEANUP_SECRET` — Test cleanup authentication secret

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   └── tree/
│   │       └── structure/
│   │           └── route.ts       # GET /api/tree/structure (cached, ETag)
│   ├── buscar/
│   │   ├── page.tsx               # Search page (public)
│   │   └── buscar-content.tsx     # Search content component
│   ├── producto/
│   │   └── [id]/                  # Product detail (dynamic route, public)
│   ├── proveedor/
│   │   ├── layout.tsx             # Provider layout (auth-protected)
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Provider dashboard
│   │   ├── estadisticas/
│   │   │   └── page.tsx           # Statistics page
│   │   ├── productos/
│   │   │   └── page.tsx           # Product management
│   │   └── subir/
│   │       └── page.tsx           # Upload catalog
│   ├── globals.css                # Global styles (Tailwind)
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home page
│   └── favicon.ico
├── components/
│   ├── ui/                        # shadcn/ui primitives
│   │   ├── alert-dialog.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── progress.tsx
│   │   ├── sonner.tsx
│   │   └── table.tsx
│   ├── ConvexClientProvider.tsx    # Convex + Clerk provider setup
│   ├── duplicate-detection.tsx    # Duplicate product detection UI
│   ├── product-filters.tsx        # Filter sidebar
│   ├── product-search.tsx         # Search bar component
│   ├── products-table.tsx         # Main products data table
│   ├── theme-toggle.tsx           # Dark/light mode toggle
│   ├── tree-navigation.tsx        # Category tree navigation
│   └── upload-catalog.tsx         # Excel file upload component
├── lib/
│   ├── filters.ts                 # Filter state management & URL sync
│   ├── format.ts                  # Formatting utilities (currency, numbers)
│   ├── tree-builder.ts            # Category tree builder
│   └── utils.ts                   # cn() utility (clsx + tailwind-merge)
├── types/
│   └── product.ts                 # Product TypeScript interfaces
└── middleware.ts                  # Clerk auth middleware (route protection)

convex/
├── _generated/                    # Auto-generated Convex API
├── lib/
│   ├── levenshtein.ts             # Levenshtein distance algorithm
│   ├── levenshtein.test.ts
│   ├── logger.ts                  # Structured JSON logger
│   ├── logger.test.ts
│   ├── rateLimiter.ts             # Rate limiting utility
│   ├── rateLimiter.test.ts
│   ├── schemas.ts                 # Zod validation schemas
│   ├── schemas.test.ts
│   ├── validation.ts              # Input validation helpers
│   └── validation.test.ts
├── auth.config.ts                 # Clerk auth provider config
├── duplicates.ts                  # Duplicate detection queries/mutations
├── ingest.ts                      # AI-powered catalog ingestion pipeline
├── ingestionProgress.ts           # Upload progress tracking
├── products.ts                    # Product CRUD queries/mutations
├── providers.ts                   # Provider management functions
├── schema.ts                      # Convex database schema
├── stats.ts                       # Statistics aggregation queries
└── tsconfig.json                  # Convex-specific TypeScript config

tests/                             # Integration & feature tests
├── performance/
│   └── batch-throughput.test.ts
├── auth-routes.test.ts
├── catalog-management.test.ts
├── cross-area-flows.test.ts
├── dark-mode-accessibility.test.ts
├── jsdoc-coverage.test.ts
├── product-display.test.ts
├── product-filters.test.ts
├── product-review.test.ts
├── rate-limiting.test.ts
├── statistics-dashboard.test.ts
├── tree-api.test.ts
└── tree-filters.test.ts
```

## Dependencies (Full List)

### Production Dependencies
| Package | Version |
|---|---|
| `@base-ui/react` | ^1.3.0 |
| `@clerk/nextjs` | ^7.0.6 |
| `@google/genai` | ^1.46.0 |
| `@tanstack/react-table` | ^8.21.3 |
| `class-variance-authority` | ^0.7.1 |
| `clsx` | ^2.1.1 |
| `convex` | ^1.34.0 |
| `dotenv` | ^17.3.1 |
| `jspdf` | ^4.2.1 |
| `jspdf-autotable` | ^5.0.7 |
| `lucide-react` | ^1.7.0 |
| `next` | 16.2.1 |
| `next-themes` | ^0.4.6 |
| `react` | 19.2.4 |
| `react-dom` | 19.2.4 |
| `shadcn` | ^4.1.0 |
| `sonner` | ^2.0.7 |
| `tailwind-merge` | ^3.5.0 |
| `tw-animate-css` | ^1.4.0 |
| `xlsx` | ^0.18.5 |
| `zod` | ^4.3.6 |
| `zod-to-json-schema` | ^3.25.1 |

### Dev Dependencies
| Package | Version |
|---|---|
| `@size-limit/preset-app` | ^12.0.1 |
| `@tailwindcss/postcss` | ^4.2.2 |
| `@types/node` | ^20 |
| `@types/react` | ^19 |
| `@types/react-dom` | ^19 |
| `autoprefixer` | ^10.4.27 |
| `eslint` | ^9 |
| `eslint-config-next` | 16.2.1 |
| `postcss` | ^8.5.8 |
| `size-limit` | ^12.0.1 |
| `tailwindcss` | ^4.2.2 |
| `tsx` | ^4.19.0 |
| `typescript` | ^5 |
| `vitest` | ^4.1.2 |
