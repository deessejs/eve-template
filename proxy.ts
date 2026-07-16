import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Next.js 16 proxy. This is a *redirect optimization*, not a security
 * boundary — `getSessionCookie` only checks for the existence of a
 * session cookie and does NOT validate it. The real auth check is in
 * app/(authenticated)/layout.tsx via `auth.api.getSession`, which hits
 * the database.
 *
 * Cookie-only at the edge keeps requests fast and avoids blocking on
 * a DB call before the redirect. Anyone can forge a cookie, but they
 * still won't get past the layout.
 *
 * /login and /api/auth/* are not matched — sign-in flow has to be
 * reachable without a cookie, and the auth API handles its own paths.
 */
export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
