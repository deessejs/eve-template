import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Mounts every better-auth HTTP route (sign-in, sign-out, get-session,
// admin/*, etc.) under /api/auth/*. The path is configurable via
// BetterAuthOptions.basePath; /api/auth is the recommended default.
export const { POST, GET } = toNextJsHandler(auth);
