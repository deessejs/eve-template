# eve-template

[![CI](https://github.com/deessejs/eve-template/actions/workflows/ci.yml/badge.svg)](https://github.com/deessejs/eve-template/actions/workflows/ci.yml)
[![CodeQL](https://github.com/deessejs/eve-template/actions/workflows/codeql.yml/badge.svg)](https://github.com/deessejs/eve-template/security/code-scanning)
[![License](https://img.shields.io/github/license/deessejs/eve-template)](./LICENSE)
[![Node](https://img.shields.io/badge/node-24.x-339933)](./package.json)
[![eve](https://img.shields.io/badge/eve-0.24.4-000)](./package.json)

> A starter template for shipping a **production-ready eve agent** with a **web chat UI** — clone, install, run, in under a minute.

[eve](https://eve.dev) is the open-source framework from [Vercel](https://vercel.com) for building, running, and scaling durable AI agents. This template gives you an opinionated scaffold: the canonical eve `agent/` directory plus a Next.js web channel (shadcn/ui + Vercel AI Elements) wired and deployable on Vercel out of the box.

## Prerequisites

- **Node.js 24.x** — `fnm use 24` (or `nvm use 24`). Tested on Node 22 too, but `package.json#engines` pins 24.x.
- **npm 10+** (ships with Node 24).
- Optional: the [Vercel CLI](https://vercel.com/docs/cli) for deployment.

## Quick start

```bash
# 1. Clone (or use this template via the GitHub UI)
git clone https://github.com/deessejs/eve-template.git my-agent
cd my-agent

# 2. Install
npm install

# 3. Run the dev server (Next.js UI + eve agent runtime, hot-reload)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start chatting with the agent.

Two surfaces run side-by-side in dev:

| Surface | URL | Source |
|---|---|---|
| **Web chat UI** | `/` | `app/` (Next.js) |
| **Agent runtime** | `/_eve_internal/eve/*` | `agent/` (eve framework) |

The frontend speaks to the agent over same-origin internal routes — no CORS, no extra env vars.

## What's included

- **eve agent scaffold** — the canonical `agent/` directory (filesystem-first: a tool is a `.ts` file in `tools/`, a skill is a `.md` file in `skills/`)
- **Next.js 16 web channel** — App Router, React 19, Tailwind v4
- **shadcn/ui + Vercel AI Elements** — `Conversation`, `Message`, `PromptInput`, `CodeBlock`, `Reasoning`, etc.
- **Streaming markdown** — Streamdown + Shiki for code highlighting
- **Durable execution, sandboxed compute, OpenTelemetry traces, evals** — all baked into eve
- **Multi-channel ready** — Slack, Discord, Teams, etc. via `eve channels add <name>`
- **Self-hostable** — Postgres-backed durability, Docker sandbox; managed runtime is optional

## Project layout

```
.
├── agent/                      # 🧠 the eve agent (the part that *thinks*)
│   ├── agent.ts                # model + runtime config
│   ├── instructions.md         # system prompt (always-on)
│   └── channels/
│       └── eve.ts              # web channel: 3 auth providers stacked
├── app/                        # 🎨 the Next.js web UI (the part the *user sees*)
│   ├── layout.tsx
│   ├── page.tsx                # renders <AgentChat />
│   ├── globals.css
│   └── _components/
│       ├── agent-chat.tsx      # uses useEveAgent()
│       └── agent-message.tsx
├── components/
│   ├── ui/                     # 12 shadcn primitives
│   └── ai-elements/            # 8 Vercel AI Elements
├── lib/
│   └── utils.ts                # shadcn `cn()` helper
├── docs/
│   └── learnings/vercel/eve/README.md   # deep dive on how eve works
├── next.config.ts              # wraps withEve()
├── vercel.json                 # two services: web (Next) + eve (agent)
├── tsconfig.json
├── components.json             # shadcn config (new-york style)
├── postcss.config.mjs          # Tailwind v4
├── AGENTS.md                   # instruction file for AI coding agents
├── CLAUDE.md                   # @AGENTS.md
└── package.json                # deps: eve, ai, next, react, shadcn, …
```

## Customizing your agent

The agent lives entirely in `agent/`. The framework wires up everything you put there.

### Who the agent is

Edit [`agent/instructions.md`](./agent/instructions.md) — this is the always-on system prompt. Plain Markdown.

### What model it runs on

Edit [`agent/agent.ts`](./agent/agent.ts):

```ts
import { defineAgent } from "eve";

export default defineAgent({
  model: "anthropic/claude-sonnet-5",  // any model supported by AI Gateway
});
```

Provider fallbacks are supported through the AI Gateway.

### What it can do — give it a tool

Drop a TypeScript file in `agent/tools/`. The filename becomes the tool name — no registration needed.

```ts
// agent/tools/get_weather.ts
import { defineTool } from "eve/tools";
import z from "zod";

export default defineTool({
  description: "Get the weather for a city",
  inputSchema: z.object({ city: z.string() }),
  async execute({ city }) {
    /* ... */
  },
});
```

For a dangerous action, add `needsApproval`:

```ts
async execute({ sql }) { /* ... */ },
needsApproval: ({ toolInput }) => estimateScanGb(toolInput.sql) > 50,
```

### What it knows — give it a skill

Drop a Markdown file in `agent/skills/`. Skills are loaded only when relevant, so the model doesn't carry them in every prompt.

```md
---
name: research
description: Research unfamiliar topics
---

When the task is novel or ambiguous, gather evidence first, then answer.
```

### Delegate — subagents

Add a directory under `agent/subagents/` with its own `agent.ts` and `instructions.md`. The parent calls it like a tool; the child runs in a fresh context window.

### Run on a schedule

A schedule is one more file in `agent/schedules/` (cron + handler). On Vercel, each one deploys as a Vercel Cron Job.

## Branching model

This template uses a two-stage integration flow. **Pull requests always target
`staging`, never `main`.**

```
feature/<name> ──PR──> staging ──ship──> release/v<X.Y.Z> ──PR──> main
                                                                   │
                                                            gh release create
                                                            (agent-driven)
```

- **`feature/<name>`** — your branch. Open against `staging`.
- **`staging`** — integration branch. Features accumulate here before a release.
- **`release/v<X.Y.Z>`** — short-lived branch cherry-picked from selected
  PRs on `staging`, opened against `main` by the
  [`ship`](./.claude/skills/ship/SKILL.md) skill.
- **`main`** — production-ready. Each merge triggers a `v<X.Y.Z>` tag and
  GitHub Release, generated by the
  [`release`](./.claude/skills/release/SKILL.md) skill.

Every PR must include a `.changeset/<name>.md` file declaring the version
bump (`patch` | `minor` | `major`). The release skill consumes it to
determine the next version. See [`.changeset/README.md`](./.changeset/README.md)
for details.

For the full contributor workflow, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Adding channels

The web channel is wired by default. To expose the same agent elsewhere:

```bash
eve channels add slack
eve channels add discord
eve channels add teams
```

Each command writes a single file under `agent/channels/` that ships like any other code change. The same agent now answers in Slack, Discord, and the web — one agent, many surfaces.

## Sandbox and connections

- **Sandbox** — add `agent/sandbox/sandbox.ts` to swap in your own backend. Defaults to Vercel Sandbox in production, Docker locally.
- **Connections** — add `agent/connections/<service>.ts` to connect to MCP servers, OAuth services, or any OpenAPI-described API. Auth is brokered via Vercel Connect; the model never sees credentials.

## Deployment

```bash
# One command, deploys both services (web + eve runtime)
vercel deploy
```

`vercel.json` declares both services: the Next.js web UI on `/` and the eve runtime on `/_eve_internal/eve`. No dashboard setup required — the same agent you tested locally is reachable at a public URL after deploy.

### ⚠️ Before you deploy

The default `agent/channels/eve.ts` ships with **`placeholderAuth()`** for browser requests. The placeholder won't allow browser traffic in production. Replace it with your auth provider before going public:

```ts
// example: drop in a custom AuthFn wired to your auth provider.
// better-auth is preferred for this template — see
// docs/learnings/vercel/eve/auth.md for the working sketch.
// Auth.js / Clerk / `none()` are also valid alternatives.
import { none } from "eve/channels/auth";
```

Or call `eve channels add web --auth=clerk` to regenerate with a real provider (better-auth currently requires a hand-written channel file).

## Authentication

This template is **login-only**: no public sign-up, no social sign-in. Users are created via CLI by an admin. The first admin bootstraps via better-auth's `create-admin`; subsequent users (admin or non-admin) are added via `scripts/create-user.mjs`.

### Bootstrap the first admin

After the first deploy (or after running migrations locally), create the first admin:

```bash
bash scripts/create-admin.sh \
  --email admin@your-domain.com \
  --password 'something-strong-here' \
  --name "Admin"
```

The script sources `.env` (or `.env.local`) and invokes `npx auth@1.7.0-rc.1 create-admin` with the rest. Pinned to the RC because `auth@latest` is `1.6.23` on npm and lacks `create-admin`. Flags: `--role`, `--data`, `--no-email-verified`, `--force / -y`.

### Add non-admin users

Once the first admin exists, add regular users (or more admins):

```bash
node --env-file=.env scripts/create-user.mjs \
  --email alice@your-domain.com \
  --name "Alice" \
  --password 'something-strong-here' \
  --role user
```

Uses better-auth's `auth.api.createUser` server API, which (per `commit f2520f95`) works without an active admin session when called from a server-only context.

### Sign-in flow

1. User opens `/login` and submits email + password via `authClient.signIn.email`.
2. better-auth sets the session cookie (`httpOnly`, `secure`, `sameSite=lax`).
3. `proxy.ts` checks for the cookie at the edge and redirects anonymous users to `/login` (fast, no DB hit).
4. `app/(authenticated)/layout.tsx` re-validates the session against the database (the **real security boundary** — cookie-only is forgeable).
5. User lands on the chat at `/`.

Sign out: click the **Sign out** button in the chat header (top-right).

### Where the auth pieces live

| File | Role |
|---|---|
| `lib/auth.ts` | better-auth instance (`drizzleAdapter` + `admin` + `emailAndPassword` + before-hook closing `/sign-up/*`) |
| `lib/auth-client.ts` | Browser-side `authClient` with `adminClient` plugin |
| `lib/eve-auth.ts` | eve `AuthFn` adapter: `auth.api.getSession({ headers })` → `SessionAuthContext` |
| `app/api/auth/[...all]/route.ts` | Catch-all HTTP handler (`toNextJsHandler(auth)`) |
| `app/(authenticated)/layout.tsx` | Server-side auth check (real boundary) |
| `app/login/page.tsx` | Email/password form |
| `components/sign-out-button.tsx` | Sign out button (chat header) |
| `proxy.ts` | Edge cookie check (redirect optimization — **not** security) |
| `agent/channels/eve.ts` | Auth chain: `[betterAuthFn, vercelOidc(), localDev()]` |
| `scripts/create-admin.sh` | Bootstrap first admin (calls `npx auth create-admin`) |
| `scripts/create-user.mjs` | Add non-admin users (calls `auth.api.createUser`) |
| `.env.example` | Required env vars (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) |

### Notes

- **Sign-up endpoint is closed** via `emailAndPassword.disableSignUp: true` + a before-hook that rejects any future `/sign-up/*` request — belt-and-suspenders against plugins re-opening it.
- **Email verification is off by default.** Admin vetting at user-creation time is the verification layer for this template. If you later add a self-service signup path, you'll need a transactional email provider and `requireEmailVerification: true` — at which point revisit the threat model.
- **Two-layer auth check.** `proxy.ts` is for redirect UX (fast, no DB); `(authenticated)/layout.tsx` is the security boundary (DB hit, real validation). Anyone can forge a cookie, but they still won't get past the layout.
- **eve agents and the web UI share the same session cookie.** A logged-in user on `/` can call `POST /eve/v1/session` because `betterAuthFn` resolves them via the same `getSession({ headers })` call.

For deeper context on the auth model and security warnings, see [`docs/learnings/vercel/eve/auth.md`](./docs/learnings/vercel/eve/auth.md) and the [integration plan](./docs/plans/drizzle-better-auth-integration.md).

## Chat sessions

The chat surface ships with a left-rail sidebar that lists every conversation the signed-in user has started. The list, the events, and the durable eve cursor all live in **our** database — eve does not expose a "list my sessions" API.

**Data model** — two new tables live alongside the better-auth ones:

- `conversation` — one row per thread, scoped by `userId` (FK to `user.id`, cascade). Carries the eve-side handles (`eveSessionId`, `eveContinuationToken`, `eveStreamIndex`) plus UX fields (`title`, `preview`, `messageCount`, `pinned`, `archivedAt`).
- `conversation_event` — append-only log of eve stream events, indexed by `(conversationId, sequence)`. A `UNIQUE (conversationId, eventId)` constraint absorbs duplicate inserts from network retries.

**API surface** — eight routes under `/api/conversations/*` (list / create / get / patch / delete / eve-state / events POST batch / events GET cursor). Every route filters by the verified `userId` from `requireUser()`; no row is ever visible to a different user. POST/PATCH/DELETE require a same-origin request (origin check against `NEXT_PUBLIC_BETTER_AUTH_URL`).

**URL is the truth** — the chat page at `/?c=<conversationId>` reads the `c` query parameter and loads the conversation server-side. The `useEveAgent()` hook receives `initialSession` and `initialEvents` so reload / deep-link / back-button work without losing context. The React `key` on the page remounts the hook on thread switch, mirroring the `eve/react` documentation.

**Sidebar UI** — built on the official shadcn `sidebar` primitive (`npx shadcn@latest add sidebar`). Sits inside the `(with-sidebar)/` route group so it does not leak onto future sibling pages (e.g. `settings/sessions` from issue #3). Footer carries the existing `SignOutButton` unchanged. ⌘B toggles the rail.

**Event persistence** — the client coalesces events into batched POSTs (500 ms or 50 events, whichever first) and the route uses `ON CONFLICT DO NOTHING` to absorb duplicates. Per-event size cap: 256 KB; unknown event types are dropped client-side with a `console.warn`. Subagent `childSessionId`s are not persisted as their own rows (see `eve/docs/concepts/sessions-runs-and-streaming.md`).

For the implementation spec, see [`docs/plans/5.md`](./docs/plans/5.md).

## Testing with evals

```bash
eve eval              # local
eve eval --prod       # against the deployed agent
```

`defineEval` checks written like tests:

```ts
import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  async test(t) {
    await t.send("What was revenue last week?");
    t.completed();
    t.calledTool("run_sql");
    t.check(t.reply, includes("net of refunds"));
  },
});
```

Wire into CI to make eval failures block deploys.

## Coding agents

Both [Claude Code](https://claude.com/claude-code) and other agents can work in this repo out of the box:

- `AGENTS.md` — coding-agent conventions; points at the eve docs bundled in `node_modules/eve/docs/`
- `CLAUDE.md` — imports `AGENTS.md` for Claude Code
- A preconfigured `.claude/agents/tech-lead/` shared agent definition

For anything new — a tool, a channel, a subagent — read `node_modules/eve/docs/` first, then write the code.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server (UI + eve runtime, hot-reload) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` |
| `npm run dev:eve` | Start only the eve TUI/runner (`eve dev`) |
| `npm run build:eve` | Build only the eve runtime |
| `npm run start:eve` | Run only the eve runtime |

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Acknowledgements

Built on top of [eve](https://eve.dev) by [Vercel](https://vercel.com). UI primitives from [shadcn/ui](https://ui.shadcn.com) and [Vercel AI Elements](https://vercel.com/blog/ai-elements). Streaming via [Streamdown](https://github.com/vercel/streamdown); code highlighting via [Shiki](https://shiki.style).
