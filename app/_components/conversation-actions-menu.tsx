"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarMenuAction } from "@/components/ui/sidebar";

import { CONVERSATIONS_QUERY_KEY } from "@/app/(authenticated)/_components/sidebar";

import type { SidebarItem } from "@/app/(authenticated)/_components/sidebar";

/**
 * Row payload the menu needs to render. The sidebar's `SidebarItem` type
 * is the public shape; we just re-export it under a more focused alias
 * so the component doesn't import the full sidebar module.
 */
export type ConversationRow = SidebarItem;

const DELETE_CONFIRMATION_PHRASE = "Delete";
const MAX_TITLE_LENGTH = 120;

/**
 * The kebab-menu + 2 dialogs (rename / delete) for a sidebar conversation
 * row. The kebab is a hover-revealed `SidebarMenuAction` (always visible
 * when the row is the active conversation).
 *
 * Both dialogs are wired to the existing `PATCH` / `DELETE` endpoints. The
 * rename dialog pre-fills with the current title (or the first user-text
 * part if the row has none). The delete dialog requires typing the word
 * `Delete` before the destructive button enables — industry-standard
 * friction for destructive actions.
 */
export function ConversationActionsMenu({
  row,
  isActive,
  pathname,
}: {
  row: ConversationRow;
  isActive: boolean;
  pathname: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(row.title ?? "");
  const [typedConfirm, setTypedConfirm] = useState("");

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch(`/api/conversations/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      const { item } = (await res.json()) as { item: { id: string; title: string | null } };
      return item;
    },
    onMutate: async (title) => {
      await qc.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      const previous = qc.getQueryData<Array<{ id: string; title: string | null }>>(
        CONVERSATIONS_QUERY_KEY,
      );
      qc.setQueryData<Array<{ id: string; title: string | null }>>(
        CONVERSATIONS_QUERY_KEY,
        (old) => (old ?? []).map((i) => (i.id === row.id ? { ...i, title } : i)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(CONVERSATIONS_QUERY_KEY, ctx.previous);
    },
    onSuccess: () => {
      setRenameOpen(false);
      setDraftTitle("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/conversations/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return row.id;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
      const previous = qc.getQueryData<Array<{ id: string }>>(CONVERSATIONS_QUERY_KEY);
      qc.setQueryData<Array<{ id: string }>>(CONVERSATIONS_QUERY_KEY, (old) =>
        (old ?? []).filter((i) => i.id !== row.id),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(CONVERSATIONS_QUERY_KEY, ctx.previous);
    },
    onSuccess: (deletedId) => {
      setDeleteOpen(false);
      setTypedConfirm("");
      if (pathname === `/?c=${deletedId}`) {
        router.push("/");
      }
    },
  });

  const handleRenameSubmit = () => {
    const next = draftTitle.trim();
    if (next.length === 0) return;
    renameMutation.mutate(next.slice(0, MAX_TITLE_LENGTH));
  };

  const handleDeleteConfirm = () => {
    if (typedConfirm !== DELETE_CONFIRMATION_PHRASE) return;
    deleteMutation.mutate();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            aria-label="Conversation actions"
            className={isActive ? "opacity-100" : "opacity-0 group-hover/menu-item:opacity-100"}
          >
            <MoreHorizontal className="size-4" />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        onOpenChange={(open) => {
          setRenameOpen(open);
          if (open) {
            setDraftTitle(row.title ?? "");
          } else {
            setDraftTitle("");
          }
        }}
        open={renameOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Give this conversation a title. The sidebar will show it
              instead of &ldquo;New chat&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">Title</Label>
            <Input
              autoFocus
              id="rename-input"
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
              }}
              placeholder="Conversation title"
              value={draftTitle}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              disabled={renameMutation.isPending || draftTitle.trim().length === 0}
              onClick={handleRenameSubmit}
            >
              {renameMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setTypedConfirm("");
        }}
        open={deleteOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This permanently deletes the conversation and all of its
              messages. The eve-side session is left to expire on its
              own. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono">{DELETE_CONFIRMATION_PHRASE}</span> to confirm
            </Label>
            <Input
              autoFocus
              id="delete-confirm"
              onChange={(e) => setTypedConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDeleteConfirm();
              }}
              placeholder={DELETE_CONFIRMATION_PHRASE}
              value={typedConfirm}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              disabled={
                deleteMutation.isPending ||
                typedConfirm !== DELETE_CONFIRMATION_PHRASE
              }
              onClick={handleDeleteConfirm}
              variant="destructive"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
