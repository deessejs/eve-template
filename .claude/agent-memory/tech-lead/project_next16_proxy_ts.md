---
name: project-next16-proxy-ts
description: This repo uses Next.js 16; the request-interceptor file is `proxy.ts` at the project root, not `middleware.ts`
metadata:
  type: project
---

In `templates/eve-template/` and any other Next 16 project in this workspace, the file that runs before route handlers is **`proxy.ts`** at the project root, **not** `middleware.ts`.

**Why:** Next.js 16 renamed `middleware.ts` → `proxy.ts`. The user pushed back on 2026-07-16 when the drizzle+better-auth integration plan referenced `middleware.ts` — they use this stack in production and corrected the convention.

**How to apply:** When scaffolding or referencing edge-runtime request interceptors in Next 16 projects here, write `proxy.ts` (with a default-exported `proxy` function or named `config` export per Next 16 docs). Do not introduce `middleware.ts` files. If asked about edge auth / redirects / headers rewriting, default to a `proxy.ts` solution unless the user specifies otherwise.
