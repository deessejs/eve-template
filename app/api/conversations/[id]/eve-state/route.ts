import { NextResponse, type NextRequest } from "next/server";

import { assertSameOrigin, requireUser } from "@/lib/require-user";
import { updateEveState, type EveState } from "@/lib/conversations";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  const sameOrigin = assertSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as
    | (Partial<EveState> & { force?: boolean })
    | null;
  if (!body || typeof body.sessionId !== "string" || typeof body.streamIndex !== "number") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // The LWW guard in `updateEveState` uses `eveStreamIndex`; we forward the
  // current value of the cursor so a stale PATCH (older index) is dropped.
  const item = await updateEveState(auth.userId, id, {
    sessionId: body.sessionId,
    continuationToken: body.continuationToken ?? null,
    streamIndex: body.streamIndex,
  });
  if (!item) return NextResponse.json({ error: "not_found_or_stale" }, { status: 409 });
  return NextResponse.json({ item });
}
