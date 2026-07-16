# Plan — Drizzle + Better Auth integration (login only)

> **Status:** Decisions validated 2026-07-16 — ready for implementation.
> **Owner:** tech-lead
> **Created:** 2026-07-16
> **Target template:** `templates/eve-template` (eve by Vercel)

---

## 1. Context

`eve-template` is currently scaffolded from `npx eve@latest init` plus `eve channels add web-nextjs`. It ships a Next.js 16 web channel in front of an eve agent, but auth is the scaffold's `placeholderAuth()` — a guardrail that returns `401` in production. Every operator that touches the template needs to swap this for a real provider.

This plan integrates **better-auth** (with its `admin` plugin) and **Drizzle ORM** into the template, configured for a **login-only deployment**: no public sign-up, users created via CLI. The motivation and surrounding research live in:

- [`docs/learnings/vercel/eve/auth.md`](../learnings/vercel/eve/auth.md) — eve's two-system auth model
- [`docs/learnings/vercel/better-auth/README.md`](../learnings/vercel/better-auth/README.md) — better-auth overview
- [`docs/learnings/vercel/better-auth/cli.md`](../learnings/vercel/better-auth/cli.md) — better-auth CLI
- [`docs/learnings/vercel/drizzle/README.md`](../learnings/vercel/drizzle/README.md) — Drizzle ORM
- [`docs/learnings/vercel/drizzle/better-auth.md`](../learnings/vercel/drizzle/better-auth.md) — Drizzle × better-auth integration

## 2. Goals

1. Operators can `clone → npm install → migrate → create-admin → deploy` and have a working login-only agent.
2. Public sign-up endpoints are closed (`disableSignUp: true` + defensive hook).
3. Users are bootstrapped via `npx auth@latest create-admin`, then added via a shipped `scripts/create-user.mjs`.
4. eve route auth resolves a `SessionAuthContext` for every authenticated request via better-auth's `getSession({ headers })`.
5. Schema is Drizzle-native; migrations are versioned SQL, committed to the repo.
6. The result is a **template**, not a single app — every secret is env-var driven, no hardcoded URLs or DBs.

## 3. Non-goals

- **No public sign-up UI or flow.** Admin plugin's HTTP `create-user` endpoint is reachable only behind an authenticated admin session; client-side `signUp.email` is disabled.
- **No social providers.** Login is email + password only. (Social can be added later without changing the schema.)
- **No admin web UI in this plan.** User management happens through CLI scripts. A future plan can add an `/admin/users` page that wraps `adminClient`.
- **No MFA / passkeys / 2FA.** These are nice-to-have but explicitly out of scope for v1 of the auth integration.
- **No multi-tenancy.** Single workspace, one set of users, no org plugin.
- **No connection-auth work.** Outbound auth to Linear/GitHub/etc. stays on `@vercel/connect` — separate system, untouched here.

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser                                                             │
│  ─────                                                               │
│  /login (form) ───── POST /api/auth/sign-in/email (better-auth) ──┐  │
│                                                                  │  │
│  / (chat)   ──── GET / ──── cookies sent ───┐                   │  │
│                                            │                   │  │
└────────────────────────────────────────────┼───────────────────┼──┘
                                             │                   │
                  same-origin                 ▼                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js (Vercel)                                                    │
│  ─────────────────                                                    │
│  ┌────────────────────┐  ┌────────────────────────┐  ┌──────────────┐ │
│  │ app/login/         │  │ app/(authenticated)/   │  │ app/api/     │ │
│  │   page.tsx         │  │   page.tsx → Chat     │  │  auth/[...all]│ │
│  └────────────────────┘  └────────────────────────┘  │  → toNextJs  │ │
│           │                       ▲                  │    Handler   │ │
│           ▼                       │                  └──────┬───────┘ │
│       authClient              cookies /                      │        │
│       .signIn.email           session token                  ▼        │
│                                                              │        │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  lib/auth.ts  (better-auth instance)                          │  │
│  │  ├─ drizzleAdapter(db, { provider: "pg" })                   │  │
│  │  ├─ emailAndPassword: { enabled, disableSignUp, require... } │  │
│  │  ├─ socialProviders: {}  (none — login only)                 │  │
│  │  ├─ plugins: [admin()]                                       │  │
│  │  └─ hooks: { before: block /sign-up paths }                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│           │                                                           │
│           ▼                                                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  agent/channels/eve.ts                                        │  │
│  │  ├─ betterAuthFn: AuthFn<Request>                            │  │
│  │  │    └─ auth.api.getSession({ headers }) → SessionAuthCtx    │  │
│  │  └─ auth: [betterAuthFn, localDev(), vercelOidc()]           │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  Postgres           │
                          │  user (role,ban…)   │
                          │  session            │
                          │  account            │
                          │  verification       │
                          └─────────────────────┘
                                     ▲
                                     │
              ┌──────────────────────┴────────────────────────┐
              │                                               │
   scripts/create-admin.sh                            scripts/create-user.mjs
   npx auth create-admin                              auth.api.createUser({...})
                                                       (CLI bypass — server-only)
```

**Three trust boundaries:**

1. **Public route (`POST /api/auth/sign-in/email`)** — accepts any email/password. Closes `/sign-up/*` via config + hook.
2. **Admin route (`POST /api/auth/admin/*`)** — requires session with `role === "admin"` (or `adminUserIds`). Used by future admin web UI.
3. **Server-side scripts** — no session, no HTTP, direct `auth.api.createUser(...)` from Node. Backed by env-var DB credentials.

## 5. Files affected (anticipated)

| Layer | New | Modified | Unchanged |
|---|---|---|---|
| **Config** | `drizzle.config.ts`, `.env.example` | `package.json`, `next.config.ts` (no change expected) | `tsconfig.json`, `postcss.config.mjs`, `vercel.json` |
| **DB** | `db/index.ts`, `db/schema/auth.ts`, `db/schema/index.ts`, `db/migrations/0000_*.sql` | — | — |
| **Auth** | `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts` | `agent/channels/eve.ts` | — |
| **Scripts** | `scripts/create-admin.sh`, `scripts/create-user.mjs` | — | — |
| **UI** | `app/login/page.tsx`, `app/(authenticated)/layout.tsx`, `app/(authenticated)/page.tsx`, `proxy.ts`, `components/sign-out-button.tsx` | `app/page.tsx` (move under `(authenticated)/`) | `app/_components/agent-chat.tsx`, `app/_components/agent-message.tsx` |
| **Docs** | `docs/learnings/vercel/eve/auth-with-better-auth.md` | — | existing learnings docs |

## 6. Decisions (validated 2026-07-16)

These four answers shape the implementation. Recommended defaults confirmed; implementation may proceed.

### 6.1 Driver DB — `pg` everywhere + Docker Compose in dev

**Recommended:** Use `pg` against Vercel Postgres (prod) and a local Postgres in Docker Compose (dev).

| Option | Pro | Con |
|---|---|---|
| `pg` + Vercel Postgres + Docker Compose | Identical code path dev/prod; standard stack | Docker required for dev |
| `pg` + Neon + PGlite (dev) | No Docker; PGlite = zero-setup | Two dialects in dev experience; PGlite is in-process Postgres, missing some features |
| `pg` + SQLite | One schema for both | Better-auth's Drizzle adapter on SQLite needs extra care; not great on Vercel serverless |
| **`pg` + Vercel Postgres + Docker Compose** ← | **Same code dev/prod, well-trodden** | **Docker pre-req for dev** |

### 6.2 CLI for non-admin users — `scripts/create-user.mjs`

**Recommended:** Ship a small Node script that imports `auth` from `lib/auth.ts` and calls `auth.api.createUser(...)`. Lives in `scripts/`, documented in the README.

| Option | Pro | Con |
|---|---|---|
| `scripts/create-user.mjs` calling `auth.api.createUser` directly | No extra UI; admin uses terminal; leverages documented bypass | Admin needs DB env vars locally to run it |
| Future `app/admin/users` page using `adminClient` | Web-native | Significant UI work; out of scope here |
| Both — script now, web UI later | Future-proof | More to maintain |
| **`scripts/create-user.mjs`** ← | **Smallest surface that works** | **Out-of-band runbook needed in README** |

### 6.3 Login UI scope — include in this plan

**Recommended:** Ship login + middleware + logout button in the same plan. Without these, better-auth does nothing visible and the integration is half-baked.

| Option | Pro | Con |
|---|---|---|
| Backend only in this plan, UI next | Smaller PR | Template stays broken end-to-end |
| Backend + login UI + middleware + logout | One complete PR, verifiable end-to-end | Larger surface to review |
| **Backend + login UI + middleware + logout** ← | **Template is usable after one deploy** | **~5 new files, layout refactor** |

### 6.4 better-auth version pin — `^1.7.0`

**Recommended:** Pin to `^1.7.0`. The `create-admin` CLI shipped in `v1.7.0-beta.4` (PR #9547, merged 2026-05-12). Today's date is 2026-07-16; the v1.7 stable line is current.

| Option | Pro | Con |
|---|---|---|
| `^1.6.x` (current at write time) | Conservative | No `create-admin` CLI; we'd need to script the first admin manually |
| `^1.7.0` (latest stable) | Has everything we need | Slightly newer, but v1.7 stable has been out for weeks |
| **`^1.7.0`** ← | **Forward; covers full plan** | **Beta period is over; minor risk of late-arriving patches** |

## 7. Implementation steps (ordered)

Each step is independently verifiable. Steps assume §6 decisions are settled.

### Step 1 — Dependencies

```bash
npm install better-auth @better-auth/drizzle-adapter drizzle-orm pg
npm install -D drizzle-kit @types/pg
```

Pin in `package.json`: `"better-auth": "^1.7.0"`, etc.

### Step 2 — Drizzle config & DB instance

Create:

- `drizzle.config.ts` — points to `db/schema/`, dialect `postgresql`, reads `DATABASE_URL`
- `db/index.ts` — `drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }))`

### Step 3 — Generate & migrate auth schema (initial)

```bash
npx auth@latest generate
```

This writes `db/schema/auth.ts` (user, session, account, verification) without admin plugin columns yet. Then:

```bash
npx drizzle-kit generate    # → db/migrations/0000_*.sql
npx drizzle-kit migrate
```

### Step 4 — Wire better-auth instance

Create `lib/auth.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";   // MUST be the last plugin
import { createAuthMiddleware } from "better-auth/api";
import { APIError } from "better-auth/api";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,   // admin vetting IS the verification in this template
    minPasswordLength: 12,
  },
  socialProviders: {},
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up")) {
        throw new APIError("FORBIDDEN", { message: "Sign-up is closed" });
      }
    }),
  },
});
```

Create `lib/auth-client.ts`:

```ts
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});
```

### Step 5 — Catch-all handler

Create `app/api/auth/[...all]/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { POST, GET } = toNextJsHandler(auth);
```

### Step 6 — Re-generate schema with admin plugin

```bash
npx auth@latest generate
npx drizzle-kit generate
npx drizzle-kit migrate
```

Now `user` table has `role`, `banned`, `banReason`, `banExpires`; `session` has `impersonatedBy`.

### Step 7 — `AuthFn` for eve

Replace `agent/channels/eve.ts` (drop `placeholderAuth()`, keep `localDev()` + `vercelOidc()`, prepend the better-auth `AuthFn`). See `docs/learnings/vercel/eve/auth.md` §"Plugging better-auth into route auth" for the template.

### Step 8 — Login UI

Two-layer auth check: cheap cookie existence at the edge (`proxy.ts`), real session validation in the server component (`(authenticated)/layout.tsx`). This is the **pattern recommended by better-auth's own Next.js integration guide** — the cookie check at the edge avoids blocking requests with a DB call, and the layout check is the actual security boundary.

Refactor `app/page.tsx`:

- Move current chat page under `app/(authenticated)/page.tsx`
- New `app/(authenticated)/layout.tsx` — real session check via `auth.api.getSession`, redirect to `/login` if absent:

  ```ts
  // app/(authenticated)/layout.tsx
  import { auth } from "@/lib/auth";
  import { headers } from "next/headers";
  import { redirect } from "next/navigation";

  export default async function Layout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");
    return <>{children}</>;
  }
  ```

- New `app/login/page.tsx` — email + password form, calls `authClient.signIn.email(...)`
- New `components/sign-out-button.tsx` — `authClient.signOut()` from chat header
- New `proxy.ts` — **cookie-only check** at the edge (NOT a DB hit). Optimistic redirect per better-auth's Next 16 guidance:

  ```ts
  // proxy.ts
  import { NextRequest, NextResponse } from "next/server";
  import { getSessionCookie } from "better-auth/cookies";

  export async function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  export const config = { matcher: ["/"] };
  ```

  ⚠️ `getSessionCookie` is **not a security check** — anyone can forge a cookie. The real auth happens in `app/(authenticated)/layout.tsx`. Cookie check here is purely for redirect UX (avoid showing chat UI for a frame before bouncing).

### Step 9 — Scripts

Create `scripts/create-admin.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
# Wrapper around `npx auth create-admin` that sources .env first.
set -a; source .env; set +a
exec npx auth@latest create-admin "$@"
```

Create `scripts/create-user.mjs`:

```js
#!/usr/bin/env node
// Reads .env, imports the better-auth instance, calls createUser.
// Usage: node scripts/create-user.mjs --email alice@co.com --name "Alice" --role user
```

(Script body detailed in §10.)

### Step 10 — `.env.example`

```
DATABASE_URL=postgres://user:pass@localhost:5432/eve_template
BETTER_AUTH_SECRET=replace-with-openssl-rand-base64-32
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

### Step 11 — Update root README

Append "Authentication" section explaining the runbook: bootstrap, add users, login.

### Step 12 — Verification

Run §11 below.

## 8. Schema generation & migration workflow (reference)

```bash
# After any change to lib/auth.ts (new plugin, new options):
npx auth@latest generate            # rewrites db/schema/auth.ts
npx drizzle-kit generate            # produces db/migrations/####_*.sql
npx drizzle-kit migrate             # applies to the configured DB
```

CI should run `drizzle-kit check` to verify migrations are in sync with the schema.

## 9. Environment variables

| Var | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Postgres connection string |
| `BETTER_AUTH_SECRET` | server | ≥32-char secret; `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | server | Public origin (overrides header inference) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | client | Mirror for the React client |

Vercel: set in Project Settings → Environment Variables (Production + Preview). Local: `.env.local` (gitignored).

## 10. Security model

| Concern | Mitigation |
|---|---|
| Public sign-up endpoint reachable | `emailAndPassword.disableSignUp: true` + before-hook on `/sign-up/*` |
| OAuth implicit sign-up | No social providers configured |
| `createUser` HTTP endpoint without admin session | Plugin enforces admin role + `adminUserIds` check; we never call from unauthenticated clients |
| `createUser` server API bypass (commit f2520f95) | Reserved for our `scripts/create-user.mjs`. Never expose over HTTP without re-introducing the admin check |
| Banned users logging in | Admin plugin's `session.create.before` hook blocks any new session for a banned user (throws `BANNED_USER`); expired bans auto-clear on the next attempt. `getSession` itself does **not** re-check `banned` for already-issued sessions, so a cheap defense-in-depth check on `session.user.banned` in `betterAuthFn` is recommended — flag and `null` out if true. |
| Session token leak | Cookie httpOnly + secure + sameSite=lax (better-auth defaults). HTTPS in prod. |
| Password strength | `minPasswordLength: 12` |
| Email verification skipped | `requireEmailVerification: false` is intentional — admin vetting at creation time replaces it. If a future use case adds public-facing accounts, revisit. |
| Secret rotation | `BETTER_AUTH_SECRETS` plural for rollover (per better-auth docs) |

## 11. Verification plan

After implementation, all of the following must hold:

1. `npm install && npm run typecheck` — clean
2. `npx auth@latest generate && npx drizzle-kit check` — schema in sync
3. Local DB up (`docker compose up -d db`)
4. `npx drizzle-kit migrate` — applies without error
5. `npx auth@latest create-admin --email admin@local.test --password 'correct horse battery staple' --name Admin --yes` — admin created
6. `npm run dev` — Next.js + eve come up
7. **Curl probes:**
   - `POST /api/auth/sign-in/email` with the admin creds → 200 + session cookie
   - `POST /api/auth/sign-up/email` → 403/400 (closed)
   - `GET /` without cookie → 307 redirect to `/login`
   - `GET /` with admin cookie → 200 (chat renders)
8. **Browser test:** log in as admin → see chat → send a message → eve answers → log out → redirected to `/login`
9. `node scripts/create-user.mjs --email alice@local.test --name Alice --role user --password ...` → user created
10. Log in as Alice → works. Hit `/api/auth/admin/list-users` → 403 (not admin).
11. `vercel deploy` (optional local Vercel) → same flow works on the deployed URL

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Drizzle schema regenerates and overwrites hand-written tables | Don't hand-write in `db/schema/auth.ts`; let the CLI own it. Add a top-of-file lint comment |
| `disableSignUp` regression — accidentally re-enabled by a future plugin | Keep the before-hook as defense in depth; add a CI test that asserts the `/sign-up/email` route returns 4xx |
| `BETTER_AUTH_SECRET` leaks to a public artifact | Document `.env.example` as template-only; add `.env*` to `.gitignore` (already covered) |
| PGlite vs `pg` driver mismatch breaks dev/prod parity | If §6.1 picks Docker Postgres (recommended), both environments use `pg` |
| `auth.api.createUser` from a script gets blocked by future better-auth security changes | Pin to `^1.7.0`; revisit if breaking change in v1.8 |

## 13. Out-of-scope / future work

- Admin web UI for user CRUD (`app/admin/users`)
- Two-factor auth, passkeys
- Social sign-in (Google/GitHub for ops who prefer SSO)
- Password reset email flow (requires an email provider; current scaffold ships none)
- Organization / multi-tenant plugin
- A Vercel-deployed `create-admin` step in `vercel.json` post-deploy hook
- Soft-delete users (plugin supports `removeUser`; needs UI)

## 14. Sources

- [Better Auth — Admin plugin](https://better-auth.com/docs/plugins/admin)
- [Better Auth — CLI (create-admin)](https://better-auth.com/docs/concepts/cli)
- [Better Auth — Options reference](https://better-auth.com/docs/reference/options) — `emailAndPassword.disableSignUp`
- [Better Auth — Drizzle ORM Adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth × Drizzle (this repo)](../learnings/vercel/drizzle/better-auth.md)
- [PR #9547 — feat(cli): add create-admin command](https://github.com/better-auth/better-auth/pull/9547)
- [commit f2520f95 — createUser without admin session](https://github.com/better-auth/better-auth/commit/f2520f95)
- [Issue #1142 — Ability to disable email signups](https://github.com/better-auth/better-auth/issues/1142)
- [eve auth & route protection guide](https://eve.dev/docs/guides/auth-and-route-protection)
- [Vercel Connect blog](https://vercel.com/blog/introducing-vercel-connect) — `@vercel/connect/betterauth` (out of scope here, referenced for completeness)
