import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/auth";

// Single shared pool for the Node.js process. Next.js / edge runtimes
// may pool differently — for this template the agent runtime runs in
// Node, so a single Pool is fine. Adjust if deploying to edge.
//
// SSL is configured in two layers:
//
//   1. We pass `ssl: { rejectUnauthorized: true }` to the Pool, so the
//      connection itself uses verify-full (the strongest check).
//
//   2. We rewrite DATABASE_URL so that its `sslmode` query param is
//      always `verify-full`. `pg-connection-string` emits a deprecation
//      warning whenever it sees `sslmode=prefer | require | verify-ca`,
//      regardless of what we pass to the Pool — that warning is based on
//      URL parsing alone, not on the resolved `ssl` config. The only way
//      to silence it is to have the URL itself carry `verify-full`.
//
// The Pool sees the rewritten URL; the rest of the codebase (better-auth,
// drizzle) sees the original via `process.env.DATABASE_URL`.

type SslConfig = false | { rejectUnauthorized: true };

function resolveSslConfig(connectionString: string | undefined): SslConfig {
  if (!connectionString) {
    // No URL yet (e.g. a unit test that imports this module without
    // setting DATABASE_URL). Defer to the first real query, which will
    // fail loudly with a pg-native error message.
    return false;
  }
  let hostname: string;
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    return false;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return false;
  }
  return { rejectUnauthorized: true };
}

// Rewrite `sslmode=prefer|require|verify-ca` to `sslmode=verify-full`
// to silence the pg-connection-string deprecation warning. We keep all
// other URL parameters intact. Returns the input unchanged if it doesn't
// parse as a URL or doesn't carry a libpq-compatible sslmode.
function normalizeSslMode(connectionString: string | undefined): string | undefined {
  if (!connectionString) return connectionString;
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  const sslmode = url.searchParams.get("sslmode");
  if (
    sslmode === "prefer" ||
    sslmode === "require" ||
    sslmode === "verify-ca"
  ) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }
  return connectionString;
}

const rawUrl = process.env.DATABASE_URL;
const connectionString = normalizeSslMode(rawUrl);
const ssl: SslConfig = resolveSslConfig(rawUrl);

export const pool = new Pool({ connectionString, ssl });

// Passing the schema is required for better-auth's drizzleAdapter to
// introspect the table layout (otherwise it throws "model 'user' was
// not found in the schema object" at runtime).
export const db = drizzle(pool, { schema });