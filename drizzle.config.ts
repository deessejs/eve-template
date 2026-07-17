import { defineConfig } from "drizzle-kit";

// DATABASE_URL must be available when drizzle-kit runs. For local dev:
//   dotenv -e .env.local -- npx drizzle-kit generate
// Or export DATABASE_URL in your shell.
//
// The `schema` path points at the barrel re-exporting every schema file in
// the project (currently `./auth.ts` and `./chat.ts`). Add new schema files
// under `db/schema/` and re-export them from `./db/schema/index.ts`.
export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
