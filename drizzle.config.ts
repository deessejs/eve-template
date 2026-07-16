import { defineConfig } from "drizzle-kit";

// DATABASE_URL must be available when drizzle-kit runs. For local dev:
//   dotenv -e .env.local -- npx drizzle-kit generate
// Or export DATABASE_URL in your shell.
//
// The `schema` path points at the file produced by `npx auth@latest generate`
// (better-auth's Drizzle adapter writes db/schema/auth.ts with user / session /
// account / verification tables, plus whatever plugin-specific tables we add
// later — e.g. admin() adds role / banned / banReason / banExpires to user
// and impersonatedBy to session).
export default defineConfig({
  schema: "./db/schema/auth.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
