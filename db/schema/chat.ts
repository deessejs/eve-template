import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * One user-facing chat thread. The durable eve conversation (held server-side
 * by the eve runtime) is referenced by `eveSessionId` + `eveContinuationToken`
 * + `eveStreamIndex`; this row is the per-user index of "my conversations".
 *
 * eve itself does NOT expose a list-sessions API (verified against
 * node_modules/eve/dist/src/protocol/routes.d.ts), so this table is the only
 * way a user can enumerate their threads.
 */
export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Eve-side handles (nullable: the row may exist before the first
    // user message is sent, in which case eve has not assigned a session yet).
    eveSessionId: text("eve_session_id"),
    eveContinuationToken: text("eve_continuation_token"),
    eveStreamIndex: integer("eve_stream_index").default(0).notNull(),

    // UX surface in the sidebar.
    title: text("title"),
    preview: text("preview"),
    messageCount: integer("message_count").default(0).notNull(),
    pinned: integer("pinned").default(0).notNull(),

    // Soft-delete: `archivedAt IS NULL` is the default active filter.
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // Hot path: the sidebar list query. Order by user, then by recency
    // (pinned first, then by updatedAt DESC).
    index("conversation_user_pinned_updated_idx").on(
      t.userId,
      t.pinned,
      t.updatedAt,
    ),
    // Active-filter index: a future "include archived" toggle will need this.
    index("conversation_user_archived_idx").on(t.userId, t.archivedAt),
  ],
);

/**
 * Append-only log of eve stream events for one conversation. Replaying
 * `events` in `sequence` order reconstructs the local reducer state; the
 * durable source of truth is eve's own workflow, but the user-facing truth
 * (what was said, what was rendered) lives here.
 *
 * `eventId` is eve's per-event id (or a client-minted nanoid when eve
 * doesn't ship one). The `UNIQUE` constraint absorbs replay duplicates from
 * the batched POST endpoint.
 */
export const conversationEvent = pgTable(
  "conversation_event",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    byteSize: integer("byte_size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // Reading order for a single conversation.
    index("conversation_event_conversation_sequence_idx").on(
      t.conversationId,
      t.sequence,
    ),
    // Idempotency: the batched POST endpoint may receive the same `eventId`
    // twice (network retry, optimistic double-send). ON CONFLICT DO NOTHING
    // absorbs the duplicate.
    uniqueIndex("conversation_event_conversation_event_unique").on(
      t.conversationId,
      t.eventId,
    ),
  ],
);

export const conversationRelations = relations(conversation, ({ many, one }) => ({
  events: many(conversationEvent),
  owner: one(user, {
    fields: [conversation.userId],
    references: [user.id],
  }),
}));

export const conversationEventRelations = relations(
  conversationEvent,
  ({ one }) => ({
    conversation: one(conversation, {
      fields: [conversationEvent.conversationId],
      references: [conversation.id],
    }),
  }),
);
