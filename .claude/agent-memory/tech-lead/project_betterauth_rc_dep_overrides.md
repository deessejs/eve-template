---
name: project-betterauth-rc-dep-overrides
description: better-auth 1.7.0-rc.1 needs npm overrides for jose@^6.1.0 and kysely@^0.28.17 — both are dep mismatch bugs in the RC that the better-auth team is still fixing
metadata:
  type: project
---

In `templates/eve-template/` (and any other project using `better-auth@1.7.0-rc.1`), two npm overrides are required in `package.json`:

```json
"overrides": {
  "ai": "^7.0.26",
  "jose": "^6.1.0",
  "kysely": "^0.28.17"
}
```

**Why:**

1. **`jose@^6.1.0` override** — better-auth@1.7.0-rc.1 (via `@better-auth/core`) requires `jose@^6.1.0`, but the older `@vercel/oidc@3.6.1` brings in `jose@5.10.0`. Without the override, npm hoists `jose@5.10.0` to root, and `customFetch` (added in jose 6.0.8, panva/jose#762) doesn't exist there. eve's runtime imports `customFetch` from `jose` and crashes on startup.

2. **`kysely@^0.28.17` override + `kysely` as a DIRECT dependency** — `@better-auth/kysely-adapter@1.7.0-rc.1` imports `DEFAULT_MIGRATION_TABLE` / `DEFAULT_MIGRATION_LOCK_TABLE` from `kysely` root, but kysely v0.29 moved these constants to the `kysely/migration` subpath (kysely-org/kysely#1618). The fix is in better-auth PR #9811 but not in 1.7.0-rc.1. Pinning to 0.28.x keeps the constants at root. **The override alone is not enough** — npm nests kysely under `node_modules/better-auth/node_modules/kysely/`, but the kysely-adapter is hoisted to `node_modules/@better-auth/kysely-adapter/` and walks up from its own path, which never crosses the better-auth/ subtree, so it gets `Cannot find package 'kysely'` at runtime. Adding `kysely` to `dependencies` (with the same version pin) forces npm to hoist it to `node_modules/kysely/`, visible from anywhere. We never actually import kysely in this template (we use Drizzle); the direct dep is purely a hoisting workaround for the better-auth RC bug.

**How to apply:** When updating `better-auth` past `1.7.0-rc.1`, check the upstream changelog for these fixes and remove the overrides once they're no longer needed. Until then, the overrides are load-bearing — removing them re-introduces the runtime crashes. Also: install with `--legacy-peer-deps` because `@vercel/connect@0.2.2` has a peerOptional on `better-auth@">=1.5.0"` that npm excludes pre-releases from.