import { cookies } from "next/headers";
import { Suspense } from "react";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ChatSidebar } from "@/app/(authenticated)/_components/sidebar";
import { QueryProvider } from "@/app/_components/query-provider";
import { listConversations } from "@/lib/conversations";
import { requireUser } from "@/lib/require-user";

/**
 * Inner layout for the chat surface. Sibling routes of `(authenticated)/`
 * (e.g. `app/(authenticated)/settings/page.tsx`) deliberately stay outside
 * the `(with-sidebar)/` group so they do not inherit the chat sidebar.
 */
export default async function WithSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireUser();
  if ("error" in auth) {
    // The outer (authenticated)/layout.tsx already guards the cookie, so this
    // branch is defensive only. If we ever land here, the redirect happens
    // upstream and this render is unreachable.
    return null;
  }
  const rawItems = await listConversations(auth.userId);
  // `ConversationMeta.updatedAt` is a `Date` server-side; the API wire and
  // the sidebar component want an ISO string. Map once at the boundary so
  // downstream code never deals with the Date type for this field.
  const items = rawItems.map((item) => ({
    id: item.id,
    title: item.title,
    preview: item.preview,
    pinned: item.pinned,
    messageCount: item.messageCount,
    updatedAt: item.updatedAt.toISOString(),
  }));

  // SidebarProvider persists `defaultOpen` (and any later toggle) in a
  // cookie; the default is the inverse of the cookie value so first-time
  // users land with the sidebar expanded.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <QueryProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <Suspense>
          <ChatSidebar initialItems={items} />
        </Suspense>
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
          </header>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}
