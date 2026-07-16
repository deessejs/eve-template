# eve-template

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
// example: Clerk / Auth.js / none() for a public demo
import { authjsAuth, clerkAuth, none } from "eve/channels/auth";
```

Or call `eve channels add web --auth=clerk` to regenerate with a real provider.

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
