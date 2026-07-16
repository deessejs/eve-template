import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Single shared pool for the Node.js process. Next.js / edge runtimes
// may pool differently — for this template the agent runtime runs in
// Node, so a single Pool is fine. Adjust if deploying to edge.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool);
