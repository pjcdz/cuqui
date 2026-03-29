---
name: fullstack-worker
description: Full-stack implementation worker for Cuqui B2B catalog features (Convex backend + Next.js frontend)
---

# Fullstack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

All implementation features in this mission: Convex schema changes, backend queries/mutations/actions, Next.js pages/components, UI interactions, route setup, auth middleware.

## Required Skills

- `agent-browser` — For manual UI verification after implementation. Launch browser, navigate to app, interact with UI, take screenshots.

## Work Procedure

1. **Read context**: Read `./srs.md` (full SRS), `./docs/architecture.md` (if exists), and `.factory/library/architecture.md` for architectural understanding. Read the specific feature description carefully.

2. **Write tests FIRST (TDD)**:
   - For backend (Convex): Write test files in `convex/*.test.ts` or `tests/*.test.ts` using Vitest. Test the specific queries, mutations, and validation logic.
   - For frontend: Component tests are optional but write at least one integration test for new routes/pages.
   - Run `npm run test` to see tests FAIL (red phase).

3. **Implement the feature**:
   - Backend: Edit files in `convex/` — schema.ts, queries, mutations, actions. Follow existing patterns in `products.ts`, `ingest.ts`, `ingestionProgress.ts`.
   - Frontend: Edit files in `src/` — pages in `src/app/`, components in `src/components/`. Use shadcn/ui components from `src/components/ui/`.
   - Use TanStack React Table for any table components (already in package.json).
   - Use Zod for validation.
   - Follow existing code style: Spanish comments/labels for UI, English for code.

4. **Verify tests pass**: Run `npm run test` — all tests must pass (green phase).

5. **Type checking and linting**: Run `npx tsc --noEmit` and `npm run lint`. Fix any errors.

6. **Build check**: Run `npm run build`. Must succeed with zero errors.

7. **Manual UI verification** using `agent-browser`:
   - Start dev server if not running: `npm run dev` (port 3000)
   - Navigate to relevant pages
   - Interact with new features
   - Take screenshots as evidence
   - Stop dev server when done

8. **Commit**: Stage and commit all changes with descriptive message.

## Example Handoff

```json
{
  "salientSummary": "Implemented provider routes (/proveedor/dashboard, /proveedor/subir, /proveedor/productos) with Clerk role-based auth middleware. Added providers table to Convex schema. All 12 new tests pass, build clean, manually verified all 4 routes via agent-browser.",
  "whatWasImplemented": "Added providers table to convex/schema.ts with clerkId, name, email, businessName fields and by_clerk index. Created src/app/proveedor/dashboard/page.tsx, subir/page.tsx, productos/page.tsx with layout. Added auth middleware in src/middleware.ts checking Clerk role metadata. Created Convex mutations for provider registration.",
  "whatWasLeftUndone": "Statistics page (/proveedor/estadisticas) not yet implemented — deferred to later feature.",
  "verification": {
    "commandsRun": [
      { "command": "npm run test", "exitCode": 0, "observation": "49 tests passed (12 new + 37 existing)" },
      { "command": "npx tsc --noEmit", "exitCode": 0, "observation": "No TypeScript errors" },
      { "command": "npm run lint", "exitCode": 0, "observation": "No ESLint errors" },
      { "command": "npm run build", "exitCode": 0, "observation": "Build succeeded" }
    ],
    "interactiveChecks": [
      { "action": "Navigated to /proveedor/dashboard as proveedor user", "observed": "Dashboard rendered with product count card and navigation links" },
      { "action": "Navigated to /proveedor/subir as proveedor user", "observed": "Upload form rendered with file input accepting PDF/XLSX/XLS" },
      { "action": "Navigated to /proveedor/dashboard as unauthenticated user", "observed": "Redirected to Clerk sign-in page" },
      { "action": "Navigated to /proveedor/dashboard as comercio user", "observed": "Redirected to /buscar with access denied toast" }
    ]
  },
  "tests": {
    "added": [
      { "file": "tests/providers.test.ts", "cases": [
        { "name": "creates provider record from Clerk identity", "verifies": "VAL-AUTH-003" },
        { "name": "prevents duplicate provider creation on repeated login", "verifies": "VAL-AUTH-003" }
      ]},
      { "file": "tests/auth-middleware.test.ts", "cases": [
        { "name": "provider routes require proveedor role", "verifies": "VAL-AUTH-004, VAL-AUTH-005" },
        { "name": "unauthenticated users redirected to login", "verifies": "VAL-AUTH-006" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature requires schema migration that breaks existing Convex deployment
- External dependency (Gemini API, Clerk) is unavailable and blocking testing
- Requirements in feature description conflict with SRS or existing code
- Cannot complete feature within the session's scope
