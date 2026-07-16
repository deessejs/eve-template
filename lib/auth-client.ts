import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/**
 * Browser-side better-auth client. Use from React components for
 * sign-in/sign-out and admin operations (createUser, listUsers, etc.).
 *
 * The `adminClient()` plugin adds typed methods under `authClient.admin.*`
 * (createUser, setRole, banUser, impersonateUser, …). Server-side admin
 * operations use `auth.api.*` from `@/lib/auth` instead.
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
