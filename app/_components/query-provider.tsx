"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * One `QueryClient` per browser tab. Default options are tuned for the chat
 * sidebar:
 *   - `staleTime: 30s` — the list is unlikely to drift inside a single tab
 *     in 30s; the chat surface invalidates on turn end so this is a
 *     backstop, not a primary freshness mechanism.
 *   - `refetchOnWindowFocus: false` — focus events are noisy in the dev
 *     experience; re-enable if the sidebar ever starts to feel stale.
 *
 * Mounting the provider lives in `(with-sidebar)/layout.tsx` so non-chat
 * surfaces (e.g. the upcoming `settings/sessions` page) do not pull
 * React Query into their bundles.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
