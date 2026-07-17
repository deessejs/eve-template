---
"my-agent": patch
---

Auto-title a chat from the first user message: after the first turn settles, a server route calls `generateText` (with the same `minimax` model the agent uses) to derive a 3-6 word title, then patches the conversation. The sidebar updates via the existing TanStack Query cache. One-shot per conversation, skipped if the user has manually set a title, and falls back to a 60-char truncation of the user message on model failure.
