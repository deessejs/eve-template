"use client";

import type { UserContent } from "ai";
import type { HandleMessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { AgentMessage } from "./agent-message";
import { useEventBatcher } from "./agent-chat-batcher";
import { CONVERSATIONS_QUERY_KEY } from "@/app/(authenticated)/_components/sidebar";
import type { ConversationMeta, PersistedEvent } from "@/lib/conversations";

export function AgentChat({
  conversationId,
  initialConversation,
  initialEvents,
}: {
  readonly conversationId: string | null;
  readonly initialConversation: ConversationMeta | null;
  readonly initialEvents: readonly PersistedEvent[];
}) {
  const batcher = useEventBatcher(conversationId);

  // Build the initial session cursor for `useEveAgent`. If we have a
  // conversation with prior eve state, seed it; otherwise start fresh.
  const initialSession = useRef(
    initialConversation
      ? {
          sessionId: initialConversation.eveSessionId ?? undefined,
          continuationToken: initialConversation.eveContinuationToken ?? undefined,
          streamIndex: initialConversation.eveStreamIndex,
        }
      : undefined,
  );

  // Replay events for the reducer. Stored as raw payloads; the reducer is
  // idempotent over the same event sequence.
  const initialEveEvents = useRef(
    initialEvents.map((e) => {
      const { data, meta } = (e.payload ?? {}) as { data?: unknown; meta?: { at?: string } };
      return {
        type: e.type,
        ...(data !== undefined ? { data } : {}),
        ...(meta ? { meta } : {}),
      } as unknown as HandleMessageStreamEvent;
    }),
  );

  // Track the last-persisted cursor so we can dedupe onSessionChange fires
  // (the hook fires once per turn in the `finally` of `send()`).
  const lastPersisted = useRef<{
    sessionId?: string;
    continuationToken?: string;
    streamIndex: number;
  }>({
    sessionId: initialSession.current?.sessionId,
    continuationToken: initialSession.current?.continuationToken,
    streamIndex: initialSession.current?.streamIndex ?? 0,
  });

  const agent = useEveAgent({
    // Note: the React `key` prop drives remount when switching threads — it's
    // applied on the parent <AgentChat /> in `page.tsx`, NOT here. We do not
    // pass `initialSession` to `useEveAgent` because the React `key` on the
    // parent ensures a fresh hook instance per conversation.
    initialSession: initialSession.current,
    initialEvents: initialEveEvents.current as unknown as readonly HandleMessageStreamEvent[],
    onEvent: (event) => batcher.push(toIncomingEvent(event)),
    onSessionChange: (session) => {
      if (!conversationId) return;
      if (!session.sessionId) return;
      const last = lastPersisted.current;
      if (
        last.sessionId === session.sessionId &&
        last.continuationToken === session.continuationToken &&
        last.streamIndex === session.streamIndex
      ) {
        return; // no-op: cursor unchanged since last PATCH
      }
      lastPersisted.current = {
        sessionId: session.sessionId,
        continuationToken: session.continuationToken,
        streamIndex: session.streamIndex,
      };
      void fetch(`/api/conversations/${conversationId}/eve-state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          continuationToken: session.continuationToken,
          streamIndex: session.streamIndex,
        }),
      });
    },
  });

  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;

  // When a turn settles, the conversation's `updatedAt` and `messageCount`
  // have changed in the DB. Invalidate the sidebar's list cache so the new
  // ordering and counts show up. We only fire on transitions out of
  // `streaming`/`submitted` to keep this cheap (no per-event invalidation).
  const qc = useQueryClient();
  const prevStatusRef = useRef(agent.status);
  useEffect(() => {
    const wasBusy =
      prevStatusRef.current === "submitted" ||
      prevStatusRef.current === "streaming";
    if (wasBusy && (agent.status === "ready" || agent.status === "error")) {
      void qc.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    }
    prevStatusRef.current = agent.status;
  }, [agent.status, qc]);

  // Fire-and-forget auto-title: after the first turn settles, ask the
  // server to generate a 3-6 word title from the first user-text and
  // patch the conversation. One-shot per conversation (ref-guarded),
  // skipped if the user has already manually set a title (server-side
  // check). Errors are logged and swallowed — the title is best-effort.
  const autoTitleFiredRef = useRef(false);
  useEffect(() => {
    if (autoTitleFiredRef.current) return;
    if (agent.status !== "ready") return;
    if (agent.events.length === 0) return;
    if (!conversationId) return;

    const firstUserText = agent.events
      .find((e) => e.type === "message.received")
      ?.data?.parts?.find((p) => p.type === "text")?.text;
    if (typeof firstUserText !== "string") return;
    if (firstUserText.trim().length < 4) return;

    autoTitleFiredRef.current = true;
    const cid = conversationId;
    void fetch(`/api/conversations/${cid}/generate-title`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userMessage: firstUserText.slice(0, 500) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.item?.title) {
          qc.setQueryData<Array<{ id: string; title: string | null }>>(
            CONVERSATIONS_QUERY_KEY,
            (old) =>
              (old ?? []).map((i) =>
                i.id === cid ? { ...i, title: data.item.title } : i,
              ),
          );
        }
      })
      .catch(() => {
        // non-critical
      });
  }, [agent.status, agent.events, conversationId, qc]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((text.length === 0 && message.files.length === 0) || isBusy) return;

    if (message.files.length === 0) {
      await agent.send({ message: text });
      return;
    }

    const parts: UserContent = [];
    if (text.length > 0) {
      parts.push({ text, type: "text" });
    }
    for (const file of message.files) {
      parts.push({
        data: file.url,
        filename: file.filename,
        mediaType: file.mediaType,
        type: "file",
      });
    }

    await agent.send({ message: parts });
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder="Send a message…" />
      <PromptInputSubmit onStop={agent.stop} status={agent.status} />
    </PromptInput>
  );

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {agent.error ? (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5 text-muted-foreground">{agent.error.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
            {agent.data.messages.map((message, index) => (
              <AgentMessage
                canRespond={!isBusy}
                isStreaming={
                  agent.status === "streaming" && index === agent.data.messages.length - 1
                }
                key={message.id}
                message={message}
                onInputResponses={(inputResponses) =>
                  agent.send({ inputResponses })
                }
              />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <div
        className={cn(
          "mx-auto w-full px-4 pt-4 sm:px-6",
          // The composer needs a solid background so messages scrolling
          // behind it (within the Conversation above) don't bleed through.
          // z-10 keeps it above the conversation content. The border-top
          // is a one-pixel visual separator — no shadow to keep the
          // sidebar aesthetic flat.
          "sticky bottom-0 z-10 border-t border-border bg-background",
          isEmpty
            ? "flex max-w-xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]"
            : "max-w-3xl shrink-0 pb-6",
        )}
      >
        <div className="w-full">{composer}</div>
      </div>
    </main>
  );
}

type EveRawEvent = HandleMessageStreamEvent;

function toIncomingEvent(event: EveRawEvent): {
  type: string;
  sequence: number;
  payload: unknown;
} {
  // The `data` and `meta` properties are part of every member of
  // HandleMessageStreamEvent, but the union narrows the optionality per type
  // (e.g. session.completed has no `data`). Read them via a small cast so we
  // don't have to enumerate all 28 union members here.
  const raw = event as unknown as {
    type: string;
    data?: unknown;
    meta?: { at?: string };
  };
  return {
    type: raw.type,
    sequence: 0, // The server assigns monotonic per-conversation sequence at insert; the client doesn't have it.
    payload: { data: raw.data ?? null, meta: raw.meta ?? null },
  };
}
