---
name: feedback-drizzle-schema-pass-to-instance
description: When using better-auth + Drizzle, always pass `{ schema }` to the drizzle() call so the adapter can introspect tables
metadata:
  type: feedback
---

When wiring better-auth + Drizzle in this template (or any other project), the Drizzle instance must be created with the schema passed:

```ts
import * as schema from "./schema/auth";
export const db = drizzle(pool, { schema });
```

Not:
```ts
export const db = drizzle(pool); // ❌ "model 'user' was not found in the schema object"
```

**Why:** better-auth's `drizzleAdapter` introspects the Drizzle instance to discover the table layout. Without the schema argument, the introspection returns nothing and better-auth throws `model "user" was not found in the schema object` at runtime (typically the first time you hit a DB-touching endpoint). The `npx auth generate` step that creates `db/schema/auth.ts` is what makes the import possible — without that step there's nothing to pass, but without the pass, the adapter is blind.

**How to apply:** Whenever scaffolding a new project with better-auth + Drizzle, always do (1) `npx auth generate` to create the schema files, then (2) import them as `import * as schema from "./schema/auth"` and pass to `drizzle()`. Also propagate this to any standalone scripts (e.g. CLI user creation) that construct their own Drizzle instance — same fix.
