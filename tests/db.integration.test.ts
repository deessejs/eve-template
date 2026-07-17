import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getTestDb,
  setupTestDb,
  teardownTestDb,
} from "./db-integration-setup";

/**
 * Integration test for the new `conversation` and `conversation_event` tables.
 * Runs against an in-process PGlite instance; no external service required.
 *
 * Scope: the schema, migrations, FKs, indexes, and constraints. Tests for
 * `lib/conversations` business logic live in a separate unit suite (TODO).
 */

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe("db migrations", () => {
  it("applies 0000 + 0001 migrations without error", async () => {
    const db = getTestDb();
    // Confirm both tables exist by issuing a no-op SELECT through each.
    const conv = await db.execute(
      sql.raw("SELECT 1 FROM conversation LIMIT 0"),
    );
    expect(conv).toBeDefined();
    const ev = await db.execute(
      sql.raw("SELECT 1 FROM conversation_event LIMIT 0"),
    );
    expect(ev).toBeDefined();
  });
});

describe("conversation_event idempotency", () => {
  it("absorbs duplicate (conversation_id, event_id) inserts", async () => {
    const db = getTestDb();
    await db.execute(
      sql`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ('u1', 'A', 'a@x', false, now(), now())`,
    );
    await db.execute(
      sql`INSERT INTO conversation (id, user_id, eve_stream_index, message_count, pinned, created_at, updated_at) VALUES ('c1', 'u1', 0, 0, 0, now(), now())`,
    );
    await db.execute(
      sql`INSERT INTO conversation_event (id, conversation_id, sequence, event_id, type, payload, byte_size, created_at) VALUES ('e1', 'c1', 1, 'evt-1', 'session.started', '{}'::jsonb, 2, now())`,
    );
    // Same event_id again — silently absorbed by the UNIQUE.
    await db.execute(
      sql`INSERT INTO conversation_event (id, conversation_id, sequence, event_id, type, payload, byte_size, created_at) VALUES ('e2', 'c1', 1, 'evt-1', 'session.started', '{}'::jsonb, 2, now()) ON CONFLICT (conversation_id, event_id) DO NOTHING`,
    );
    const count = await db.execute(
      sql`SELECT count(*)::int AS c FROM conversation_event WHERE event_id = 'evt-1'`,
    );
    const c = (count as unknown as { rows: { c: number }[] }).rows[0].c;
    expect(c).toBe(1);
  });
});

describe("FK cascade", () => {
  it("deletes a user's conversations and events when the user is removed", async () => {
    const db = getTestDb();
    await db.execute(
      sql`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ('u2', 'B', 'b@x', false, now(), now())`,
    );
    await db.execute(
      sql`INSERT INTO conversation (id, user_id, eve_stream_index, message_count, pinned, created_at, updated_at) VALUES ('c2', 'u2', 0, 0, 0, now(), now())`,
    );
    await db.execute(
      sql`INSERT INTO conversation_event (id, conversation_id, sequence, event_id, type, payload, byte_size, created_at) VALUES ('e3', 'c2', 1, 'evt-3', 'session.started', '{}'::jsonb, 2, now())`,
    );
    await db.execute(sql`DELETE FROM "user" WHERE id = 'u2'`);
    const conv = await db.execute(
      sql`SELECT count(*)::int AS c FROM conversation WHERE user_id = 'u2'`,
    );
    const ev = await db.execute(
      sql`SELECT count(*)::int AS c FROM conversation_event WHERE conversation_id = 'c2'`,
    );
    const convC = (conv as unknown as { rows: { c: number }[] }).rows[0].c;
    const evC = (ev as unknown as { rows: { c: number }[] }).rows[0].c;
    expect(convC).toBe(0);
    expect(evC).toBe(0);
  });
});

describe("conversation_event self-cascade", () => {
  it("deletes events when the parent conversation is removed", async () => {
    const db = getTestDb();
    await db.execute(
      sql`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ('u3', 'C', 'c@x', false, now(), now())`,
    );
    await db.execute(
      sql`INSERT INTO conversation (id, user_id, eve_stream_index, message_count, pinned, created_at, updated_at) VALUES ('c3', 'u3', 0, 0, 0, now(), now())`,
    );
    await db.execute(
      sql`INSERT INTO conversation_event (id, conversation_id, sequence, event_id, type, payload, byte_size, created_at) VALUES ('e4', 'c3', 1, 'evt-4', 'session.started', '{}'::jsonb, 2, now())`,
    );
    await db.execute(sql`DELETE FROM conversation WHERE id = 'c3'`);
    const ev = await db.execute(
      sql`SELECT count(*)::int AS c FROM conversation_event WHERE conversation_id = 'c3'`,
    );
    const evC = (ev as unknown as { rows: { c: number }[] }).rows[0].c;
    expect(evC).toBe(0);
  });
});

describe("indexes", () => {
  it("exposes the four expected user-defined indexes", async () => {
    const db = getTestDb();
    const indexes = await db.execute(
      sql`SELECT indexname FROM pg_indexes WHERE tablename IN ('conversation', 'conversation_event') AND indexname NOT LIKE '%_pkey' ORDER BY indexname`,
    );
    const names = (indexes as unknown as { rows: { indexname: string }[] }).rows
      .map((r) => r.indexname)
      .sort();
    expect(names).toEqual(
      [
        "conversation_event_conversation_event_unique",
        "conversation_event_conversation_sequence_idx",
        "conversation_user_archived_idx",
        "conversation_user_pinned_updated_idx",
      ].sort(),
    );
  });
});

/**
 * Regression for the "no history on reload" bug. The listEvents() query
 * uses `WHERE sequence >= since`. When the client-supplied `sequence` is
 * always 0 (the current state of the wire — the server-assigned monotonic
 * sequence is on the Step 2 roadmap of `docs/plans/5.1`), the filter must
 * be `gte`, not `gt`. An earlier `gt` version excluded every row on the
 * initial load and made the chat history invisible.
 *
 * This test exercises the SQL filter directly via pglite, simulating the
 * all-zero-sequence case that the wire currently produces.
 */
describe("listEvents filter semantics (regression for plan 5.1)", () => {
  it("returns all events when sequence is 0 and the filter is `gte 0`", async () => {
    const db = getTestDb();
    await db.execute(
      sql`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ('u_gt', 'A', 'gte-test@x', false, now(), now())`,
    );
    await db.execute(
      sql`INSERT INTO conversation (id, user_id, eve_stream_index, message_count, pinned, created_at, updated_at) VALUES ('c_gt', 'u_gt', 0, 0, 0, now(), now())`,
    );
    // Insert 5 events, all with sequence=0 (current wire shape).
    for (let i = 0; i < 5; i++) {
      await db.execute(
        sql`INSERT INTO conversation_event (id, conversation_id, sequence, event_id, type, payload, byte_size, created_at) VALUES (${'e_gt_' + i}, 'c_gt', 0, ${'evt-gt-' + i}, 'message.received', '{}'::jsonb, 2, now())`,
      );
    }

    // The fixed filter (`gte 0`) returns all 5 rows.
    const gteRows = await db.execute(
      sql`SELECT count(*)::int AS c FROM conversation_event WHERE conversation_id = 'c_gt' AND sequence >= 0`,
    );
    const gteCount = (gteRows as unknown as { rows: { c: number }[] }).rows[0].c;
    expect(gteCount).toBe(5);

    // The old (broken) filter (`gt 0`) returns 0 rows — the bug.
    const gtRows = await db.execute(
      sql`SELECT count(*)::int AS c FROM conversation_event WHERE conversation_id = 'c_gt' AND sequence > 0`,
    );
    const gtCount = (gtRows as unknown as { rows: { c: number }[] }).rows[0].c;
    expect(gtCount).toBe(0);
  });
});
