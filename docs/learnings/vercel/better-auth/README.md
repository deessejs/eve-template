# better-auth — TypeScript Auth Framework

> **TL;DR.** MIT, framework-agnostic authentication framework for TypeScript. Declarative, plugin-based, version-controlled in code (no dashboard to click). Comprehensively featured out of the box: email/password, social OAuth, passkeys, 2FA, magic links, multi-tenancy, organization SSO, SAML/SCIM, plus a growing set of AI-agent auth primitives (MCP auth, token exchange, agent delegation). Recently announced as **joining Vercel**.

- **Site:** https://better-auth.com
- **Repo:** https://github.com/better-auth/better-auth
- **License:** MIT
- **Primary language:** TypeScript (100%)
- **Latest release at time of writing:** `v1.7.0-rc.1` (2026-07-02, prerelease)
- **Status:** Production-used at scale (OpenAI, Databricks, Strapi per their homepage)

See also: [`../eve/README.md`](../eve/README.md) for the eve framework that this same template uses.

---

## Why it exists

Authentication in the TypeScript ecosystem is, in the project's own framing, "a half-solved problem": open-source libraries usually require substantial additional code for anything beyond basic email/password, and the path of least resistance is to ship the auth to a managed service (Clerk, Auth0, WorkOS).

Better Auth's pitch: do better as a community — MIT, code-declarative, plug the gaps (2FA, multi-tenancy, organizations, enterprise SSO) via an explicit plugin system rather than through a paid plan.

## Core idea: auth lives in code

No dashboard. No magic. You write a `betterAuth({ ... })` config in a file that lives in your repo, version-controlled, type-safe, reviewable in PRs. The framework generates:

- a server-side handler at `/api/auth/*` (configurable base path)
- a client (`createAuthClient`) for the framework you're using
- a CLI for schema generation and migration

```ts
// auth.ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! },
  },
  plugins: [
    twoFactor(),
    passkey(),
    organization(),
  ],
});
```

To migrate or rotate secrets: a CLI (`npx auth@latest generate | migrate`) — no SQL state hidden behind a vendor.

## Batteries included

Better Auth has built-in features plus a plugin ecosystem that crosses 50+ options. The taxonomy roughly maps to the project's own "50+ and growing" claim.

| Category | What's in |
|---|---|
| **Core auth** | Email/password, sessions, email verification, password reset |
| **Social sign-on** | Google, GitHub, Apple, Discord, and ~30+ more via `socialProviders` |
| **Multi-factor / Passkeys** | WebAuthn, TOTP, magic links, OTP, one-tap, recovery codes |
| **Multi-tenancy** | Organizations, teams, roles, invitations, RBAC |
| **Enterprise** | SSO (SAML 2.0), SCIM provisioning, directory sync, OIDC provider mode, OAuth proxy |
| **API tokens** | API keys, JWTs, bearer auth, anonymous, multi-session |
| **AI agent auth** | MCP auth, token exchange, agent delegation |
| **Security** | HIBP (breached passwords), captcha, rate limiting, IP/geo blocking, suspicious-IP detection |
| **Payments integrations** | Stripe, Polar, Dub, Autumn, Dodo, Creem |
| **Observability** | Events/audit log, email validation, bot/abuse detection |

A non-trivial chunk of those are plugins you opt into via the `plugins: []` array — core auth works without any.

## Bring your own database

You pick the storage; the framework adapts. Both raw SQL and ORM adapters are supported:

| Type | Examples |
|---|---|
| **Native drivers** | better-sqlite3, `pg` (PostgreSQL), `mysql2/promise`, MongoDB |
| **ORMs** | Drizzle, Prisma, Kysely, MongoDB |
| **Mode** | Stateless (no DB) supported, but most plugins require persistence |

Bundle-size optimization: when using an ORM adapter, import from `better-auth/minimal` to drop the Kysely dependency.

## Framework adapters

First-class handlers for the frameworks most apps actually use:

```ts
// Next.js (App Router)
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { POST, GET } = toNextJsHandler(auth);
```

| Framework | Handler / Integration |
|---|---|
| **Next.js** | `toNextJsHandler`, `next-js` subpath |
| **SvelteKit** | `svelteKitHandler({ event, resolve, auth, building })` |
| **Nuxt** | h3 / nitro handler via `auth.handler(toWebRequest(event))` |
| **SolidStart** | `toSolidStartHandler` |
| **Remix / React Router** | pass `auth.handler(request)` from loader/action |
| **TanStack Start** | `auth.handler(request)` + `tanstackStartCookies` plugin |
| **Astro** | `auth.handler(ctx.request)` per method export |
| **Express / Fastify** | `toNodeHandler(auth)` (CommonJS unsupported) |
| **Hono** | mount via `app.on(["POST","GET"], "/api/auth/*", ...)` |
| **Elysia** | `app.all("/api/auth/*", ...)` |
| **Cloudflare Workers** | requires `nodejs_compat` (or `nodejs_als` if only ALS needed) |

Plus client SDKs per framework (`better-auth/react`, `better-auth/vue`, `better-auth/svelte`, `better-auth/solid`) and a vanilla `better-auth/client` variant.

## AI agent auth — the angle that matters for this repo

Better Auth explicitly markets an "Auth for AI agents" surface — primitives designed for the scenario where an agent (e.g. one built with [eve](../eve/README.md)) needs to call APIs on behalf of a user, or where one agent delegates a sub-task to another agent with scoped credentials.

The relevant primitives:

- **MCP auth** — `agent.auth()` style flows to authenticate to Model Context Protocol servers
- **Token exchange** — swap one credential for another (e.g. session cookie → API token)
- **Agent delegation** — scoped, short-lived credentials passed along an agent call chain

Concretely: when your eve agent wants to call Linear, GitHub, or Snowflake from inside a tool, and Vercel Connect brokers the connection but the user's role/permissions must be honored end-to-end, this is the seam where Better Auth plugs in.

## Quick start (Next.js)

```bash
npm install better-auth
```

`.env`:
```txt
BETTER_AUTH_SECRET=<openssl rand -base64 32>   # ≥ 32 chars, high entropy
BETTER_AUTH_URL=http://localhost:3000
```

Migration:
```bash
npx auth@latest migrate     # creates tables in your DB
```

Client:
```ts
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000", // optional: same origin as server
});

export const { signIn, signUp, useSession } = authClient;
```

## Managed infrastructure (optional)

For teams who don't want to self-host the extras, `dash.better-auth.com` offers:

- **Dashboard** — user management, session monitoring, organization oversight, user analytics
- **Audit logs** — auto-captured events, filter & search, configurable retention, SIEM drain
- **Sentinel** — real-time bot detection, brute-force protection, breached-password HIBP, impossible-travel checks, rate limiting, geo blocking, disposable-email filtering, free-trial-abuse signals
- **Enterprise add-ons** — self-service SSO, SCIM provisioning, directory sync, RBAC

Pricing lives at https://better-auth.com (per their "View Plans" CTA) — not surfaced in the docs root.

## When to consider Better Auth

Better Auth is worth a closer look if any of these are true:

- You're building a TS app and want **auth in code, not a vendor dashboard** — you keep the auth config in your repo, reviewable in PRs.
- You need **features beyond email/password** (2FA, passkeys, multi-tenant orgs, enterprise SSO, AI-agent auth) without stitching them together from separate libraries.
- You want **MIT, self-hostable** — no per-user MAU pricing.
- You're already on **Next.js / Nuxt / SvelteKit / Astro / Hono / TanStack Start** and want a typed adapter rather than a hand-rolled `/api/auth/*` route.
- **You're building with eve or another Vercel agent framework** and need auth primitives that understand MCP, agent delegation, and token exchange.

It is **less** interesting if:

- You're greenfield-prototyping and a hosted product like Clerk/Auth0 is genuinely faster to wire up.
- You're not on TypeScript — the codebase, CLI, and type inference are TS-first.
- You need a hosted UI / prebuilt login pages — Better Auth is server + client SDKs; the UI is your job.

## Caveats

- **Pre-release latest.** `v1.7.0-rc.1` is tagged as prerelease at time of writing; expect API surface shifts as it stabilizes.
- **CJS unsupported.** The Node-server integration is ESM-only — a gotcha for older Express/Fastify setups that haven't migrated.
- **Express v5 wildcard syntax.** With `path-to-regexp@6`, catch-alls must use `/{*any}` instead of `*`.
- **Cloudflare Workers needs `nodejs_compat`.** AsyncLocalStorage (used internally for async context tracking) won't work without it.
- **Acquisition signal.** "Better Auth is joining Vercel" is on the homepage; integration depth with Vercel's other surfaces (Connect, eve runtime, AI Gateway) is likely to change. Worth tracking the changelog if you depend on this.
- **Open issues are high (576)** — for a project at this stage, that's expected velocity but worth sampling before betting on a specific plugin.

## Repo signals

- 29,162 stars / 2,704 forks / 480 contributors
- 946 releases; cadence is rapid
- Created May 2024; activity ongoing
- Trusted-by mentions on the site: OpenAI, Databricks, Strapi

## Sources

- [better-auth.com](https://better-auth.com) — product page
- [better-auth/better-auth — GitHub](https://github.com/better-auth/better-auth) — repo + README
- [installation.mdx](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/installation.mdx) — setup guide for all supported frameworks
- [basic-usage.mdx](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/basic-usage.mdx) — using the auth instance
- [npm: better-auth](https://www.npmjs.com/package/better-auth) — package + install
