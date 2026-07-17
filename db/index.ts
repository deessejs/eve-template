import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/auth";

// Single shared pool for the Node.js process. Next.js / edge runtimes
// may pool differently — for this template the agent runtime runs in
// Node, so a single Pool is fine. Adjust if deploying to edge.
//
// We configure `ssl` explicitly instead of letting `pg-connection-string`
// parse `?sslmode=...` from the URL. As of pg-connection-string v2.x,
// `sslmode=prefer | require | verify-ca` are silently treated as
// `verify-full`; in v3.0 they'll switch to libpq semantics, which would
// silently weaken the security of any URL that omits the explicit mode.
// Configuring the Pool ourselves is stable across versions.
//
// Resolution is lazy: the URL is only inspected when the Pool actually
// dials. This lets the smoke test (which imports modules without a real
// DATABASE_URL) keep working, while still surfacing a clear error at the
// first query in misconfigured deployments.

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
    // The URL is malformed; let `pg` produce its own error on first query.
    return false;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return false;
  }
  return { rejectUnauthorized: true };
}

// We snapshot DATABASE_URL at module load. In production the env is
// stable; in dev / test it usually is too. If you need to swap the URL
// at runtime, recreate the Pool yourself.
const connectionString = process.env.DATABASE_URL;
const ssl: SslConfig = resolveSslConfig(connectionString);

export const pool = new Pool({ connectionString, ssl });

// Passing the schema is required for better-auth's drizzleAdapter to
// introspect the table layout (otherwise it throws "model 'user' was
// not found in the schema object" at runtime).
export const db = drizzle(pool, { schema });