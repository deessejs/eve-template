import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server-side auth check for the `(authenticated)` route group.
 *
 * This is the *real* auth boundary. `proxy.ts` does a cookie-only check
 * for redirect UX (fast, no DB hit), but anyone can forge a cookie —
 * so the layout re-validates against better-auth + the database on
 * every request before rendering.
 *
 * If session is missing or invalid, redirect to /login. The user can
 * sign in and come back to the page they were on (well, to `/`, since
 * we don't preserve deep links here).
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return <>{children}</>;
}
