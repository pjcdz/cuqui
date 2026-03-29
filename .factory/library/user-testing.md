# User Testing

## Validation Surface

- **Web UI (agent-browser)**: Next.js app on localhost:3000
  - Provider flows: upload, review, catalog management, statistics
  - Commerce flows: tree navigation, product search, product detail
  - Auth flows: login, role-based access
- **API (curl)**: Convex backend via Next.js
- **Unit tests (vitest)**: Convex functions, Zod schemas

## Validation Concurrency

- **Max concurrent validators**: 3
- **Rationale**: The app is lightweight (Next.js dev server ~200MB). Each agent-browser instance ~300MB. Machine has ~8GB usable headroom. 3 validators = ~1.1GB + 200MB server = well within budget.
