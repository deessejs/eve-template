import { NextResponse, type NextRequest } from "next/server";

import { assertSameOrigin, requireUser } from "@/lib/require-user";
import { createConversation, listConversations } from "@/lib/conversations";

export async function GET(_request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const items = await listConversations(auth.userId);
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const sameOrigin = assertSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const item = await createConversation(auth.userId);
  return NextResponse.json({ item }, { status: 201 });
}
