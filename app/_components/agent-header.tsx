"use client";

import { useEveAgent } from "eve/react";
import { cn } from "@/lib/utils";

const AGENT_NAME = "eve-template";

/**
 * The right-hand portion of the chat header. Shows the agent name and
 * a live status dot:
 *   - error   → red, static
 *   - submitted / streaming → green, pulsing (agent is working)
 *   - ready   → muted, static (idle, awaiting next message)
 *
 * The status is sourced from the same `useEveAgent()` instance as the
 * chat surface, so the dot reflects the same turn the user just sent.
 *
 * NOTE: this component calls `useEveAgent()` without any args. It
 * therefore creates its own minimal EveAgentStore — a "no-args" store
 * that subscribes to the agent channel but does not own the session.
 * It only needs the `status` field, which is updated globally as eve
 * publishes session.started / session.waiting / turn.* events.
 */
export function AgentHeader() {
  const agent = useEveAgent();

  const isLive = agent.status === "submitted" || agent.status === "streaming";
  const tone =
    agent.status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : agent.status === "ready"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="truncate font-medium text-sm">{AGENT_NAME}</span>
      <span className="relative flex size-1.5">
        {isLive ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75",
              tone,
            )}
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full transition-colors",
            tone,
          )}
        />
      </span>
    </div>
  );
}
