import { describe, it, expect } from "vitest";
import { defaultMessageReducer } from "eve/react";

describe("reducer replay diagnosis (issue #5 / 5.1)", () => {
  it("shows what the defaultMessageReducer produces on the persisted events", () => {
    const reducer = defaultMessageReducer();

    // The actual events we just pulled from the live DB (in their heap order,
    // which is what `listEvents` returns when sequence=0 for every row).
    // Payloads are the stored JSON reconstructed back to { type, data, meta }.
    const persistedInDbOrder: Array<{ type: string; data: unknown; meta?: unknown }> = [
      { type: "session.waiting", data: { wait: "next-user-message", continuationToken: "eve:c5cba18a-..." }, meta: { at: "2026-07-17T13:03:19.739Z" } },
      { type: "message.appended", data: { turnId: "turn_0", sequence: 0, stepIndex: 0, messageDelta: " there! How can I help you today?", messageSoFar: "Hey there! How can I help you today?" }, meta: { at: "2026-07-17T13:03:19.639Z" } },
      { type: "step.started", data: { turnId: "turn_0", sequence: 0, stepIndex: 0 }, meta: { at: "2026-07-17T13:03:16.206Z" } },
      { type: "turn.started", data: { turnId: "turn_0", sequence: 0 }, meta: { at: "2026-07-17T13:03:16.123Z" } },
      { type: "message.appended", data: { turnId: "turn_0", sequence: 0, stepIndex: 0, messageDelta: "Hey", messageSoFar: "Hey" }, meta: { at: "2026-07-17T13:03:19.634Z" } },
      { type: "message.completed", data: { turnId: "turn_0", message: "Hey there! How can I help you today?", sequence: 0, stepIndex: 0, finishReason: "stop" }, meta: { at: "2026-07-17T13:03:19.654Z" } },
      { type: "turn.completed", data: { turnId: "turn_0", sequence: 0 }, meta: { at: "2026-07-17T13:03:19.735Z" } },
      { type: "session.started", data: { runtime: { agentId: "my-agent", modelId: "minimax/minimax-m3", agentName: "my-agent", eveVersion: "0.24.4" } }, meta: { at: "2026-07-17T13:03:16.120Z" } },
      { type: "step.completed", data: { usage: { inputTokens: 3027, outputTokens: 10, cacheReadTokens: 114, cacheWriteTokens: 0 }, turnId: "turn_0", sequence: 0, stepIndex: 0, finishReason: "stop" }, meta: { at: "2026-07-17T13:03:19.654Z" } },
      { type: "message.received", data: { parts: [{ text: "heyyy", type: "text" }], turnId: "turn_0", message: "heyyy", sequence: 0 }, meta: { at: "2026-07-17T13:03:16.163Z" } },
    ];

    let data = reducer.initial();
    for (const evt of persistedInDbOrder) {
      data = reducer.reduce(data, evt);
    }

    console.log("\n=== REDUCER OUTPUT (persisted order, current behavior) ===");
    console.log(JSON.stringify(data, null, 2));
    console.log(`\nMessage count: ${data.messages.length}`);

    expect(data.messages.length).toBeGreaterThan(0); // the question: how many?
  });

  it("shows what the reducer produces on the SAME events in CORRECT stream order", () => {
    const reducer = defaultMessageReducer();

    const streamOrder: Array<{ type: string; data: unknown; meta?: unknown }> = [
      { type: "session.started", data: { runtime: {} }, meta: { at: "..." } },
      { type: "turn.started", data: { turnId: "turn_0", sequence: 0 }, meta: { at: "..." } },
      { type: "message.received", data: { parts: [{ text: "heyyy", type: "text" }], turnId: "turn_0", message: "heyyy", sequence: 0 }, meta: { at: "..." } },
      { type: "step.started", data: { turnId: "turn_0", sequence: 0, stepIndex: 0 }, meta: { at: "..." } },
      { type: "message.appended", data: { turnId: "turn_0", sequence: 0, stepIndex: 0, messageDelta: "Hey", messageSoFar: "Hey" }, meta: { at: "..." } },
      { type: "message.appended", data: { turnId: "turn_0", sequence: 0, stepIndex: 0, messageDelta: " there! How can I help you today?", messageSoFar: "Hey there! How can I help you today?" }, meta: { at: "..." } },
      { type: "message.completed", data: { turnId: "turn_0", message: "Hey there! How can I help you today?", sequence: 0, stepIndex: 0, finishReason: "stop" }, meta: { at: "..." } },
      { type: "step.completed", data: { usage: {}, turnId: "turn_0", sequence: 0, stepIndex: 0, finishReason: "stop" }, meta: { at: "..." } },
      { type: "turn.completed", data: { turnId: "turn_0", sequence: 0 }, meta: { at: "..." } },
      { type: "session.waiting", data: { wait: "next-user-message", continuationToken: "eve:..." }, meta: { at: "..." } },
    ];

    let data = reducer.initial();
    for (const evt of streamOrder) {
      data = reducer.reduce(data, evt);
    }

    console.log("\n=== REDUCER OUTPUT (stream order, ideal) ===");
    console.log(JSON.stringify(data, null, 2));
    console.log(`\nMessage count: ${data.messages.length}`);

    expect(data.messages.length).toBeGreaterThan(0);
  });
});
