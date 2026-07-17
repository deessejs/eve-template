"use client";

/**
 * Client-side batcher that coalesces eve stream events into batched POSTs.
 * One flush per ~500ms (or 50 events, whichever first) instead of one fetch()
 * per event. The server-side route absorbs duplicate `eventId` values via
 * `ON CONFLICT DO NOTHING` (see `db/schema/chat.ts`).
 *
 * Usage from `app/_components/agent-chat.tsx`:
 *
 *   const batcher = useEventBatcher(conversationId);
 *   const agent = useEveAgent({ onEvent: (e) => batcher.push(e), ... });
 */

import { useCallback, useEffect, useRef } from "react";

const FLUSH_INTERVAL_MS = 500;
const FLUSH_MAX_EVENTS = 50;
const FLUSH_MAX_RETRIES = 5;

type IncomingEvent = {
  id?: string;
  eventId?: string;
  type: string;
  sequence: number;
  payload: unknown;
};

type BatcherState = {
  buffer: IncomingEvent[];
  retryCount: number;
  flushTimer: ReturnType<typeof setTimeout> | null;
};

export function useEventBatcher(conversationId: string | null) {
  const stateRef = useRef<BatcherState>({
    buffer: [],
    retryCount: 0,
    flushTimer: null,
  });

  const flush = useCallback(async () => {
    if (!conversationId) return;
    const state = stateRef.current;
    if (state.buffer.length === 0) return;
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = null;
    }
    const events = state.buffer;
    state.buffer = [];
    try {
      const res = await fetch(`/api/conversations/${conversationId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events }),
      });
      if (res.ok) {
        state.retryCount = 0;
        return;
      }
      // 4xx other than 401/403/409: drop the batch and log — these are
      // unrecoverable per-event (size, type, ownership) failures.
      if (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 403 && res.status !== 409) {
        console.warn("[eve-batcher] dropping batch", res.status, await res.text());
        state.retryCount = 0;
        return;
      }
      // 401/403/409 or 5xx: retry next tick, capped.
      state.buffer = events.concat(state.buffer);
      state.retryCount += 1;
      if (state.retryCount < FLUSH_MAX_RETRIES) {
        state.flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS * state.retryCount);
      } else {
        console.warn("[eve-batcher] gave up after", FLUSH_MAX_RETRIES, "retries");
        state.retryCount = 0;
      }
    } catch (err) {
      // Network error: retry next tick.
      state.buffer = events.concat(state.buffer);
      state.retryCount += 1;
      if (state.retryCount < FLUSH_MAX_RETRIES) {
        state.flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS * state.retryCount);
      } else {
        console.warn("[eve-batcher] gave up after", FLUSH_MAX_RETRIES, "retries", err);
        state.retryCount = 0;
      }
    }
  }, [conversationId]);

  const push = useCallback(
    (event: IncomingEvent) => {
      const state = stateRef.current;
      state.buffer.push(event);
      if (state.buffer.length >= FLUSH_MAX_EVENTS) {
        void flush();
        return;
      }
      if (!state.flushTimer) {
        state.flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
      }
    },
    [flush],
  );

  // Flush pending events on unmount so we don't lose the tail of a turn when
  // the user navigates away or refreshes mid-stream.
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  return { push, flush };
}
