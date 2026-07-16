---
name: feedback-minimax-direct-provider
description: In eve-template (and MiniMax-related projects), reach the MiniMax API directly via `vercel-minimax-ai-provider` — do not route through Vercel AI Gateway or suggest it
metadata:
  type: feedback
---

For `eve-template` (and other projects using the `MiniMax` model family), the agent routes MiniMax API calls through the **`vercel-minimax-ai-provider`** package directly (currently `import { minimax } from 'vercel-minimax-ai-provider'` in `agent/agent.ts`). Do not propose Vercel AI Gateway as the integration path — the user explicitly rejected it on 2026-07-16 ("non on doit pas utiliser le package minimax provider, pas le ai gateway" → after clarification: "use ai sdk minimax provider, it works").

**Why:**
- Direct provider → one fewer hop, fewer keys to manage (just `MINIMAX_API_KEY`, no `AI_GATEWAY_API_KEY`).
- Keeps the template aligned with the MiniMax-owned provider package.
- Avoids tying the template to Vercel's gateway roadmap/feature-gating.

**How to apply:** When working on MiniMax model wiring in this or similar projects, reach for `vercel-minimax-ai-provider` first. Don't suggest `minimax/minimax-m3` (AI Gateway string ID). If a future requirement genuinely needs failover across multiple MiniMax-compatible providers, reconsider — but for single-provider setups, keep direct.