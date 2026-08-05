<p align="center">
  <h1 align="center">eve-template</h1>
</p>

<p align="center">
  <strong>A starter scaffold for shipping a production-ready <a href="https://eve.dev">eve</a> agent with a web chat UI — clone, install, run, in under a minute.</strong> The canonical <code>agent/</code> directory plus a Next.js 16 web channel (shadcn/ui + Vercel AI Elements) wired and deployable on Vercel out of the box.
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/deessejs/eve-template" alt="License"></a>
  <a href="https://github.com/deessejs/eve-template/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/deessejs/eve-template/ci.yml?label=CI" alt="CI"></a>
  <a href="https://github.com/deessejs/eve-template/actions/workflows/codeql.yml"><img src="https://img.shields.io/github/actions/workflow/status/deessejs/eve-template/codeql.yml?label=CodeQL" alt="CodeQL"></a>
  <a href="https://github.com/deessejs/eve-template"><img src="https://img.shields.io/badge/node-24.x-339933" alt="Node"></a>
  <a href="https://eve.dev"><img src="https://img.shields.io/badge/eve-0.24.4-000" alt="eve"></a>
</p>

<p align="center">
  <a href="https://github.com/deessejs/eve-template"><img src="https://img.shields.io/badge/deessejs-eve--template-blue" alt="Repository"></a>
</p>

> **Note:** [eve](https://eve.dev) is the open-source framework from [Vercel](https://vercel.com) for building, running, and scaling durable AI agents. This template gives you an opinionated scaffold on top of it — one command deploys both the Next.js web UI and the eve agent runtime.

---

## What is included

| Layer                                                                              | What you get                                                                                                       | Why it matters                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **`agent/` directory**                                                             | `agent/agent.ts` (model + runtime config), `agent/instructions.md` (system prompt), `agent/channels/eve.ts`.       | The canonical eve scaffold — production-ready agent out of the box.             |
| **Filesystem-first extensibility**                                                 | Drop a `.ts` file in `agent/tools/`, a `.md` in `agent/skills/`, a folder in `agent/subagents/`, a file in `agent/schedules/`. | No registration, no central config — the framework wires everything up from disk. |
| **Multi-channel support**                                                          | `eve channels add slack\|discord\|teams` ships a channel file under `agent/channels/`.                            | One agent, many surfaces — web, Slack, Discord, Teams.                         |
| **Next.js 16 web UI**                                                              | App Router, React 19, Tailwind v4, 12 shadcn/ui primitives (new-york style), 8 Vercel AI Elements.                  | Modern chat UI primitives with streaming markdown (Streamdown + Shiki).         |
| **Login-only auth (better-auth + Drizzle)**                                        | Email/password, signup closed, admin-vetted onboarding via CLI scripts, two-layer auth boundary.                  | Safe defaults — no public sign-up, no OAuth footguns.                          |
| **Sandboxed compute + durable execution + OTel + evals**                           | Postgres-backed durability, Docker sandbox locally / Vercel Sandbox in prod, OpenTelemetry traces, `eve eval` runner. | Reliability and observability baked into eve, no extra setup.                   |
| **Direct provider (no AI Gateway)**                                               | Default model `minimax("MiniMax-M3")` via `vercel-minimax-ai-provider` (Anthropic-compatible).                      | One-line swap to AI Gateway, OpenAI-compatible, or any Vercel AI SDK provider. |
| **Two services, one deploy**                                                       | `vercel.json` declares both `web` (Next.js, route prefix `/`) and `eve` (route prefix `/_eve_internal/eve`).       | `vercel deploy` ships both — no dashboard config.                              |
| **Smoke-tested**                                                                   | Vitest suite asserting canonical file layout, package.json contracts, and imports of `lib/auth`, `lib/eve-auth`, `agent/agent`, `db/schema/auth`. | A broken scaffold fails CI before it ships.                                     |

## Why this template

- **Simple by default.** No class hierarchies, no central tool registry, no decorators. Just a directory layout and a `defineAgent({ model })` call.
- **ESM + Node 24.x.** Modern packaging, no CJS shim. `package.json#type: "module"`, `engines.node: "24.x"`.
- **Minimal runtime.** The only framework dependency is `eve`. UI primitives come from `shadcn/ui` and `ai-elements`.
- **TypeScript first-class.** Strict types, no `any` leakages. `tsconfig.json` is `strict: true`, `module: esnext`, `moduleResolution: Bundler`.
- **Real testing.** Vitest with structural smoke tests, not just type-only.
- **One-command deploy.** Both services deploy with a single `vercel deploy`.
- **Agent-driven release flow.** Releases are not GitHub-Actions-driven — the `ship` and `release` Claude agent skills orchestrate merges, tags, and GitHub Releases.

## Quick start

### Prerequisites

- **Node.js 24.x** — `fnm use 24` (or `nvm use 24`). `package.json#engines` pins 24.x.
- **npm 10+** (ships with Node 24).
- Optional: the [Vercel CLI](https://vercel.com/docs/cli) for deployment.
- Optional: a Postgres database (local Docker, [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres), or [Neon](https://neon.tech)) for the auth database.

### Install

```bash
# 1. Clone (or use this template via the GitHub UI)
git clone https://github.com/deessejs/eve-template.git my-agent
cd my-agent

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# fill in DATABASE_URL, BETTER_AUTH_SECRET, MINIMAX_API_KEY (see .env.example for details)

# 4. Run the dev server (Next.js UI + eve agent runtime, hot-reload)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Two surfaces run side-by-side in dev:

| Surface          | URL                       | Source                    |
| ---------------- | ------------------------- | ------------------------- |
| **Web chat UI**  | `/`                       | `app/` (Next.js)          |
| **Agent runtime**| `/_eve_internal/eve/*`    | `agent/` (eve framework)  |

The frontend speaks to the agent over same-origin internal routes — no CORS, no extra env vars.

After the first start, bootstrap the first admin:

```bash
bash scripts/create-admin.sh \
  --email admin@your-domain.com \
  --password 'something-strong-here' \
  --name "Admin"
```

Add subsequent users (admin or non-admin):

```bash
node --env-file=.env scripts/create-user.mjs \
  --email alice@your-domain.com \
  --name "Alice" \
  --password 'something-strong-here' \
  --role user
```

### Usage

Define the agent:

```ts
// agent/agent.ts
import { defineAgent } from "eve";
import { minimax } from "vercel-minimax-ai-provider";

export default defineAgent({
  model: minimax("MiniMax-M3"),
});
```

Give it a tool — drop a file in `agent/tools/`, the filename becomes the tool name:

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

Give it a skill — drop a Markdown file in `agent/skills/`, loaded only when relevant:

```md
---
name: research
description: Research unfamiliar topics
---

When the task is novel or ambiguous, gather evidence first, then answer.
```

Edit the system prompt directly:

```md
<!-- agent/instructions.md -->
# Identity

You are a helpful assistant.
```

Add a subagent:

```
agent/subagents/<name>/
├── agent.ts            # parent calls this like a tool, child runs in a fresh context window
└── instructions.md
```

Add a schedule (one file, becomes a Vercel Cron Job on deploy):

```ts
// agent/schedules/daily_digest.ts
import { defineSchedule } from "eve/schedules";

export default defineSchedule({
  cron: "0 9 * * *",
  async run() {
    /* ... */
  },
});
```

Add a channel:

```bash
eve channels add slack     # writes agent/channels/slack.ts
eve channels add discord   # writes agent/channels/discord.ts
eve channels add teams     # writes agent/channels/teams.ts
```

The same agent now answers in Slack, Discord, and the web — one agent, many surfaces.

### Engine compatibility

| Runtime       | Minimum version |
| ------------- | --------------- |
| Node.js       | 24.x            |
| npm           | 10+             |
| TypeScript    | 6.x (dev)       |
| Postgres      | 14+             |
| Vercel CLI    | 38+ (optional)  |

ESM-only. The package declares `"type": "module"`. Consumers using a CJS resolver need dynamic `import()` or to migrate to ESM.

## Available commands

### Package: `eve-template`

| Command                  | What it does                                                 |
| ------------------------ | ------------------------------------------------------------ |
| `npm run dev`            | Start Next.js dev server (UI + eve runtime, hot-reload).     |
| `npm run build`          | Production build.                                            |
| `npm run start`          | Run the production build.                                    |
| `npm run typecheck`      | `tsc --noEmit -p tsconfig.json`.                             |
| `npm run lint`           | Run ESLint.                                                  |
| `npm run test`           | Run Vitest once (`vitest run`).                              |
| `npm run test:watch`     | Run Vitest in watch mode.                                    |
| `npm run build:eve`      | Build only the eve runtime (`eve build`).                    |
| `npm run dev:eve`        | Start only the eve TUI/runner (`eve dev`).                   |
| `npm run start:eve`      | Run only the eve runtime.                                    |

## Compatibility

### Environment variables

Required (see `.env.example` for full documentation):

| Variable                       | Required       | Notes                                                                                                                                                                  |
| ------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Yes            | Postgres connection string. Used by `db/index.ts`, `lib/auth.ts`, `scripts/create-user.mjs`.                                                                          |
| `BETTER_AUTH_SECRET`           | Yes            | ≥32-char high-entropy secret for cookie signing, password hashing salts, CSRF tokens. Generate with `openssl rand -base64 32`.                                          |
| `BETTER_AUTH_URL`              | Yes            | Public origin of this app. Defaults to `http://localhost:3000` in dev. better-auth uses it for redirects and `allowedOrigins` checks.                                  |
| `NEXT_PUBLIC_BETTER_AUTH_URL`  | Yes            | Mirror of `BETTER_AUTH_URL` for the browser-side `authClient`. Must be `NEXT_PUBLIC_`-prefixed to be inlined into the client bundle.                                    |
| `MINIMAX_API_KEY`              | Yes (default)  | API key for `vercel-minimax-ai-provider`. Wraps MiniMax's direct Anthropic-compatible API at `https://api.minimaxi.io/anthropic/v1` — no Vercel AI Gateway involved.    |

Optional provider overrides: point `MINIMAX_API_KEY` at a different endpoint, or import `minimaxOpenAI` from `vercel-minimax-ai-provider` instead of `minimax` in `agent/agent.ts`.

### Peer / optional dependencies

No peer dependencies. This scaffold ships everything it needs.

Optional: any provider-compatible model accessible via the Vercel AI SDK, or a direct provider package like `vercel-minimax-ai-provider`. Swap the import in `agent/agent.ts` to switch models.

### CI / GitHub

| Workflow       | Trigger                                 | What it does                                                                                          |
| -------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ci.yml`       | PR + push to `main`/`staging`, manual   | Lint, type-check, test on Node 24.                                                                    |
| `codeql.yml`   | PR + push to `main`/`staging`, weekly    | CodeQL security-extended scan (TypeScript). Weekly Monday cron at 06:17 UTC.                          |

### Database

| Field                       | Value                  |
| --------------------------- | ---------------------- |
| Schema                      | Drizzle (`drizzle.config.ts`) |
| Adapter                     | `drizzleAdapter(db, { provider: "pg" })` |
| Driver                      | `pg` (node-postgres)   |
| Pool                        | Single shared `Pool` (`db/index.ts`) |
| SSL                         | `sslmode=verify-full` enforced (URL rewriting + Pool `ssl: { rejectUnauthorized: true }`) |
| Migrations                  | `db/migrations/` (generated via `drizzle-kit`) |

### Engines

| Field             | Value           |
| ----------------- | --------------- |
| `engines.node`    | `24.x`          |
| `type`            | `module`        |
| `packageManager`  | npm 10+         |

## Project structure

```
.
├── agent/                          # 🧠 the eve agent (the part that *thinks*)
│   ├── agent.ts                    # defineAgent({ model })
│   ├── instructions.md             # system prompt (always-on)
│   └── channels/
│       └── eve.ts                  # web channel: [betterAuthFn, vercelOidc(), localDev()]
├── app/                            # 🎨 the Next.js web UI (the part the *user sees*)
│   ├── layout.tsx                  # root layout (Geist + Geist Mono, TooltipProvider)
│   ├── globals.css
│   ├── login/
│   │   └── page.tsx                # email/password form (authClient.signIn.email)
│   ├── (authenticated)/            # server-side auth check (real security boundary)
│   │   ├── layout.tsx              # auth.api.getSession({ headers }) → redirect /login
│   │   └── page.tsx                # renders <AgentChat />
│   ├── api/auth/[...all]/route.ts  # better-auth HTTP handler (toNextJsHandler)
│   └── _components/
│       ├── agent-chat.tsx          # uses useEveAgent()
│       └── agent-message.tsx
├── components/
│   ├── ui/                         # 12 shadcn primitives (new-york style)
│   │   ├── badge, button, button-group, collapsible, command, dialog,
│   │   │   dropdown-menu, hover-card, input, input-group, select, separator,
│   │   │   spinner, textarea, tooltip
│   ├── ai-elements/                # 8 Vercel AI Elements
│   │   ├── chain-of-thought, code-block, conversation, message,
│   │   │   prompt-input, reasoning, shimmer, tool
│   └── sign-out-button.tsx
├── db/                             # Drizzle schema + migrations
│   ├── index.ts                    # Pool + drizzle(pool, { schema })
│   ├── schema/auth.ts              # user, session, account, verification
│   └── migrations/                 # 0000_init.sql (+ meta/)
├── lib/                            # auth wiring
│   ├── auth.ts                     # betterAuth({ drizzleAdapter, admin, emailAndPassword })
│   ├── auth-client.ts              # browser-side authClient (adminClient plugin)
│   ├── eve-auth.ts                 # betterAuthFn: eve AuthFn adapter
│   └── utils.ts                    # shadcn cn() helper
├── proxy.ts                        # Next.js 16 edge proxy (cookie redirect, not security)
├── scripts/                        # CLI bootstrap
│   ├── create-admin.sh             # first admin (npx auth@1.7.0-rc.1 create-admin)
│   └── create-user.mjs             # subsequent users (auth.api.createUser)
├── src/internal/
│   └── authored-module-map-loader.ts   # eve#92 shim, removed once PR #156 ships
├── tests/
│   └── smoke.test.ts               # vitest structural assertions
├── docs/
│   ├── learnings/                  # engineering notes (tooling, vercel)
│   │   ├── tooling/{changesets,codeql,dependabot,vitest}
│   │   └── vercel/{better-auth,drizzle,eve}
│   └── plans/
│       └── drizzle-better-auth-integration.md
├── .changeset/                     # changesets for versioning
│   ├── README.md
│   ├── config.json
│   └── v0.1.0.md                   # initial scaffold release
├── .claude/
│   ├── agents/tech-lead/           # shared agent definition
│   └── skills/                     # spec, implement, review-pr, create-pr, triage,
│       │                           # create-issue, ship, release
├── .github/
│   ├── workflows/{ci,codeql}.yml
│   ├── ISSUE_TEMPLATE/
│   ├── dependabot.yml
│   ├── CODEOWNERS
│   └── PULL_REQUEST_TEMPLATE.md
├── components.json                 # shadcn config (new-york style)
├── drizzle.config.ts
├── eslint.config.mjs
├── next.config.ts                  # wraps withEve()
├── postcss.config.mjs              # Tailwind v4
├── vercel.json                     # two services: web + eve
├── vitest.config.ts
├── tsconfig.json                   # strict, paths: { "@/*": ["./*"] }
├── .env.example
├── AGENTS.md                       # coding-agent conventions
├── CLAUDE.md                       # @AGENTS.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── SUPPORT.md
├── LICENSE                         # Apache-2.0
└── README.md
```

## Publishing

Releases are fully **agent-driven**, not GitHub-Actions-driven. The `ship` and `release` Claude agent skills orchestrate the full flow. There is no npm publish — this scaffold is `private: true`.

| What                | How                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bump version        | Add a `.changeset/<topic>.md` file with semver and description on a PR to `staging`. See [`.changeset/README.md`](./.changeset/README.md).                                                      |
| Open the release PR | Run the `ship` skill (`.claude/skills/ship/SKILL.md`) — it parses pending changesets, prompts for which PRs to include, cherry-picks them onto `release/vX.Y.Z`, and opens a PR against `main`.   |
| Publish             | Merge the release PR to `main`. The `release` skill (`.claude/skills/release/SKILL.md`) finishes the job: creates the `v<X.Y.Z>` tag and the GitHub Release via `gh`.                         |
| Hotfix              | Branch from `main` as `release/hotfix-<slug>`, open a PR directly to `main` with a `[hotfix]` label. The same workflow fires.                                                                 |
| Rollback            | Tag a corrective release with a patch bump, or `git revert` the offending merge commit. No npm deprecations (not a registry package).                                                          |

For the full release runbook, see [`CONTRIBUTING.md`](./CONTRIBUTING.md) § "Branching model".

## Architecture notes

- **Filesystem-first.** Tools, skills, subagents, schedules, and channels are files. Drop a file, eve wires it up. No registration step, no central config.
- **Two-layer auth boundary.** `proxy.ts` does a cookie-only check at the edge for redirect UX (fast, no DB). `app/(authenticated)/layout.tsx` re-validates against better-auth + Postgres on every request — that's the real security boundary. Anyone can forge a cookie, but they still won't get past the layout.
- **Login-only by design.** `emailAndPassword.disableSignUp: true` closes `POST /api/auth/sign-up/email`. A before-hook on `/sign-up/*` rejects any future plugin that tries to re-open signup. Admin vetting at user-creation time is the verification layer.
- **Shared session cookie.** The web UI and the eve agent read the same better-auth session. A logged-in user on `/` can call `POST /eve/v1/session` with no extra wiring — `betterAuthFn` resolves them via `auth.api.getSession({ headers })`.
- **Postgres durability + `sslmode=verify-full`.** `db/index.ts` rewrites `sslmode=prefer|require|verify-ca` to `verify-full` to silence the `pg-connection-string` deprecation warning, AND passes `ssl: { rejectUnauthorized: true }` to the Pool — defense in depth, applied at both layers.
- **Direct provider (no AI Gateway).** Default model is `minimax("MiniMax-M3")` via `vercel-minimax-ai-provider` (Anthropic-compatible). Swap to AI Gateway, OpenAI-compatible, or any Vercel AI SDK provider with a one-line edit in `agent/agent.ts`.
- **Two surfaces, one deploy.** `vercel.json` declares both services: Next.js UI on `/` and eve runtime on `/_eve_internal/eve`. `next.config.ts` wraps the Next config with `withEve()`. One `vercel deploy` ships both.
- **Smoke-tested.** `npm run test` runs Vitest smoke tests that assert the canonical file layout, package.json contracts (`private: true`, `engines.node: "24.x"`, scripts, deps), and the imports of `lib/auth`, `lib/eve-auth`, `agent/agent`, and `db/schema/auth`.
- **Agent-driven release flow.** Releases go through Claude agent skills (`ship`, `release`), not GitHub Actions. The `create-pr` skill enforces one changeset per PR.

## Contributing

Open an issue to discuss larger changes. For typos, broken links, and small fixes, PRs are welcome.

Before submitting a PR:

1. Branch from `main` as `feature/<name>` and target `staging` — **never `main`** directly.
2. Add a `.changeset/<topic>.md` for any user-facing change (`patch` / `minor` / `major`); use an empty changeset to pass the CI gate without shipping.
3. Run `npm run lint`, `npm run typecheck`, and `npm run test` locally.
4. Tag your PR with `area:web`, `area:auth`, `area:database`, or `area:app` so reviewers can route it.

For the full contributor workflow, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Acknowledgements

Built on top of [eve](https://eve.dev) by [Vercel](https://vercel.com). UI primitives from [shadcn/ui](https://ui.shadcn.com) and [Vercel AI Elements](https://vercel.com/blog/ai-elements). Streaming via [Streamdown](https://github.com/vercel/streamdown); code highlighting via [Shiki](https://shiki.style). Authentication by [better-auth](https://better-auth.com); ORM by [Drizzle](https://orm.drizzle.team).

The README layout for this project follows the structure established by the deessejs package-template family.

## License

[Apache-2.0](./LICENSE). See the LICENSE file for details.

## Support

- Issues: [github.com/deessejs/eve-template/issues](https://github.com/deessejs/eve-template/issues)
- Discussions: [github.com/deessejs/eve-template/discussions](https://github.com/deessejs/eve-template/discussions)
- Security: see [SECURITY.md](./SECURITY.md)
- eve framework docs: [eve.dev/docs](https://eve.dev/docs)