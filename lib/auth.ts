import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js"; // MUST be the last plugin
import { createAuthMiddleware } from "better-auth/api";
import { APIError } from "better-auth/api";
import { db } from "@/db";

/**
 * Better-auth instance wired to Drizzle (Postgres) with the admin plugin.
 *
 * Design notes for this template (login-only, admin-vetted):
 * - `disableSignUp: true` closes POST /api/auth/sign-up/email
 * - `requireEmailVerification: false` — admin vetting at creation time IS the
 *   verification layer; CLI-created users don't need email verification
 * - `socialProviders: {}` — no OAuth, no implicit signup leak
 * - `admin()` plugin gives us server-side createUser (works without a session
 *   when called from server-only contexts like our scripts/create-user.mjs),
 *   plus role/ban machinery for future admin tooling
 * - before-hook is belt-and-suspenders: rejects /sign-up/* even if a future
 *   plugin re-introduces one
 * - `nextCookies()` (must be last) auto-persists Set-Cookie from server
 *   actions and route handlers — required for login flows from server actions
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 12,
  },
  socialProviders: {},
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    nextCookies(),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-up")) {
        throw new APIError("FORBIDDEN", { message: "Sign-up is closed" });
      }
    }),
  },
});

export type Auth = typeof auth;
