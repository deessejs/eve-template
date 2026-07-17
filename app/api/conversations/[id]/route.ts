import { NextResponse, type NextRequest } from "next/server";

import { assertSameOrigin, requireUser } from "@/lib/require-user";
import {
  deleteConversation,
  getConversation,
  listEvents,
  updateConversation,
  type ConversationPatch,
} from "@/lib/conversations";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const item = await getConversation(auth.userId, id);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { events } = await listEvents(auth.userId, id, { limit: 100 });
  return NextResponse.json({ item, events });
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const sameOrigin = assertSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as ConversationPatch | null;
  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // Whitelist the patchable fields to avoid users PATCHing eveSessionId etc.
  const patch: {
    title?: string | null;
    pinned?: boolean;
    preview?: string | null;
    archivedAt?: Date | null;
  } = {};
  if (typeof body.title === "string" || body.title === null) patch.title = body.title;
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
  if (typeof body.preview === "string" || body.preview === null) patch.preview = body.preview;
  if (body.archivedAt === null) patch.archivedAt = null;
  else if (body.archivedAt === undefined) {
    /* skip */
  } else {
    return NextResponse.json({ error: "invalid_field" }, { status: 400 });
  }

  const item = await updateConversation(auth.userId, id, patch);
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  const sameOrigin = assertSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const ok = await deleteConversation(auth.userId, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
