/**
 * Whitelist of eve stream-event `type` strings. Any event with a `type` not
 * in this set is dropped client-side before persistence — future eve versions
 * can ship new event types and our schema (`conversation_event.type` is
 * `text NOT NULL`, not a Postgres enum) absorbs them, but the runtime code
 * here only persists the canonical 28.
 *
 * Source of truth: `node_modules/eve/dist/src/protocol/message.d.ts:523`
 * (the `HandleMessageStreamEvent` union, 28 members as of eve 0.24.4).
 */
export const EVE_EVENT_TYPES = new Set<string>([
  "session.started",
  "session.waiting",
  "session.completed",
  "session.failed",
  "turn.started",
  "turn.completed",
  "turn.failed",
  "turn.cancelled",
  "step.started",
  "step.completed",
  "step.failed",
  "message.received",
  "message.appended",
  "message.completed",
  "reasoning.appended",
  "reasoning.completed",
  "actions.requested",
  "action.result",
  "input.requested",
  "authorization.required",
  "authorization.completed",
  "result.completed",
  "compaction.requested",
  "compaction.completed",
  "subagent.started",
  "subagent.called",
  "subagent.completed",
  "subagent.child-event",
]);

/** Hard cap on a single persisted event (JSON-serialized payload size). */
export const MAX_EVENT_BYTE_SIZE = 256 * 1024;

export function isKnownEventType(type: string): boolean {
  return EVE_EVENT_TYPES.has(type);
}
