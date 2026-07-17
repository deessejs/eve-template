import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/db";
import { conversation, conversationEvent } from "@/db/schema/chat";

import { isKnownEventType, MAX_EVENT_BYTE_SIZE } from "@/lib/events";

/**
 * Per-user helpers for the `conversation` and `conversation_event` tables.
 *
 * Every helper takes a verified `userId` as its first argument. The
 * caller (`requireUser()`) is the only place that touches
 * `auth.api.getSession`; the helpers here never trust a caller-supplied
 * identity and always filter by `userId`. This is the same defense-in-depth
 * pattern as better-auth's own queries in `db/schema/auth.ts`.
 */

export type ConversationMeta = {
  readonly id: string;
  readonly userId: string;
  readonly title: string | null;
  readonly preview: string | null;
  readonly messageCount: number;
  readonly pinned: boolean;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly eveSessionId: string | null;
  readonly eveContinuationToken: string | null;
  readonly eveStreamIndex: number;
};

export type ConversationWithEvents = ConversationMeta & {
  readonly events: readonly PersistedEvent[];
};

export type PersistedEvent = {
  readonly id: string;
  readonly sequence: number;
  readonly eventId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly byteSize: number;
  readonly createdAt: Date;
};

export type EveState = {
  readonly sessionId: string;
  readonly continuationToken: string | null;
  readonly streamIndex: number;
};

export type IncomingEvent = {
  readonly id?: string;
  readonly eventId?: string;
  readonly type: string;
  readonly sequence: number;
  readonly payload: unknown;
};

export type AppendResult = {
  readonly accepted: number;
  readonly rejected: ReadonlyArray<{ readonly index: number; readonly reason: string }>;
};

function toMeta(row: typeof conversation.$inferSelect): ConversationMeta {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    preview: row.preview,
    messageCount: row.messageCount,
    pinned: row.pinned !== 0,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    eveSessionId: row.eveSessionId,
    eveContinuationToken: row.eveContinuationToken,
    eveStreamIndex: row.eveStreamIndex,
  };
}

export async function listConversations(
  userId: string,
  { limit = 50 }: { limit?: number } = {},
): Promise<ConversationMeta[]> {
  const rows = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.userId, userId), isNull(conversation.archivedAt)))
    .orderBy(desc(conversation.pinned), desc(conversation.updatedAt))
    .limit(limit);
  return rows.map(toMeta);
}

export async function getConversation(
  userId: string,
  id: string,
): Promise<ConversationMeta | null> {
  const rows = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
    .limit(1);
  const row = rows[0];
  return row ? toMeta(row) : null;
}

export async function createConversation(userId: string): Promise<ConversationMeta> {
  const id = nanoid();
  const rows = await db
    .insert(conversation)
    .values({ id, userId })
    .returning();
  return toMeta(rows[0]!);
}

export type ConversationPatch = {
  readonly title?: string | null;
  readonly pinned?: boolean;
  readonly archivedAt?: Date | null;
  readonly preview?: string | null;
};

export async function updateConversation(
  userId: string,
  id: string,
  patch: ConversationPatch,
): Promise<ConversationMeta | null> {
  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.preview !== undefined) update.preview = patch.preview;
  if (patch.pinned !== undefined) update.pinned = patch.pinned ? 1 : 0;
  if (patch.archivedAt !== undefined) update.archivedAt = patch.archivedAt;
  if (Object.keys(update).length === 0) return getConversation(userId, id);

  const rows = await db
    .update(conversation)
    .set(update)
    .where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
    .returning();
  const row = rows[0];
  return row ? toMeta(row) : null;
}

export async function deleteConversation(userId: string, id: string): Promise<boolean> {
  const result = await db
    .delete(conversation)
    .where(and(eq(conversation.id, id), eq(conversation.userId, userId)))
    .returning({ id: conversation.id });
  return result.length > 0;
}

export async function updateEveState(
  userId: string,
  id: string,
  state: EveState,
): Promise<ConversationMeta | null> {
  // Last-write-wins by `eve_stream_index` — a stale patch (older index) is
  // dropped. The `ON CONFLICT` clause is the safety net for two tabs racing
  // on the same conversation.
  const rows = await db
    .update(conversation)
    .set({
      eveSessionId: state.sessionId,
      eveContinuationToken: state.continuationToken,
      eveStreamIndex: state.streamIndex,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversation.id, id),
        eq(conversation.userId, userId),
        // Only update when the new index is not older than what we have.
        sql`(${conversation.eveStreamIndex} <= ${state.streamIndex})`,
      ),
    )
    .returning();
  const row = rows[0];
  return row ? toMeta(row) : null;
}

export async function appendEvents(
  userId: string,
  conversationId: string,
  events: ReadonlyArray<IncomingEvent>,
): Promise<AppendResult> {
  // Ownership check: refuse to write into a conversation the caller does not
  // own. Done first to avoid the silent-NOOP case where every row is dropped
  // by the ON CONFLICT path on a missing conversation.
  const owner = await getConversation(userId, conversationId);
  if (!owner) {
    return {
      accepted: 0,
      rejected: events.map((_, i) => ({ index: i, reason: "conversation_not_found" })),
    };
  }

  const accepted: typeof conversationEvent.$inferInsert[] = [];
  const rejected: { index: number; reason: string }[] = [];

  events.forEach((evt, index) => {
    const type = evt.type;
    if (!isKnownEventType(type)) {
      rejected.push({ index, reason: "unknown_event_type" });
      return;
    }
    const payloadJson = JSON.stringify(evt.payload ?? null);
    const byteSize = payloadJson.length;
    if (byteSize > MAX_EVENT_BYTE_SIZE) {
      rejected.push({ index, reason: "event_too_large" });
      return;
    }
    accepted.push({
      id: evt.id ?? nanoid(),
      conversationId,
      sequence: evt.sequence,
      eventId: evt.eventId ?? nanoid(),
      type,
      payload: evt.payload ?? null,
      byteSize,
    });
  });

  if (accepted.length > 0) {
    // ON CONFLICT DO NOTHING absorbs duplicates from a network retry
    // (same `event_id` arriving twice). The unique index
    // (conversation_id, event_id) is the source of truth.
    await db
      .insert(conversationEvent)
      .values(accepted)
      .onConflictDoNothing({
        target: [conversationEvent.conversationId, conversationEvent.eventId],
      });
  }

  return { accepted: accepted.length, rejected };
}

export async function listEvents(
  userId: string,
  conversationId: string,
  { since = 0, limit = 100 }: { since?: number; limit?: number } = {},
): Promise<{ events: PersistedEvent[]; hasMore: boolean }> {
  // Ownership check first.
  const owner = await getConversation(userId, conversationId);
  if (!owner) return { events: [], hasMore: false };

  const cappedLimit = Math.min(Math.max(limit, 1), 500);
  const rows = await db
    .select()
    .from(conversationEvent)
    .where(
      and(
        eq(conversationEvent.conversationId, conversationId),
        // `gte` so the initial load (since=0) returns all events. With all
        // events currently sharing `sequence = 0` (the server-assigned
        // monotonic sequence is on the Step 2 roadmap of `docs/plans/5.1`),
        // `gt` would exclude every row.
        gte(conversationEvent.sequence, since),
      ),
    )
    .orderBy(conversationEvent.sequence)
    .limit(cappedLimit + 1);

  const hasMore = rows.length > cappedLimit;
  const sliced = hasMore ? rows.slice(0, cappedLimit) : rows;
  return {
    events: sliced.map((row) => ({
      id: row.id,
      sequence: row.sequence,
      eventId: row.eventId,
      type: row.type,
      payload: row.payload,
      byteSize: row.byteSize,
      createdAt: row.createdAt,
    })),
    hasMore,
  };
}
