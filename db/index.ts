import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/auth";

// Single shared pool for the Node.js process. Next.js / edge runtimes
// may pool differently — for this template the agent runtime runs in
// Node, so a single Pool is fine. Adjust if deploying to edge.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

// Passing the schema is required for better-auth's drizzleAdapter to
// introspect the table layout (otherwise it throws "model 'user' was
// not found in the schema object" at runtime).
export const db = drizzle(pool, { schema });
