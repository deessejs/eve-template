---
name: feedback-no-launch-dev-server
description: Do not launch `npm run dev` or any long-running dev server in this project — the user manages that manually
metadata:
  type: feedback
---

Do NOT run `npm run dev`, `npm run start`, `npx next dev`, or any command that starts a long-running dev/HTTP server in this `eve-template` project. This applies to **background** execution too — `run_in_background: true` is still launching a server, which is just as unwanted.

**Why:** User explicitly corrected on 2026-07-16 after I repeatedly attempted to launch `npm run dev` (including a background invocation that failed with exit code 1). The user runs the dev server themselves in their own terminal and wants to keep that manual. My attempts added noise without value.

**How to apply:** When verifying the implementation or running end-to-end checks:
- **Do NOT spawn a dev/HTTP server** (any form: foreground, background, `&`, `run_in_background`).
- Use `npm run typecheck` and `drizzle-kit check` — these are fine (they exit on their own).
- Use `curl` against a server the user has already started — never against one I spawned.
- For DB migrations: use `drizzle-kit migrate` against the user's already-configured DB. Never start a local Postgres on their behalf.
- For `scripts/create-admin.sh` and `scripts/create-user.mjs`: fine to run (short-lived, they exit). They are not "servers".
- If a verification step genuinely requires a running server and the user hasn't started one, **ASK FIRST** ("do you want me to start it, or will you?") instead of starting it.
- General principle: **ask before running anything long-running**. The user wants explicit consent on background processes.