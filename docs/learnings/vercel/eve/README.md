# eve — Vercel's Agent Framework

> **TL;DR.** eve is an open-source, filesystem-first framework for building, running, and scaling durable AI agents. An agent is a directory; each file in that directory is its definition, with no registration boilerplate. Production primitives — durable execution, sandboxed compute, human-in-the-loop approvals, evals, multi-channel delivery, MCP/OAuth connections, OpenTelemetry traces — are batteries-included.

- **Site:** https://eve.dev
- **Repo:** https://github.com/vercel/eve
- **License:** Apache-2.0
- **Primary language:** TypeScript (~96.5%)
- **Status:** Public beta (APIs may change before GA)
- **Latest release at time of writing:** `eve@0.24.4` (2026-07-15)

---

## Why eve exists

Vercel's framing: building agents today is where the web was before frameworks — every team hand-rolls the same plumbing (durability, sandbox, auth, channels, evals) and nothing carries over to the next project. Vercel positions eve as **"Next.js for agents"**: once enough people have rebuilt the same scaffolding the hard way, the abstraction earns its place.

The intro blog post (2026-06-17) makes the motivation concrete: Vercel runs **100+ agents in production** on eve, including their data analyst (`d0`, 30k questions/month) and an autonomous SDR (32× ROI). Internally, agent-triggered deploys on Vercel jumped from ~3% (a year ago) to ~29% today, with a projected ~50%.

---

## Core idea: the filesystem is the authoring interface

A typical eve agent is a single `agent/` directory. The framework scans it at build time and wires up everything it finds. There is no central registration step.

```
agent/
├── instructions.md        # Required: always-on system prompt
├── agent.ts               # Optional: model + runtime config
├── tools/                 # Optional: typed functions the model can call
│   └── get_weather.ts
├── skills/                # Optional: Markdown procedures, loaded on demand
│   └── research.md
├── channels/              # Optional: Slack, Discord, Teams, HTTP, ...
│   └── slack.ts
├── sandbox/               # Optional: sandbox backend + bootstrap
│   └── sandbox.ts
├── connections/           # Optional: MCP / OpenAPI / OAuth
│   └── linear.ts
├── subagents/             # Optional: delegated child agents
│   └── researcher/
└── schedules/             # Optional: cron-triggered jobs
    └── daily-report.ts
```

A minimal agent is **just `agent/instructions.md`**. Everything else is added progressively as needs emerge.

### Why this matters

- **The file's name and location are its definition.** Drop a TypeScript file in `tools/` and it becomes a callable tool — the filename is the tool name. No registration, no imports.
- **Skills are Markdown playbooks** loaded only when relevant, so the agent isn't carrying the whole playbook in every prompt.
- **The directory tree is self-documenting.** A glance at the folder answers: what is this agent, what can it do, where does it live, when does it act on its own.

---

## Batteries included

| Capability | What it gives you |
|---|---|
| **Durable execution** | Every conversation is a checkpointed workflow (built on Vercel's open-source Workflow SDK). Sessions survive crashes, deploys, hours-long waits between messages. |
| **Sandboxed compute** | Each agent runs code in an isolated sandbox — shell, file reads/writes, scripts. Docker locally; Vercel Sandbox in production; adapter interface for other backends. |
| **Human-in-the-loop** | Add `needsApproval: (...)` on any tool. The agent parks the session (no compute consumed) until a human approves. |
| **Connections** | MCP servers or OpenAPI-described APIs. OAuth is brokered via Vercel Connect — the model never sees connection URLs or tokens. Launch partners: Slack, GitHub, Snowflake, Salesforce, Notion, Linear. |
| **Multi-channel delivery** | One agent codebase surfaces in Slack, Discord, Teams, Telegram, Twilio, GitHub, Linear, web chat, and HTTP. Sessions can hand off between channels. |
| **Subagents** | `subagents/<name>/` is the same shape, one level down — fresh context window, scoped tools, returns to parent. |
| **OpenTelemetry traces** | Standard OTEL spans, exportable to Braintrust, Raindrop, Arize, Honeycomb, Datadog, Jaeger. On Vercel: surfaced in the **Agent Runs** tab under Observability. |
| **Evals** | `defineEval` with scored test suites, runnable locally (`eve eval`) or against a deploy — wire into CI as a deploy gate. |
| **Schedules** | Cron files map to Vercel Cron Jobs in production; agents fire on their own clock (digests, summaries, nightly jobs). |

---

## Next.js integration

If you're already on Next.js, eve mounts directly into the existing app — same dev server, same deploy, no CORS plumbing.

```ts
// next.config.ts
import { withEve } from "eve/next";
const nextConfig = {};
export default withEve(nextConfig);
```

```tsx
// app/chat.tsx
"use client";
import { useEveAgent } from "eve/react";

export function Chat() {
  const agent = useEveAgent();
  // agent.messages, agent.sendMessage, ...
}
```

---

## Self-hostability

eve is not tied to Vercel's managed services. The full runtime can be self-hosted:

- **Durability:** PostgreSQL via `@workflow/world-postgres`
- **Sandbox:** Docker (or any adapter you write)
- **Deploy:** Ansible roles provided in-repo

The managed runtime (Vercel Sandbox + Vercel Connect) is an **option**, not a dependency. The same agent directory runs identically on a laptop and in production.

---

## Quick start

```bash
# New project
npx eve@latest init my-agent

# Add eve to an existing project
cd myapp
npx eve@latest init .
```

The CLI wizard walks through model selection, scaffolds the `agent/` directory, installs dependencies, initializes Git, and starts the dev server — under a minute end-to-end.

A **complete example** (`agent/instructions.md` + one tool + model config) from the docs:

```md
<!-- agent/instructions.md -->
# Identity
You are an expert weather assistant.
You can fetch the weather for any city in the world.
```

```ts
// agent/tools/get_weather.ts
import { defineTool } from "eve/tools";
import z from "zod";

export default defineTool({
  description: "Get the weather for a city",
  inputSchema: z.object({ city: z.string() }),
  async execute(input) {
    const res = await fetch(`${process.env.WEATHER_API_URL}/current?city=${input.city}`);
    return (await res.json()).current_condition[0];
  },
});
```

```ts
// agent/agent.ts
import { defineAgent } from "eve";
export default defineAgent({ model: "openai/gpt-5.4-mini" });
```

Then `eve dev` (or `npm run dev`) and start talking to the agent.

> **Note for coding agents:** the `eve` npm package bundles its full docs at `node_modules/eve/docs`. After `npm install eve`, you can read them locally without leaving the project.

---

## Adoption signals at Vercel

From the launch blog post (2026-06-17):

| Internal agent | Role | Headline metric |
|---|---|---|
| **d0** | Data analyst in Slack, backed by warehouse | 30,000 questions/month |
| **Lead Agent** | Autonomous SDR | ~$5k/yr to run, ~32× return |
| **Athena** | RevOps Q&A (Snowflake + Salesforce) | Pipeline coverage ~2× post-launch; built in 6 weeks without engineers |
| **Vertex** | Tier-1 support agent | Resolves 92% of tickets autonomously |
| **draft0** | Content review pipeline | Used by anyone at Vercel who writes |
| **V** | Router — picks the right agent for a given task | Single front-door for the whole fleet |

All run in **one monorepo**, share the same conventions, are observed and upgraded through the same tooling — that's the operational payoff the framework is meant to deliver.

---

## When to consider eve

eve is worth a closer look if any of these are true:

- You're already on Vercel / Next.js and want to drop an agent into the same app.
- You're tired of re-implementing the same agent plumbing (durability, sandbox, auth, channels, evals) across projects.
- You want production-grade defaults — durable sessions, sandboxed code execution, OTEL traces, multi-channel delivery, CI-runnable evals — without stitching them together yourself.
- You want to keep the option to self-host and avoid managed-service lock-in.

It is **less** interesting if:

- You only need a single LLM call wrapped behind an HTTP route — that's just `ai-sdk` territory.
- You need a hosted, no-code agent builder — eve is a developer's framework, not a product UI.

---

## Caveats

- **Public beta.** Subject to Vercel's beta terms. APIs, defaults, and folder conventions may change before GA.
- **Docs are bundled in the npm package** rather than hosted separately — convenient for coding agents, but means the canonical reference follows the release, not the other way around.
- **Channel breadth is real but uneven.** Some channels (Slack) are first-class; `defineChannel` covers the long tail, but expect to write small adapter files for anything unusual.

---

## Sources

- [eve.dev](https://eve.dev) — product page and docs root
- [Introducing eve — Vercel blog](https://vercel.com/blog/introducing-eve) — launch post, 2026-06-17 (Shar Dara et al.)
- [vercel/eve — GitHub](https://github.com/vercel/eve) — repo, README, releases
- [Vercel — eve overview](https://vercel.com/eve)
- [Vercel docs — eve](https://vercel.com/docs/eve)
