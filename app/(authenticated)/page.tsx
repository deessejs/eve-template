import { AgentChat } from "@/app/_components/agent-chat";

// The chat page — was app/page.tsx before the auth refactor. Moved under
// the (authenticated) route group so its layout enforces a valid session.
export default function Page() {
  return <AgentChat />;
}
