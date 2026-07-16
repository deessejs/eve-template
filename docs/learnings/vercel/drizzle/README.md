# Drizzle ORM — TypeScript SQL ORM

> **TL;DR.** Lightweight, TypeScript-first ORM that treats SQL as a first-class citizen: schemas are typed TS objects, queries read like SQL, and you can drop into raw SQL whenever you need to. No codegen, no decorators, no runtime DSL — just types and a tiny query builder. Backed by `drizzle-kit` (migrations) and `drizzle-studio` (DB browser).

- **Site:** https://orm.drizzle.team
- **Repo:** https://github.com/drizzle-team/drizzle-orm
- **License:** Apache-2.0
- **Status:** v1.0 line stabilizing, shipped through 2024-2026 with sustained cadence

See also: [`./better-auth.md`](./better-auth.md) for how this ORM plugs into better-auth in this template.

---

## Why it exists

Most TS ORMs fall into one of two traps: heavy abstractions that hide SQL behind a custom DSL (and break when you need actual SQL), or hand-rolled `pg`-style string queries that lose their types. Drizzle's pitch is to stay close to SQL while still giving you:

- **Type-safe schema** declared in TypeScript
- **Type-safe queries** that catch errors at compile time
- **Zero codegen** — types flow from the schema directly
- **No decorators, no reflect-metadata** — works in any runtime
- **Tiny footprint** — the query builder is one of the smallest in the ecosystem

The result: if you know SQL, you already know 90% of Drizzle.

## Core idea: schema is a typed TS object, queries are tagged SQL

```ts
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

export const users = pgTable("users", {
  id:        serial("id").primaryKey(),
  email:     text("email").notNull().unique(),
  name:      text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

```ts
const found = await db.select().from(users).where(eq(users.email, "alice@example.com"));
const created = await db.insert(users).values({ email: "bob@example.com" }).returning();
await db.update(users).set({ name: "Alice" }).where(eq(users.id, 1));
await db.delete(users).where(eq(users.id, 2));
```

Every field, every operator, every returned row is typed. If the SQL wouldn't run, the TS won't compile.

## Database support

Drizzle covers a wide matrix — both the well-known managed services and the long tail:

| Category | Supported |
|---|---|
| **OLTP SQL** | PostgreSQL, MySQL, SQLite, SQL Server, SingleStore, CockroachDB |
| **Hosted / serverless** | Neon, PlanetScale, Supabase, Vercel Postgres, Turso, D1, Bun SQL |
| **In-process / local** | PGlite, better-sqlite3, LibSQL, Bun SQLite |
| **NoSQL** | MongoDB (yes, really — with a SQL-ish builder) |

The Drizzle home page explicitly calls out tutorials for **Drizzle ↔ Vercel Postgres**, **Drizzle ↔ Neon**, **Drizzle ↔ Turso**, and **Drizzle ↔ Supabase** — which makes it a default choice in this template's ecosystem.

## Tooling

| Tool | Purpose |
|---|---|
| **`drizzle-orm`** | The runtime — schemas, query builder, drivers |
| **`drizzle-kit`** | CLI: `generate` (diff → migration SQL), `migrate` (apply), `push` (sync dev DB), `pull` (introspect existing), `studio` (launch UI), `check` (verify migrations) |
| **`drizzle-studio`** | Web UI for browsing/editing local DB; ships as part of `drizzle-kit studio` |
| **`drizzle-zod` / `drizzle-typebox`** | Optional schema-to-validator bridges for form/JSON-schema use |

## Schema & migration workflow

```bash
# 1. Edit schema.ts (typed table definitions)

# 2. Generate a migration from the schema diff
npx drizzle-kit generate

# 3. Apply (locally in dev)
npx drizzle-kit push

# 4. Apply (CI/prod with versioned migrations)
npx drizzle-kit migrate
```

For a template project: commit the generated SQL migration files alongside the schema. Drizzle Kit keeps the diff readable.

## Quick start (PostgreSQL)

```bash
npm install drizzle-orm
npm install -D drizzle-kit
npm install pg
npm install -D @types/pg
```

```ts
// db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool);
```

```ts
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./db/schema.ts",
  out:    "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

```ts
// db/schema.ts (one example table)
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id:        serial("id").primaryKey(),
  email:     text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

```bash
npx drizzle-kit generate      # creates ./db/migrations/0000_*.sql
npx drizzle-kit push          # applies to your dev DB
npx drizzle-kit studio        # opens the local DB UI
```

## When to consider Drizzle

Drizzle is worth a closer look if any of these are true:

- You're on TypeScript and want a **typed schema + queries** with no codegen step.
- You need to ship to **a serverless edge** (D1, Turso, Neon, Vercel Postgres) — Drizzle has first-class drivers for all of them.
- You want **lightweight** — Drizzle's runtime footprint is one of the smallest in the ORM space, important for edge bundles.
- You **already think in SQL** and don't want an ORM that hides it behind a DSL.
- You're using **better-auth** — see [`./better-auth.md`](./better-auth.md) for the first-class integration.

It is **less** interesting if:

- You prefer a model-first ORM with auto-migrations from class definitions (TypeORM, MikroORM) — Drizzle is schema-as-data, not schema-as-class.
- You need a hosted dashboard for non-developer DB editing — Drizzle Studio is dev-oriented, not an admin tool.
- You want batteries-included like Prisma (its own migrations, query engine binary, data proxy) — Drizzle is more "compose with the ecosystem."

## Caveats

- **Migrations are split** — `drizzle-kit generate` produces the SQL, but you apply with `drizzle-kit migrate`. Different commands, different flags. Easy to confuse with Prisma's single `prisma migrate dev`.
- **`push` is dev-only** — it's a "best-effort sync" without migration history. Don't use it in CI/prod.
- **No built-in query engine binary** (unlike Prisma). You hit the driver directly. Faster cold-starts on the edge, but you don't get Prisma's "one query language across DBs" abstraction — Drizzle's SQL builders are per-dialect.
- **Joins and relations** work but require explicit `relations()` declarations, especially for tables with multiple FKs to the same target (see [`./better-auth.md`](./better-auth.md) for the gotcha).
- **MongoDB support** exists but is less mature than the SQL builders — only consider it if you're already using Drizzle for SQL elsewhere.

## Repo signals

- ~35k+ stars on the homepage
- 10-person core team listed
- Active contributors log visible on the site
- Apache-2.0 licensed
- Sustained release cadence through 2024-2026

## Sources

- [orm.drizzle.team](https://orm.drizzle.team) — landing page
- [drizzle-team/drizzle-orm — GitHub](https://github.com/drizzle-team/drizzle-orm) — repo
- [Drizzle ORM docs](https://orm.drizzle.team/docs/overview) — why + when
- [Drizzle ORM — Schema](https://orm.drizzle.team/docs/sql-schema-declaration) — schema declarations reference
