---
name: project-eve-template-goal
description: This repo is a starter scaffold for building eve (Vercel) agents, not a research-only archive
metadata:
  type: project
---

The repo at `C:\Users\dpereira\Documents\github\templates\eve-template\` is intended as a **scaffold template for building eve agents** — not a research-only repo. Anything under `docs/learnings/` (e.g. `vercel/eve/README.md`) documents the framework the template targets, so future sessions understand what they are scaffolding for.

**Why:** User stated directly on 2026-07-16, while the repo was still essentially empty (one `.claude/` config and a single learnings README), that "ce projet va être un template d'agent eve". The implication: scaffolding code — starter `agent/` directory, `package.json` with `eve`, `tsconfig.json`, a top-level README, etc. — is expected to follow.

**How to apply:** When making suggestions or starting work here, treat the repo as a template that other developers will clone to spin up their own eve agents — favour canonical eve scaffold structure over one-off demo content. Don't auto-create eve agent code without alignment; the user may have a specific scaffold shape in mind (e.g. weather demo vs. blank, with/without Next.js, channels pre-wired, etc.). When in doubt, ask before scaffolding.
