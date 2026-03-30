---
name: fullstack-worker
description: Full-stack implementation worker for Cuqui B2B catalog features (Convex backend + Next.js frontend)
---

# Fullstack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

All implementation features in this mission: Convex schema changes, backend queries/mutations/actions, Next.js pages/components, UI interactions, route setup, auth middleware, infrastructure features (encryption, backups, health monitoring).

## Required Skills

None. All verification is done via Vitest, ESLint, and build commands.

## Windows Commands (CRITICAL)

This project runs on Windows. Use these EXACT commands:

```
# Run tests
node_modules\.bin\vitest.cmd run

# Run specific test file
node_modules\.bin\vitest.cmd run tests/some-test.test.ts

# Run ESLint
node_modules\.bin\eslint.cmd .

# TypeScript check
node_modules\.bin\tsc.cmd --noEmit

# Build
node_modules\.bin\next.cmd build

# Dev server
node_modules\.bin\next.cmd dev
```

Do NOT use `npm run test`, `npx vitest`, or bash-style commands — they will fail on this Windows environment.
Do NOT use `&&` in PowerShell — use `;` instead.

## Work Procedure

1. **Read context**: Read `./srs.md` (full SRS), `./docs/ARCHITECTURE.md`, `./docs/SRS_CATALOG.md`, and `.factory/library/architecture.md` for architectural understanding. Read the specific feature description carefully.

2. **Write tests FIRST (TDD)**:
   - For backend (Convex): Write test files in `convex/lib/*.test.ts` or `tests/*.test.ts` using Vitest. Test the specific queries, mutations, and validation logic.
   - For API routes: Write tests in `tests/*.test.ts` that exercise the route handler directly.
   - Run `node_modules\.bin\vitest.cmd run` to see tests FAIL (red phase).

3. **Implement the feature**:
   - Backend: Edit files in `convex/` — schema.ts, queries, mutations, actions. Follow existing patterns in `products.ts`, `ingest.ts`, `ingestionProgress.ts`.
   - Frontend: Edit files in `src/` — pages in `src/app/`, components in `src/components/`. Use shadcn/ui components from `src/components/ui/`.
   - Infrastructure: Create utility files in `convex/lib/` following existing patterns (see `logger.ts`, `rateLimiter.ts`, `levenshtein.ts`).
   - Use ONLY packages already in package.json. Node.js built-in modules (crypto, path, etc.) are allowed.
   - Use Zod for validation.
   - Follow existing code style: Spanish comments/labels for UI, English for code.
   - Add JSDoc to all exported functions.

4. **Verify tests pass**: Run `node_modules\.bin\vitest.cmd run` — all tests must pass (green phase). Including all 523+ existing tests.

5. **Type checking and linting**: Run `node_modules\.bin\tsc.cmd --noEmit` and `node_modules\.bin\eslint.cmd .`. Fix any errors.

6. **Build check**: Run `node_modules\.bin\next.cmd build`. Must succeed with zero errors.

7. **Commit**: Stage and commit all changes with descriptive message referencing SRS requirement IDs.

## Example Handoff

```json
{
  "salientSummary": "Implemented AES-256-GCM encryption utility in convex/lib/encryption.ts and wired it into providers.ts for email/businessName fields. All 530 tests pass (7 new encryption tests + 523 existing). ESLint clean, build succeeds.",
  "whatWasImplemented": "Created convex/lib/encryption.ts with encrypt() and decrypt() functions using Node.js crypto module (AES-256-GCM). Key read from ENCRYPTION_KEY env var with graceful fallback. Modified convex/providers.ts to encrypt email/businessName on write and decrypt on read. Added 7 unit tests covering round-trip, missing key, tamper detection, and different plaintext lengths.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "node_modules\\.bin\\vitest.cmd run", "exitCode": 0, "observation": "530 tests passed (7 new + 523 existing)" },
      { "command": "node_modules\\.bin\\eslint.cmd .", "exitCode": 0, "observation": "0 errors, 22 warnings" },
      { "command": "node_modules\\.bin\\next.cmd build", "exitCode": 0, "observation": "Build succeeded" }
    ],
    "interactiveChecks": []
  },
  "tests": {
    "added": [
      { "file": "convex/lib/encryption.test.ts", "cases": [
        { "name": "encrypts and decrypts plaintext round-trip", "verifies": "VAL-ENC-001" },
        { "name": "returns plaintext when ENCRYPTION_KEY missing", "verifies": "VAL-ENC-003" },
        { "name": "rejects tampered ciphertext", "verifies": "VAL-ENC-001" },
        { "name": "different plaintexts produce different ciphertexts", "verifies": "VAL-ENC-001" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Feature requires a new npm dependency (NOT ALLOWED — document and return)
- Schema migration would break existing Convex deployment
- External dependency (Gemini API, Clerk) is unavailable and blocking testing
- Requirements in feature description conflict with SRS or existing code
- Cannot complete feature within the session's scope
- Adding a feature would cause existing tests to fail in an unfixable way
