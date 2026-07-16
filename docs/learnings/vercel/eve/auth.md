# eve auth — two-system model

> **TL;DR.** eve has **two independent auth systems**: **route auth** (inbound — who can call your agent's HTTP routes, configured on the `eve` channel) and **connection auth** (outbound — how your agent signs in to external services like Linear MCP, handled by `@vercel/connect`). They never share state. Route auth is where better-auth plugs in; connection auth is not touched by better-auth at all.

See parent: [`./README.md`](./README.md) for the eve framework overview. See also: [`../better-auth/README.md`](../better-auth/README.md), [`../better-auth/cli.md`](../better-auth/cli.md).

---

## The two-system split — read this first

| | Route auth (inbound) | Connection auth (outbound) |
|---|---|---|
| **Where it runs** | `agent/channels/eve.ts` (the `eve` channel factory) | `agent/connections/*.ts` definitions + Vercel Connect runtime |
| **What it answers** | "Is this HTTP caller allowed to reach my agent?" | "How does my agent sign in to an external service?" |
| **When it fires** | Before any model work, on the channel walk | When a tool/connection actually reaches out |
| **Default state** | Fails closed — production browser traffic rejected unless configured | Static token by default; OAuth via Vercel Connect when configured |
| **Auth provider** | Your choice (better-auth, Clerk, Auth.js, custom) | Vercel Connect (declarative; providers like Linear/GitHub/Slack/Salesforce/etc.) |
| **Code surface** | `AuthFn[]` walked in order | `auth: connect("provider/project")` per connection |

The two systems are deliberately decoupled: a user authenticated by route auth does not automatically authorize every connection. Each connection decides independently whether its token should be **app-scoped** (one shared credential keyed across all sessions) or **user-scoped** (per-caller OAuth). User-scoped connections depend on route auth having resolved a real `principalType: "user"` on the session.

---

## Route auth — the inbound side

### The auth walk

`agent/channels/eve.ts` exports an `eveChannel({ auth })` config. `auth` is either a single `AuthFn` or an array. The runtime walks the array in order, and each entry does one of:

| Outcome | Effect |
|---|---|
| Returns a `SessionAuthContext` | Accept the request, stop the walk |
| Returns `null` or `undefined` | Skip to the next entry |
| Throws `UnauthenticatedError` / `ForbiddenError` | Reject with `401` / `403` and stop |

If every entry skips, the request gets a `401`. An empty `auth: []` rejects everything.

```ts
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [localDev(), vercelOidc()],
});
```

`GET /eve/v1/health` is always public — load balancers and uptime probes skip the walk entirely.

### Shipped helpers (`eve/channels/auth`)

| Helper | When to use |
|---|---|
| `localDev()` | Local development. Loopback-only (`localhost`, `127.0.0.0/8`, `::1`). Trusts the request hostname — **never run alone in production**. |
| `vercelOidc()` | Vercel deployments + Vercel-to-Vercel callers. Verifies a Vercel OIDC bearer JWT. Use `vercelSubject({...})` to admit tokens from other projects with controlled patterns. |
| `none()` | Explicitly accept anonymous traffic (use as the final entry — never mid-array). |
| `httpBasic(creds)` | Operator / service access via shared username/password. |
| `jwtHmac({...})` | You control a shared-secret JWT signer (HS256/384/512). |
| `jwtEcdsa({...})` | You verify asymmetric JWTs (ES256/384/512). |
| `oidc({...})` | Any OIDC issuer (Auth0, Keycloak, your own IdP). |

For **almost every production deployment**, you'll want **one custom `AuthFn`** (better-auth, Clerk, Auth.js — your choice) sitting **ahead of** the catch-all helpers, so unrecognized callers fall through to them rather than failing immediately.

### Custom `AuthFn` — the seam where better-auth plugs in

```ts
import type { AuthFn } from "eve/channels/auth";

function myAppAuth(): AuthFn<Request> {
  return async (request) => {
    const session = await mySessionProvider(request);
    if (!session) return null;       // skip → fall through
    return {
      authenticator: "my-app",       // arbitrary identifier
      principalType: "user",         // 'user' | 'machine' | 'app'
      principalId: session.userId,
      subject: session.userId,
      attributes: {                  // arbitrary, exposed as `ctx.session.auth.current.attributes`
        email: session.email,
        orgId: session.orgId,
      },
    };
  };
}
```

Rejection is precise — throw `UnauthenticatedError` or `ForbiddenError` from `eve/channels/auth` instead of returning `null` when you want to short-circuit.

### What reaches `ctx.session.auth`

The result of the walk is captured on the durable session and exposed to every tool, subagent, and dynamic instruction via `ctx.session.auth`:

- `ctx.session.auth.current` — the caller on the active inbound turn
- `ctx.session.auth.initiator` — the caller that started the session (pinned for the session's lifetime; not updated by follow-ups)

Both are `null` only on internal runtime paths (e.g. subagents that never went through an authored route). HTTP traffic always populates `auth.current`.

Use `auth.current.attributes` (the free-form object you set) to scope tools, resolve dynamic capabilities per principal, or enforce tenant boundaries. **There is no second per-session ownership ACL stacked on top of route auth** — access is decided at the HTTP boundary.

### `placeholderAuth()` — the scaffold's guardrail

`eve init` ships with:

```ts
auth: [localDev(), vercelOidc(), placeholderAuth()]
```

In production, `placeholderAuth()` returns a structured `401` so a generated web chat can show "auth isn't configured yet" instead of throwing an internal error. **Replace it before any browser caller hits production.** Delete the file entirely and eve falls back to the framework default `[localDev(), vercelOidc()]`, which also rejects production browser traffic.

---

## Connection auth — the outbound side

Outbound is handled by **`@vercel/connect`**, not by better-auth and not by anything in the `eve` channel. The pattern is:

```ts
// agent/connections/linear.ts
import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://mcp.linear.app/mcp",
  description: "Linear: project management, issue tracking, and team workflows.",
  auth: connect("linear/myagent"),       // Vercel Connect OAuth
  approval: once(),                      // human-in-the-loop on first call
});
```

Vercel Connect brokers the OAuth flow (consent, encrypted token storage, refresh) and `eve` re-attaches the credentials to outbound tool calls. Tokens are resolved and cached per workflow step — they never land in conversation history, never reach the model.

Two scopes are available on a connection:

| Scope | `principalType` | Token lifecycle |
|---|---|---|
| **App** (default for `connect()`) | `"app"` | Non-interactive; one shared credential. Use when the agent should act as itself. |
| **User** | `"user"` | Interactive OAuth; each user authorizes once, token acts on their behalf. Requires a real `principalType: "user"` to already be on the session (i.e. route auth resolved a user). |

Setting `principalType: "user"` on a connection that runs from a schedule, `localDev()`, or other internal runtime path fails with `reason: "principal_required"` — by design.

For deeper reading: see [eve.dev/docs/connections](https://eve.dev/docs/connections).

---

## Plugging better-auth into route auth

Better-auth fits the `AuthFn` slot cleanly. The standard surface is `auth.api.getSession({ headers })`, which reads the cookie/bearer from the request and returns the active session or `null`.

### Sketch

```ts
// lib/auth.ts — your better-auth instance
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: /* pg / sqlite / drizzle / prisma */,
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId:     process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  plugins: [
    /* twoFactor(), passkey(), organization() — whatever you need */
  ],
});
```

```ts
// agent/channels/eve.ts
import { eveChannel } from "eve/channels/eve";
import {
  localDev,
  vercelOidc,
  type AuthFn,
} from "eve/channels/auth";
import { auth } from "@/lib/auth";

const betterAuthFn: AuthFn<Request> = async (request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;

  return {
    authenticator: "better-auth",
    principalType: "user",
    principalId: session.user.id,
    subject: session.user.id,
    attributes: {
      email: session.user.email,
      name:  session.user.name,
      // Add organization/role/etc. here if you use the organization plugin.
    },
  };
};

export default eveChannel({
  auth: [betterAuthFn, localDev(), vercelOidc()],
});
```

Order matters: your app's auth comes first, the helpers catch-all at the end. Anything your authenticator doesn't recognize falls through to `localDev()` / `vercelOidc()` rather than failing closed.

### What better-auth gives you for free

- **Server session verification** via `auth.api.getSession({ headers })` — same pattern works for both cookie-based browser sessions and bearer tokens.
- **Multi-token types** — session tokens, API keys, M2M tokens, OAuth tokens. Each can be mapped to a different `principalType` (`user` / `machine`) in your `AuthFn`, mirroring the pattern the [Clerk integration doc](https://clerk.com/docs/guides/ai/eve/custom-channel-auth) demonstrates.
- **Plugin-derived attributes** — the `organization` plugin gives you `orgId`, `role`, `permissions`; `twoFactor` gives you verified-2FA flags. Surface these on `attributes` so downstream tools can read them via `ctx.session.auth.current.attributes.orgId`.
- **CLI scaffolding** — `npx @better-auth/cli@latest init` (Next.js + SQLite today, hand-roll otherwise). See [`../better-auth/cli.md`](../better-auth/cli.md).

### `@vercel/connect/betterauth` — first-class adapter

Vercel's launch post for [Vercel Connect](https://vercel.com/blog/introducing-vercel-connect) explicitly lists a `@vercel/connect/betterauth` adapter — so a better-auth instance plugs into Vercel Connect's credential-exchange layer the same way Clerk/Auth.js do. That makes the **two auth systems line up cleanly**: better-auth owns inbound, Vercel Connect (via the better-auth adapter) owns outbound. Both Vercel projects, same mental model.

The actual adapter source wasn't surfaced via the public docs page — the page that lists it (`vercel.com/better-auth/better-auth-docs/connect`) renders as navigation chrome only. If you need the exact API surface before wiring, the package source on the `@vercel/connect` or `vercel/connect` repo is the authoritative source.

---

## Security checklist (from eve's docs)

A handful of warnings the eve authors surface repeatedly — worth honoring in this template:

1. **`localDev()` trusts the request hostname.** An attacker that can inject a `Host` header (no normalizing proxy in front of origin) can spoof loopback. Always layer a real authenticator on top.
2. **`vercelOidc()` with `external_sub`** only works when `VERCEL_PROJECT_ID` is set. A deployment that hasn't pinned its project rejects external callers.
3. **Wildcard `subjects`** in `vercelOidc()` are footguns — use `vercelSubject({...})` to build the pattern; typos silently reject, over-broad `*` silently admits.
4. **Never ship `placeholderAuth()` to production.** It's a scaffold-only guardrail.
5. **Route auth does not enforce session ownership.** If multiple users/tenants can reach the same route, you implement the per-user/tenant/session authorization on top.
6. **`principalType: "user"` on a connection is not "ask a human later."** It's "key this credential to the user already authenticated on the eve session." Schedules and internal runtimes that lack a user principal fail with `reason: "principal_required"`.

---

## What to read next

- [eve.dev/docs/connections](https://eve.dev/docs/connections) — connection auth shapes, app vs user scope, approval flow
- [Introducing Vercel Connect](https://vercel.com/blog/introducing-vercel-connect) — the runtime credential-exchange model eve's connection auth is built on
- [`../better-auth/README.md`](../better-auth/README.md) — framework overview, framework adapters, plugin list
- [`../better-auth/cli.md`](../better-auth/cli.md) — `npx auth@latest init` for scaffolding
- [Auth and route protection (eve)](https://eve.dev/docs/guides/auth-and-route-protection) — the canonical eve guide this doc condenses

---

## Sources

- [eve.dev/docs/connections](https://eve.dev/docs/connections) — connection auth model, app vs user scope, OAuth flow
- [eve auth-and-route-protection guide](https://eve.dev/docs/guides/auth-and-route-protection) — the canonical inbound-auth guide
- [Introducing Vercel Connect](https://vercel.com/blog/introducing-vercel-connect) — runtime credential exchange, `@vercel/connect/betterauth` mention
- [Custom channel auth — Clerk + eve](https://clerk.com/docs/guides/ai/eve/custom-channel-auth) — the `AuthFn` shape reference (used here as a template, with better-auth as the actual provider)
- [better-auth.com/docs/authentication/vercel](https://better-auth.com/docs/authentication/vercel) — Vercel as OAuth provider *inside* better-auth (inverse direction from this doc; useful if you want "Sign in with Vercel" as a social provider)
