# Cuqui - B2B Food Catalog Platform

A B2B food catalog management system connecting **proveedores** (providers/suppliers) with **comercios** (retailers) in Argentina. Providers upload product catalogs (PDF/Excel), which are processed via a 3-stage Gemini AI pipeline into structured data that comercios can search, filter, and browse.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **UI Components**: shadcn/ui + Radix/Base UI + Lucide icons
- **Backend**: Convex (cloud) — queries, mutations, actions
- **Auth**: Clerk — role-based (`proveedor` / `comercio`)
- **AI Pipeline**: Gemini Files API (3-stage extraction + validation)
- **Tables**: TanStack React Table v8
- **Validation**: Zod v4
- **Testing**: Vitest
- **Notifications**: Sonner (toast)

## Features

### Provider (Proveedor)
- **Catalog Upload** — Upload PDF/XLSX/XLS catalogs via 3-stage Gemini AI pipeline
- **Product Management** — Review, edit, batch price update, soft delete/reactivate
- **Duplicate Detection** — Levenshtein-based duplicate detection with merge/ignore actions
- **Statistics Dashboard** — Metrics with date range filter and PDF export
- **Dark Mode** — Theme toggle with system preference support

### Commerce (Comercio)
- **Product Search** — Full-text search with autocomplete suggestions
- **4-Level Tree Navigation** — Category → Subcategory → Brand → Presentation
- **Advanced Filters** — Price range, provider checkbox, sort controls, image-only toggle
- **Grid/Table Views** — Toggle between table and card layout with pagination
- **Product Detail** — Modal with all product attributes
- **ARS Formatting** — Prices in Argentine Peso ($1.200,50)

### Cross-Cutting
- Role-based auth middleware (Clerk)
- Data isolation between providers
- Active/inactive product filtering on public queries
- Accessibility (ARIA labels, keyboard navigation, focus trapping)
- Responsive mobile layout (375px)

## Routes

| Route | Role | Description |
|-------|------|-------------|
| `/proveedor/dashboard` | Proveedor | Provider dashboard with product stats |
| `/proveedor/subir` | Proveedor | Catalog upload with processing progress |
| `/proveedor/productos` | Proveedor | Product management, review, edit, export |
| `/proveedor/estadisticas` | Proveedor | Statistics dashboard with PDF export |
| `/buscar` | Comercio | Product search with tree nav and filters |
| `/producto/[id]` | Public | Product detail page |

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Convex account and deployment
- Clerk account with configured application
- Gemini API key

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure `.env.local` with:
   - `CONVEX_DEPLOYMENT` — Convex deployment URL
   - `NEXT_PUBLIC_CONVEX_URL` — Convex client URL
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk public key
   - `CLERK_SECRET_KEY` — Clerk secret key
   `GEMINI_API_KEY` — Google Gemini API key

4. Start the Convex backend:
   ```bash
   npx convex dev
   ```

5. Start the Next.js dev server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run test suite (Vitest) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript type checking |
| `npx convex dev` | Start Convex backend |

## Testing

409 tests across 12 test files covering:
- Convex schema validation and queries
- 3-stage Gemini pipeline (Zod schemas, validation)
- Product filters and sorting logic
- Cross-area flows (upload→search, edit propagation, deactivation, role isolation, data isolation)
- Dark mode accessibility (ARIA, keyboard navigation)
- Levenshtein duplicate detection algorithm
- File upload validation (50MB limit, MIME types)

## Project Structure

```
convex/                    # Convex backend
├── schema.ts             # Database schema (products, providers, duplicatePairs, ingestionProgress)
├── products.ts           # Product queries and mutations
├── providers.ts          # Provider registration
├── ingest.ts             # 3-stage Gemini AI pipeline
├── stats.ts              # Statistics queries
├── duplicates.ts         # Duplicate detection queries/mutations
├── ingestionProgress.ts  # Upload progress tracking
└── lib/
    ├── schemas.ts        # Zod validation schemas
    ├── validation.ts     # File validation helpers
    └── levenshtein.ts    # Levenshtein distance algorithm

src/
├── app/                  # Next.js App Router pages
│   ├── buscar/           # Comercio search page
│   ├── proveedor/        # Provider pages (dashboard, subir, productos, estadisticas)
│   └── producto/[id]/    # Product detail page
├── components/           # React components
│   ├── ui/               # shadcn/ui primitives
│   ├── products-table.tsx    # TanStack table + grid view + detail modal
│   ├── tree-navigation.tsx   # 4-level tree with keyboard nav
│   ├── product-search.tsx    # Search with autocomplete
│   ├── product-filters.tsx   # Price range, provider, sort, image toggle
│   ├── upload-catalog.tsx    # File upload with progress
│   ├── duplicate-detection.tsx # Duplicate merge/ignore UI
│   └── theme-toggle.tsx      # Dark mode toggle
├── lib/
│   ├── format.ts         # ARS price formatting, search highlighting
│   └── filters.ts        # Filter logic (pure functions)
└── middleware.ts          # Clerk role-based route protection
```

## License

Private — All rights reserved.
