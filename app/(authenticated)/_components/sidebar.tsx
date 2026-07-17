"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import type { ConversationMeta } from "@/lib/conversations";

export type SidebarItem = Pick<
  ConversationMeta,
  "id" | "title" | "preview" | "updatedAt" | "pinned" | "messageCount"
>;

export function ChatSidebar({ items }: { items: SidebarItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const handleNewChat = () => {
    startTransition(async () => {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (!res.ok) return;
      const { item } = (await res.json()) as { item: SidebarItem };
      router.push(`/?c=${item.id}`);
    });
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Button
              className="w-full justify-start"
              disabled={pending}
              onClick={handleNewChat}
              type="button"
              variant="outline"
            >
              {pending ? "Creating…" : "+ New chat"}
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
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          className="flex min-w-0 flex-col items-start gap-0.5"
                          href={`/?c=${item.id}`}
                        >
                          <span className="truncate font-medium text-sm">
                            {label}
                          </span>
                          <span className="truncate text-muted-foreground text-xs">
                            {formatRelative(item.updatedAt)}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                      {item.pinned ? (
                        <SidebarMenuAction disabled>📌</SidebarMenuAction>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
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
