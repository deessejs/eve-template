#!/usr/bin/env node
/**
 * Create a non-admin user via the better-auth admin plugin's
 * `auth.api.createUser` server API.
 *
 * Bypasses the public sign-up endpoint (closed in lib/auth.ts via
 * `emailAndPassword.disableSignUp`). Per better-auth source
 * (commit f2520f95), createUser on the server API works WITHOUT an
 * admin session when invoked from a server-only context — exactly this
 * CLI's situation.
 *
 * Usage:
 *   node --env-file=.env scripts/create-user.mjs --email alice@co.com --name Alice --password '<pw>'
 *   node --env-file=.env scripts/create-user.mjs --email bob@co.com --name Bob --password '<pw>' --role admin
 *
 * Env (read via --env-file=.env or set in shell):
 *   DATABASE_URL          Postgres connection string
 *   BETTER_AUTH_SECRET    >= 32 char secret (matches lib/auth.ts)
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const email = args.email;
  const name = args.name;
  const password = args.password;
  const role = args.role ?? "user";

  if (!email || !name || !password) {
    console.error(
      "Usage: node --env-file=.env scripts/create-user.mjs " +
        "--email <email> --name <name> --password <pw> [--role <role>]",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
    console.error(
      "DATABASE_URL and BETTER_AUTH_SECRET must be set in env " +
        "(use --env-file=.env or export in shell)",
    );
    process.exit(1);
  }

  const db = drizzle(
    new Pool({ connectionString: process.env.DATABASE_URL }),
  );

  const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
    },
    socialProviders: {},
    plugins: [admin()],
  });

  const result = await auth.api.createUser({
    body: { email, password, name, role },
  });

  if (!result) {
    console.error("createUser returned no result");
    process.exit(1);
  }

  console.log(
    `✓ created user ${result.user.email} (role=${result.user.role}, id=${result.user.id})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
