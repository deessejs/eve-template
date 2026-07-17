import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * In-process Postgres for integration tests. The setup boots PGlite in
 * memory, runs every migration under `db/migrations/`, and exposes a Drizzle
 * instance bound to the schema barrel. Tests reuse the same instance via
 * `getTestDb()`.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

let _db: ReturnType<typeof drizzle> | null = null;

export function getTestDb() {
  if (!_db) throw new Error("Test DB not initialized. Call setupTestDb() first.");
  return _db;
}

export async function setupTestDb() {
  if (_db) return _db;
  const pg = new PGlite();
  // Apply every migration in lexical order, splitting on the
  // `-- statement-breakpoint` sentinels that drizzle-kit emits.
  const migrations = [
    readFileSync(resolve(ROOT, "db/migrations/0000_init.sql"), "utf8"),
    readFileSync(
      resolve(ROOT, "db/migrations/0001_unusual_red_shift.sql"),
      "utf8",
    ),
  ];
  for (const sql of migrations) {
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await pg.exec(stmt);
    }
  }
  const schema = await import("../db/schema/index.js");
  _db = drizzle(pg, { schema });
  return _db;
}

export async function teardownTestDb() {
  _db = null;
}
