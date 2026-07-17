import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * `auth.api.getSession` returns `{ session, user } | null` (verified against
 * better-auth 1.7.0-rc.1 source: node_modules/better-auth/dist/api/routes/session.d.mts
 * line 9-47). Both are typed against the user/session model defined in
 * `db/schema/auth.ts`, augmented with plugin-specific fields (e.g. the admin
 * plugin adds `role`, `banned`, `banReason`, `banExpires` on user and
 * `impersonatedBy` on session).
 */
export type AuthedUser = { userId: string };

/**
 * Server-side auth helper. Returns either an error `Response` (401) or a
 * verified `userId`. Use in every API route as:
 *
 *   const auth = await requireUser();
 *   if ("error" in auth) return auth.error;
 *   const { userId } = auth;
 */
export async function requireUser(): Promise<AuthedUser | { error: NextResponse }> {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { userId: result.user.id };
}

/**
 * Same-origin guard. Rejects browser cross-origin POST/PATCH/DELETE. Same-site
 * cookie is already set by better-auth; this is the second layer required
 * because better-auth only protects its own routes.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const expected = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (!expected) return null; // env not set → trust the cookie layer
  const origin = request.headers.get("origin");
  if (origin && origin !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}
