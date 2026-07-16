---
name: feedback-eve-template-auth-stack
description: In the eve-template project (and other eve-scaffold work), default to better-auth over Clerk / Auth.js / Auth0 when wiring auth
metadata:
  type: feedback
---

In `templates/eve-template/` and other eve-based projects, the chosen auth provider for **route auth** (the channel-level user/principal auth in `agent/channels/eve.ts`) is **better-auth**. Do not propose Clerk, Auth.js, or Auth0 as the default.

**Why:** On 2026-07-16, the user explicitly redirected during research: "on va pas utiliser clerk mais better-auth". Drivers behind the choice: ecosystem alignment (better-auth is also joining Vercel, per their own homepage, and ships an `@vercel/connect/betterauth` adapter referenced in the Vercel Connect launch post). Picking Clerk would push against that trajectory and force a second integration story with `@vercel/connect`.

**How to apply:** When scaffolding, recommending, or wiring auth in an eve-template-style project, propose better-auth by default and frame Clerk / Auth0 / Auth.js as alternatives only if the user explicitly asks. The two-system model still applies (route auth on `eve.ts` channel + connection auth via `@vercel/connect`) — better-auth feeds the route auth side via a custom `AuthFn` modeled on [[eve-auth-two-systems]]; it does not replace `@vercel/connect` for outbound connection auth.

The root `README.md` currently lists "Auth.js or Clerk" as the placeholder to swap for `placeholderAuth()` — that line is now stale and should be edited to name better-auth first.
