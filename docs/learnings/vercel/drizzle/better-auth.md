# Better Auth × Drizzle

> **TL;DR.** Better Auth has a first-party Drizzle adapter (`@better-auth/drizzle-adapter`). Wire it in three lines, then use `npx auth@latest generate` to scaffold the schema tables, and `drizzle-kit generate` + `drizzle-kit migrate` to apply. Supports `sqlite` / `pg` / `mysql` providers. Experimental joins can 2-3× perf on `/get-session` once you define relations.

See parent: [`./README.md`](./README.md) for Drizzle ORM. See also: [`../better-auth/README.md`](../better-auth/README.md), [`../better-auth/cli.md`](../better-auth/cli.md).

---

## Installation

```bash
npm install @better-auth/drizzle-adapter
```

That single package is the adapter; `better-auth` and `drizzle-orm` are expected to already be installed.

## Wiring — 3 lines

```ts
// auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./database"; // your existing Drizzle instance

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // or "pg" or "mysql"
  }),
  // ...rest of your config (emailAndPassword, socialProviders, plugins, ...)
});
```

The `db` you pass in is whatever Drizzle instance you already use in your app — Drizzle doesn't take over your DB connection, it just hands the adapter a queryable surface.

## Schema generation & migration — the workflow

Unlike the **built-in Kysely adapter** (where `npx auth@latest migrate` applies the schema directly), Drizzle goes through Drizzle Kit:

```bash
# 1. Generate the Drizzle schema for the tables Better Auth needs
npx auth@latest generate
# → writes db/schema/auth.ts with user, session, account, verification, plus plugin tables

# 2. Diff schema → migration SQL
npx drizzle-kit generate

# 3. Apply migration
npx drizzle-kit migrate
```

In `drizzle.config.ts`, make sure `schema` points at the file (or directory) that includes Better Auth's generated tables:

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./db/schema/index.ts",     // include the generated auth schema
  out:    "./db/migrations",
  dialect: "postgresql",              // or "sqlite" / "mysql"
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Re-run step 1 whenever you add a better-auth plugin — it will diff your `auth.ts` config against the existing schema and the generated output adds the new tables (e.g. `twoFactor`, `passkey`, `organization`, ...).

## Customization — table & field names

Better Auth defaults to singular table names (`user`, `session`). To use plural:

```ts
drizzleAdapter(db, {
  provider: "sqlite",
  usePlural: true,   // user → users, session → sessions, ...
});
```

To customize a specific table name without flipping everything plural:

```ts
drizzleAdapter(db, {
  provider: "sqlite",
  schema: { ...schema, user: schema.users },  // remap the `user` model to your `users` table
});

// OR via the auth config:
export const auth = betterAuth({
  user: { modelName: "users" },
});
```

To rename a single column without breaking the schema property name (so Better Auth keeps talking to `email`, but your DB column is `email_address`):

```ts
// In your Drizzle schema:
email: varchar("email_address", { length: 255 }).notNull().unique(),
```

```ts
// OR in the auth config:
export const auth = betterAuth({
  user: { fields: { email: "email_address" } },
});
```

Both work — schema-side renames the column directly, config-side keeps the schema stable and translates at the adapter boundary.

## Joins — experimental perf win

Better Auth can fetch related data (sessions with user, orgs with members, etc.) in a single query instead of several round-trips. Endpoints like `/get-session` and `/get-full-organization` see 2× to 3× speedups depending on DB latency.

Activate:

```ts
export const auth = betterAuth({
  experimental: { joins: true },
});
```

**Requires Drizzle relations** in your schema. If your generated schema doesn't include them, regenerate with the latest CLI:

```bash
npx auth@latest generate
```

## Gotcha — relations with multiple FKs to the same table

When one table has **multiple foreign keys pointing at the same target** (e.g. a `tests` table with both `userId` and `managerId` FKs to `users`), each FK pair needs a matching `relationName` on both sides:

```ts
export const testsRelations = relations(tests, ({ one }) => ({
  user:    one(users, { relationName: "tests_userId",    fields: [tests.userId],    references: [users.id] }),
  manager: one(users, { relationName: "tests_managerId", fields: [tests.managerId], references: [users.id] }),
}));
```

And **don't keep both singular and plural aliases** for the same FK (e.g. both `user` and `users`). Drizzle treats those as separate relations and can't tell which one a join should use.

The CLI generates these names automatically. If you generated your schema with an older CLI version, regenerate it or add matching `relationName`s by hand.

## Naming convention for relationName

| `usePlural` | `relationName` shape |
|---|---|
| `false` (default) | singular — `test_userId` |
| `true` | plural — `tests_userId` |

Both sides of a relation must use the same shape.

## Provider matrix

| `provider` value | Underlying driver |
|---|---|
| `"sqlite"` | `better-sqlite3`, `bun:sqlite`, `libsql`, or similar |
| `"pg"` | `pg`, `postgres`, `neon`, `pglite`, `vercel-postgres`, etc. |
| `"mysql"` | `mysql2`, PlanetScale, etc. |

Drizzle has first-class drivers for all of these; pick whichever matches your deployment target.

## Recipes

### Bootstrap a fresh Postgres project

```bash
# 1. Install
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg @better-auth/drizzle-adapter better-auth

# 2. Scaffold the Better Auth schema into your Drizzle schema
npx auth@latest generate

# 3. Generate + apply the migration
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Add a plugin later

```bash
# 1. Add the plugin to auth.ts (e.g. twoFactor(), organization())
# 2. Regenerate the schema
npx auth@latest generate
# 3. Diff and apply
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Enable joins for perf

```bash
# 1. Turn on joins in auth.ts
#    experimental: { joins: true }
# 2. Ensure your Drizzle schema has relations() declarations
#    (regenerate with the latest CLI if not)
# 3. Re-run typecheck — better-auth will now use joined queries.
```

## What this means in this template

Combined with the rest of the stack:

| Layer | Choice |
|---|---|
| ORM | **Drizzle** (`drizzle-orm` + `drizzle-kit`) |
| Driver | PostgreSQL via `pg` (or Neon / Vercel Postgres / PGlite) |
| Auth provider | **better-auth** |
| Adapter | **`@better-auth/drizzle-adapter`** |
| Schema source of truth | `npx auth@latest generate` writes the auth tables; your `db/schema/` adds the rest |
| Migrations | `drizzle-kit generate` → `drizzle-kit migrate` (versioned, committed to git) |

This is the path that aligns with both the eve template's lean posture and the Vercel-better-auth integration announcement. The full inbound-auth sketch (better-auth → `AuthFn` → `eveChannel`) lives in [`../eve/auth.md`](../eve/auth.md).

## Sources

- [Better Auth — Drizzle ORM Adapter](https://better-auth.com/docs/adapters/drizzle) — official integration doc
- [Drizzle ORM](https://orm.drizzle.team) — homepage
- [drizzle-team/drizzle-orm — GitHub](https://github.com/drizzle-team/drizzle-orm)
- [Drizzle ORM — Schema](https://orm.drizzle.team/docs/sql-schema-declaration) — schema reference
- [Better Auth + Drizzle: The Schema Gotcha That Breaks Everything](https://blog.aethostech.com.br/blog/2026-03-05-better-auth-drizzle-gotcha/) — third-party write-up of the multiple-FK relations gotcha
