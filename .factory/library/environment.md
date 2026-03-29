# Environment

Environment variables, external dependencies, and setup notes.

## Required Environment Variables

- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk frontend key
- `CLERK_SECRET_KEY` - Clerk backend secret
- `CLERK_FRONTEND_API_URL` - Clerk frontend API URL
- `GEMINI_API_KEY` - Google Gemini API key for document processing
- `CONVEX_DEPLOYMENT` - Convex deployment name

## External Services

- **Convex** (cloud): Backend, database, real-time queries. Deployment: `dev:clean-mammoth-892`
- **Clerk** (cloud): Authentication, user management. Roles: `proveedor`, `comercio`
- **Gemini Files API** (cloud): Document processing. Models: `gemini-3.1-pro`, `gemini-3.1-flash-lite-preview`

## Tech Stack

- Next.js 16.2.1 (App Router)
- React 19.2.4
- Convex 1.34.0
- Clerk 7.0.6
- shadcn/ui + Tailwind CSS
- TanStack React Table 8.21.3
- Zod 4.3.6
- Vitest 4.1.2

## File Upload Limits

- Max file size: 50 MB (Gemini Files API limit)
- Supported formats: PDF, XLSX, XLS
