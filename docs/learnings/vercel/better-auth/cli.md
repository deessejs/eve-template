# Better Auth CLI

> **TL;DR.** Two equivalent npm packages (`auth` and `@better-auth/cli`) provide five commands: `init`, `generate`, `migrate`, `info`, and `secret`. The CLI scaffold auth setup, produce schema files for Prisma / Drizzle / Kysely, apply migrations, emit redaction-safe diagnostic dumps, and emit secret keys. Ships with AI-friendly hooks (`Prompt`, `MCP`, `Skills`) for agentic workflows.

See parent: [`./README.md`](./README.md) for the framework overview.

---

## Invocation

Both forms work and resolve to the same code:

| Invocation | Package | Current |
|---|---|---|
| `npx auth@latest <cmd>` | `auth` (meta-package) | **1.6.23** |
| `npx @better-auth/cli@latest <cmd>` | `@better-auth/cli` | **1.4.21** |

The `@better-auth/cli` form is more explicit; `auth` is shorter. Pick one and stay consistent per project.

A `prebuild-install` deprecation warning surfaces via the `better-sqlite3` native build chain. Cosmetic, not blocking — but you'll see it on first run.

---

## Command reference

### `generate`

Produces the schema needed by Better Auth. The output shape depends on the adapter:

| Adapter | Default output path |
|---|---|
| Prisma | `prisma/schema.prisma` |
| Drizzle | `schema.ts` at the project root |
| Kysely (built-in) | `schema.sql` at the project root |

```bash
npx auth@latest generate
```

Options:

| Flag | Effect |
|---|---|
| `--output <path>` | Override the default output path above |
| `--config <path>` | Point at a non-default `auth.ts` location (default: auto-detected in `./`, `./utils`, `./lib`, or under `src/`) |
| `--yes` | Skip the confirmation prompt |

### `migrate`

Applies the Better Auth schema directly to the database. **Only available with the built-in Kysely adapter** — for Prisma/Drizzle, use the ORM's native migration tool on the generated schema.

```bash
npx auth@latest migrate
```

| Flag | Effect |
|---|---|
| `--config <path>` | Same as `generate` |
| `--yes` | Skip the confirmation prompt |

PostgreSQL specifics: `migrate` reads the configured `search_path` and creates tables in the correct schema automatically.

### `init`

Scaffolds Better Auth into an existing project: writes the `auth.ts` config, sets up the catch-all handler, generates a secret, and prepares the schema.

```bash
npx @better-auth/cli@latest init
```

| Flag | Default | Notes |
|---|---|---|
| `--name <name>` | the `name` field in `package.json` | App name surfaced in some setups |
| `--framework <name>` | — | **Currently Next.js only** |
| `--database <name>` | — | **Currently SQLite only** |
| `--plugins <list>` | — | Comma-separated plugin names (e.g. `twofactor,passkey,organization`) |
| `--package-manager <name>` | auto-detected | One of `npm`, `pnpm`, `yarn`, `bun` |

⚠️ **Scope caveat.** Both `--framework` and `--database` have a single supported value each at the time of writing. For anything beyond Next.js + SQLite, you're effectively hand-scaffolding the integration (the framework adapter sections in the parent README cover the manual path).

### `info`

Prints a diagnostic snapshot of your Better Auth setup and environment. Designed to be safe to share in issues / support requests.

```bash
npx auth@latest info
```

What it prints:

- **System** — OS, CPU, memory, Node.js version
- **Package Manager** — detected manager and version
- **Better Auth** — version and configuration (sensitive fields auto-redacted as `[REDACTED]`)
- **Frameworks** — detected (Next.js, React, Vue, etc.)
- **Databases / ORMs** — detected drivers and adapters

Options:

| Flag | Effect |
|---|---|
| `--config <path>` | Point at a non-default `auth.ts` |
| `--json` | Output as JSON (pipe to a file for sharing) |

```bash
npx auth@latest info --json > auth-diagnostics.json
```

### `secret`

Generates a high-entropy secret suitable for `BETTER_AUTH_SECRET` (≥ 32 chars).

```bash
npx auth@latest secret
```

Equivalent to `openssl rand -base64 32` — the CLI exists so you don't need to remember the exact invocation.

---

## Module resolution

The CLI loads your `auth.ts` in Node, so it must resolve the module graph. It handles a surprising amount on its own:

| Resolves automatically | Why it matters |
|---|---|
| `tsconfig.json` path aliases | Including SvelteKit's `$lib` |
| Framework virtual modules | `$env/*`, `$app/*`, `cloudflare:workers` |
| Vite asset queries | e.g. `?raw` imports |

| Does NOT resolve | Workaround |
|---|---|
| `.svelte` component files | Keep these out of your `auth.ts` import graph |
| `import.meta.glob` | Same — bundler-only construct |

For SvelteKit projects, run `svelte-kit sync` first so `.svelte-kit/tsconfig.json` exists; without it, the CLI won't see the path aliases.

---

## AI hooks — `Prompt`, `MCP`, `Skills`

The CLI's homepage surfaces three AI-friendly entry points:

- **`Prompt`** — instruction text meant to be embedded into coding-agent prompts, so an LLM knows how to drive the CLI correctly across projects.
- **`MCP`** — exposes the CLI as an MCP server so a coding agent (e.g. one built with [eve](../eve/README.md)) can invoke schema generation, migrations, and secret rotation as tool calls rather than shelling out.
- **`Skills`** — packaged procedural guides ("skill" in the eve sense) that walk an agent through common CLI workflows end to end.

This stacks cleanly with the broader "Auth for AI agents" surface in Better Auth — the CLI is one of the surfaces an AI agent uses to manage auth, alongside the runtime `agent.auth()` primitives covered in the parent README.

---

## Recipes

### Bootstrap a new Next.js + SQLite app

```bash
npx @better-auth/cli@latest init --framework nextjs --database sqlite --plugins twofactor,passkey
npx auth@latest migrate --yes
```

### Generate a Prisma schema (manual migration later)

```bash
npx @better-auth/cli@latest generate --output prisma/schema.prisma
npx prisma migrate dev --name better-auth
```

### Add Better Auth to an existing Drizzle project (Postgres)

```bash
# 1. Generate the Drizzle schema
npx auth@latest generate

# 2. Apply with drizzle-kit
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Capture a shareable diagnostic

```bash
npx auth@latest info --json > auth-diagnostics.json
```

### Generate a secret without opening a shell alias

```bash
npx auth@latest secret
```

---

## Gotchas

- **`init` is limited to Next.js + SQLite** today. For a fuller scaffold (e.g. Hono + Postgres, or SvelteKit + MySQL), run `init` to get the auth.ts / handler scaffolding, then edit the adapters and DB layer manually.
- **`migrate` only works with the built-in Kysely adapter.** Don't run it if you're on Prisma or Drizzle — it'll report success and miss your tables.
- **`prebuild-install` deprecation warning** is harmless but loud; log scrapers may flag it.
- **PostgreSQL users with non-default schemas** should confirm `search_path` is reachable from the connection string used by the CLI.
- **`auth.ts` must be self-contained** — anything that needs the bundler (Svelte components, Vite `?raw` globs) must not be transitively imported.

---

## Sources

- [Better Auth — CLI reference](https://better-auth.com/docs/concepts/cli)
- [@better-auth/cli on npm](https://www.npmjs.com/package/@better-auth/cli) — stable package
- [auth on npm](https://www.npmjs.com/package/auth) — meta-package alias
- [feat: auth cli — PR #7964](https://github.com/better-auth/better-auth/pull/7964) — original CLI PR
