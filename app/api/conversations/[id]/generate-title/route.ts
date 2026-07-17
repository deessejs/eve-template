import { generateText } from "ai";
import { NextResponse, type NextRequest } from "next/server";
import { minimax } from "vercel-minimax-ai-provider";

import { getConversation, updateConversation } from "@/lib/conversations";
import { assertSameOrigin, requireUser } from "@/lib/require-user";

type RouteContext = { params: Promise<{ id: string }> };

const MIN_USER_MESSAGE_LENGTH = 4;
const MAX_USER_MESSAGE_CHARS = 500;
const MAX_TITLE_CHARS = 80;
const FALLBACK_TITLE_CHARS = 60;

const SYSTEM_PROMPT = [
  "Generate a concise title (3-6 words) for the following user message.",
  "The title should be in the same language as the message.",
  "Use sentence case (capitalize only the first word and proper nouns).",
  "Do NOT include punctuation, quotes, or trailing periods.",
  "Output ONLY the title, nothing else.",
].join("\n");

/**
 * Strip the wrapping quotes, trailing punctuation, and newlines the
 * model occasionally adds. Fall back to a manual truncation of the user
 * message if the model output is unusable (whitespace, very short).
 */
function cleanTitle(raw: string, fallback: string): string {
  let t = raw.trim();
  t = t.replace(/^["'""''`]+|["'""''`]+$/g, "");
  t = t.replace(/[.!?…]+$/, "");
  t = (t.split(/\r?\n/)[0] ?? t).trim();
  t = t.slice(0, MAX_TITLE_CHARS).trim();
  return t.length >= 1 ? t : fallback;
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const sameOrigin = assertSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const body = (await request.json().catch(() => null)) as
    | { userMessage?: string }
    | null;
  const userMessage = body?.userMessage?.trim() ?? "";
  if (userMessage.length < MIN_USER_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "user_message_too_short" },
      { status: 400 },
    );
  }

  // Manual rename wins — if the user has already set a title, leave it.
  const existing = await getConversation(auth.userId, id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.title) {
    return NextResponse.json({ item: existing });
  }

  const truncated = userMessage.slice(0, MAX_USER_MESSAGE_CHARS);
  const fallback = truncated.slice(0, FALLBACK_TITLE_CHARS);

  let generated: string;
  try {
    const { text } = await generateText({
      model: minimax("MiniMax-M3"),
      system: SYSTEM_PROMPT,
      prompt: truncated,
      maxOutputTokens: 50,
      temperature: 0.3,
    });
    generated = cleanTitle(text, fallback);
  } catch (err) {
    // Non-critical: the title is best-effort. Log and use the fallback
    // so the user still gets *something* to recognize in the sidebar.
    console.warn("[generate-title] model call failed, using fallback", err);
    generated = fallback;
  }

  const item = await updateConversation(auth.userId, id, { title: generated });
  return NextResponse.json({ item });
}
