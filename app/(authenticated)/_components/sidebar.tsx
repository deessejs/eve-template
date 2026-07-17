"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { ConversationActionsMenu } from "@/app/_components/conversation-actions-menu";
import { cn } from "@/lib/utils";
import type { ConversationMeta } from "@/lib/conversations";

export type SidebarItem = Omit<
  Pick<ConversationMeta, "id" | "title" | "preview" | "pinned" | "messageCount">,
  never
> & {
  // `updatedAt` is serialized to ISO string by the JSON wire; the server-side
  // `ConversationMeta` uses `Date` for the Drizzle-internal row but the API
  // response is always a string.
  updatedAt: string;
};

/**
 * Stable query key for the conversation list. Exported so other parts of the
 * app (the chat surface in particular) can invalidate the cache after
 * mutations or turn boundaries.
 */
export const CONVERSATIONS_QUERY_KEY = ["conversations"] as const;

type ConversationListResponse = { items: SidebarItem[] };
type CreateConversationResponse = { item: SidebarItem };

async function fetchConversations(): Promise<SidebarItem[]> {
  const res = await fetch("/api/conversations", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load conversations");
  const data = (await res.json()) as ConversationListResponse;
  return data.items;
}

export function ChatSidebar({ initialItems }: { initialItems: SidebarItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();

  // SSR data seeds the cache so the sidebar is interactive on the first
  // paint. We revalidate in the background to catch changes from other
  // tabs (the cache is shared per-tab; cross-tab live updates need SSE).
  const { data: items = initialItems } = useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: fetchConversations,
    initialData: initialItems,
  });

  const createMutation = useMutation({
    mutationFn: async (): Promise<SidebarItem> => {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create conversation");
      const data = (await res.json()) as CreateConversationResponse;
      return data.item;
    },
    onMutate: async () => {
      // Optimistic insert: a temp id so the UI can render the new row
      // before the server round-trip resolves. The cache is rolled back
      // on error and replaced with the server-confirmed row on success.
      await qc.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      const previous = qc.getQueryData<SidebarItem[]>(CONVERSATIONS_QUERY_KEY);
      const optimistic: SidebarItem = {
        id: `optimistic-${Date.now()}`,
        title: null,
        preview: null,
        messageCount: 0,
        pinned: false,
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData<SidebarItem[]>(CONVERSATIONS_QUERY_KEY, (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { previous, optimisticId: optimistic.id };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(CONVERSATIONS_QUERY_KEY, ctx.previous);
      }
    },
    onSuccess: (item, _vars, ctx) => {
      qc.setQueryData<SidebarItem[]>(CONVERSATIONS_QUERY_KEY, (old) =>
        (old ?? []).map((i) => (i.id === ctx?.optimisticId ? item : i)),
      );
      router.push(`/?c=${item.id}`);
    },
  });

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border h-14">
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              className="w-full justify-start"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              type="button"
              variant="outline"
            >
              {createMutation.isPending ? "Creating…" : "+ New chat"}
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Threads</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.length === 0 ? (
                <SidebarMenuItem>
                  <div className="px-2 py-4 text-muted-foreground text-sm">
                    No conversations yet. Start a new chat.
                  </div>
                </SidebarMenuItem>
              ) : (
                items.map((item) => {
                  const isActive = pathname === `/?c=${item.id}`;
                  const label =
                    item.title ?? item.preview ?? "New chat";
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton isActive={isActive}>
                        <Link
                          className="flex w-full min-w-0 flex-row items-center justify-between gap-2"
                          href={`/?c=${item.id}`}
                        >
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate font-medium text-sm",
                              isActive
                                ? "text-sidebar-accent-foreground"
                                : "text-sidebar-foreground",
                            )}
                          >
                            {label}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 truncate text-xs",
                              isActive
                                ? "text-sidebar-accent-foreground/70"
                                : "text-sidebar-foreground/70",
                            )}
                          >
                            {formatRelative(item.updatedAt)}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                      <ConversationActionsMenu
                        isActive={isActive}
                        pathname={pathname}
                        row={item}
                      />
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-border border-t">
        <SignOutButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
