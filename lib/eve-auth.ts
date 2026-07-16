import type { AuthFn } from "eve/channels/auth";
import { auth } from "@/lib/auth";

/**
 * better-auth → eve AuthFn adapter.
 *
 * eve's `eveChannel({ auth: AuthFn[] })` walks the array on each inbound
 * request and uses the first matching entry to populate
 * `ctx.session.auth.current` for tools, subagents, and instructions.
 *
 * This AuthFn reads the better-auth session cookie from the raw Web
 * `Request` headers (no HTTP round-trip — `auth.api.getSession` reads
 * cookies in-process). Returns null when no session, when the user is
 * banned, or when validation fails — eve then falls through to the
 * next entry in the chain (localDev/vercelOidc).
 *
 * `request.headers` is a Web `Headers` instance, which better-auth
 * accepts directly (same shape as `await headers()` from next/headers).
 */
export const betterAuthFn: AuthFn<Request> = async (request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;

  // Defense in depth: the admin plugin's session.create.before hook
  // blocks banned users from creating new sessions, but getSession
  // itself does NOT re-check `banned` for already-issued sessions.
  // Cheap safeguard: null out banned users at the eve layer too.
  const user = session.user as {
    role?: string;
    banned?: boolean;
  };
  if (user.banned) return null;

  return {
    authenticator: "better-auth",
    principalType: "user",
    principalId: session.user.id,
    subject: session.user.id,
    attributes: {
      email: session.user.email,
      name: session.user.name,
      role: user.role ?? "user",
    },
  };
};
