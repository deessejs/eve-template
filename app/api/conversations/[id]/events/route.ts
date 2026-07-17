import { NextResponse, type NextRequest } from "next/server";

import { assertSameOrigin, requireUser } from "@/lib/require-user";
import { appendEvents, listEvents, type IncomingEvent } from "@/lib/conversations";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const sinceParam = url.searchParams.get("since");
  const limitParam = url.searchParams.get("limit");
  const since = sinceParam ? Number.parseInt(sinceParam, 10) : 0;
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;
  if (Number.isNaN(since) || since < 0) {
    return NextResponse.json({ error: "invalid_since" }, { status: 400 });
  }
  if (Number.isNaN(limit) || limit < 1) {
    return NextResponse.json({ error: "invalid_limit" }, { status: 400 });
  }
  const result = await listEvents(auth.userId, id, { since, limit });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const sameOrigin = assertSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as
    | { events?: IncomingEvent[] }
    | null;
  if (!body || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (body.events.length > 500) {
    return NextResponse.json({ error: "batch_too_large" }, { status: 413 });
  }
  const result = await appendEvents(auth.userId, id, body.events);
  return NextResponse.json(result);
}
