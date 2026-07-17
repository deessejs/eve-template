import { AgentChat } from "@/app/_components/agent-chat";
import { getConversation, listConversations, listEvents } from "@/lib/conversations";
import { requireUser } from "@/lib/require-user";
import { redirect } from "next/navigation";

/**
 * The chat page — was `app/(authenticated)/page.tsx` before the
 * `(with-sidebar)/` route group refactor. The group's `layout.tsx` renders
 * the sidebar; this page owns the conversation routing.
 */
type SearchParams = Promise<{ c?: string }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireUser();
  if ("error" in auth) redirect("/login");

  const params = await searchParams;
  const conversationId = params.c;

  const resolvedId = conversationId;
  let initialConversation: Awaited<ReturnType<typeof getConversation>> = null;
  let initialEvents: Awaited<ReturnType<typeof listEvents>>["events"] = [];

  // No `?c=` → resolve to the most-recent non-archived conversation and
  // redirect. This is the deferred decision from `docs/plans/5.md` that
  // surfaces as the most-likely root cause of "no history on reload" in
  // `docs/plans/5.1` — without `?c=`, the page falls through to the empty
  // composer and the user sees no history even though `useEveAgent` would
  // replay events just fine.
  if (!resolvedId) {
    const items = await listConversations(auth.userId, { limit: 1 });
    if (items.length > 0) {
      redirect(`/?c=${items[0].id}`);
    }
    // No conversations: fall through to the empty composer.
  }

  if (resolvedId) {
    initialConversation = await getConversation(auth.userId, resolvedId);
    if (!initialConversation) {
      // The conversation does not exist or belongs to another user.
      redirect("/");
    }
    const ev = await listEvents(auth.userId, resolvedId, { limit: 100 });
    initialEvents = ev.events;
  }

  return (
    <AgentChat
      // React `key` remounts the client component when the conversation
      // changes, so `useEveAgent` re-reads `initialSession` and
      // `initialEvents` for the new thread.
      key={resolvedId ?? "fresh"}
      conversationId={resolvedId ?? null}
      initialConversation={initialConversation}
      initialEvents={initialEvents}
    />
  );
}
