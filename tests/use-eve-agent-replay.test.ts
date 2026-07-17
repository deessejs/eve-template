// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEveAgent } from "eve/react";

import type { PersistedEvent } from "@/lib/conversations";

/**
 * This test mounts `useEveAgent` exactly the way `agent-chat.tsx` does, with
 * the reconstructed events from the live DB. It checks `agent.data.messages`
 * to confirm whether the bug is in the React glue, the projection, or the
 * wiring on the client side.
 *
 * The "reconstructed" shape here is the inverse of `toIncomingEvent` in
 * `app/_components/agent-chat.tsx` — extracting `{ data, meta }` from the
 * persisted `payload` and re-spreading them at the top level.
 */

const sessionId = "wrun_01KXR2S2N7ZVW2Q0AFKHWMYAD5";
const continuationToken = "eve:c5cba18a-...";
const streamIndex = 10; // approximate, irrelevant for the test

type Reconstructed = {
  type: string;
  data?: unknown;
  meta?: { at: string };
};

function reconstruct(persisted: PersistedEvent[]): Reconstructed[] {
  return persisted.map((e) => {
    const payload = (e.payload ?? {}) as { data?: unknown; meta?: { at?: string } };
    const { data, meta } = payload;
    return {
      type: e.type,
      ...(data !== undefined ? { data } : {}),
      ...(meta && typeof meta === "object" ? { meta } : {}),
    } as Reconstructed;
  });
}

describe("useEveAgent replay (full chain)", () => {
  it("replay of 10 persisted events produces a populated messages array", () => {
    // 10 events pulled from the live DB, in their heap (random) order — the
    // exact order `listEvents` returns when `sequence = 0` for every row.
    const persisted: PersistedEvent[] = [
      { id: "e1", sequence: 0, eventId: "e1", type: "session.waiting", payload: { data: { wait: "next-user-message", continuationToken }, meta: { at: "2026-07-17T13:03:19.739Z" } }, byteSize: 100, createdAt: new Date() },
      { id: "e2", sequence: 0, eventId: "e2", type: "message.appended", payload: { data: { turnId: "turn_0", sequence: 0, stepIndex: 0, messageDelta: " there! How can I help you today?", messageSoFar: "Hey there! How can I help you today?" }, meta: { at: "2026-07-17T13:03:19.639Z" } }, byteSize: 200, createdAt: new Date() },
      { id: "e3", sequence: 0, eventId: "e3", type: "step.started", payload: { data: { turnId: "turn_0", sequence: 0, stepIndex: 0 }, meta: { at: "2026-07-17T13:03:16.206Z" } }, byteSize: 100, createdAt: new Date() },
      { id: "e4", sequence: 0, eventId: "e4", type: "turn.started", payload: { data: { turnId: "turn_0", sequence: 0 }, meta: { at: "2026-07-17T13:03:16.123Z" } }, byteSize: 80, createdAt: new Date() },
      { id: "e5", sequence: 0, eventId: "e5", type: "message.appended", payload: { data: { turnId: "turn_0", sequence: 0, stepIndex: 0, messageDelta: "Hey", messageSoFar: "Hey" }, meta: { at: "2026-07-17T13:03:19.634Z" } }, byteSize: 100, createdAt: new Date() },
      { id: "e6", sequence: 0, eventId: "e6", type: "message.completed", payload: { data: { turnId: "turn_0", message: "Hey there! How can I help you today?", sequence: 0, stepIndex: 0, finishReason: "stop" }, meta: { at: "2026-07-17T13:03:19.654Z" } }, byteSize: 150, createdAt: new Date() },
      { id: "e7", sequence: 0, eventId: "e7", type: "turn.completed", payload: { data: { turnId: "turn_0", sequence: 0 }, meta: { at: "2026-07-17T13:03:19.735Z" } }, byteSize: 60, createdAt: new Date() },
      { id: "e8", sequence: 0, eventId: "e8", type: "session.started", payload: { data: { runtime: { agentId: "my-agent", modelId: "minimax/minimax-m3", agentName: "my-agent", eveVersion: "0.24.4" } }, meta: { at: "2026-07-17T13:03:16.120Z" } }, byteSize: 120, createdAt: new Date() },
      { id: "e9", sequence: 0, eventId: "e9", type: "step.completed", payload: { data: { usage: { inputTokens: 3027, outputTokens: 10, cacheReadTokens: 114, cacheWriteTokens: 0 }, turnId: "turn_0", sequence: 0, stepIndex: 0, finishReason: "stop" }, meta: { at: "2026-07-17T13:03:19.654Z" } }, byteSize: 180, createdAt: new Date() },
      { id: "e10", sequence: 0, eventId: "e10", type: "message.received", payload: { data: { parts: [{ text: "heyyy", type: "text" }], turnId: "turn_0", message: "heyyy", sequence: 0 }, meta: { at: "2026-07-17T13:03:16.163Z" } }, byteSize: 100, createdAt: new Date() },
    ];

    const reconstructed = reconstruct(persisted) as unknown as Parameters<typeof useEveAgent>[0]["initialEvents"];

    const { result } = renderHook(() =>
      useEveAgent({
        initialSession: { sessionId, continuationToken, streamIndex },
        initialEvents: reconstructed,
      }),
    );

    console.log("\n=== useEveAgent agent.data after mount ===");
    console.log("status:", result.current.status);
    console.log("messages.length:", result.current.data.messages.length);
    console.log("events.length:", result.current.events.length);
    console.log("session:", result.current.session);
    console.log("messages:", JSON.stringify(result.current.data.messages, null, 2));

    expect(result.current.data.messages.length).toBeGreaterThan(0);
  });
});
