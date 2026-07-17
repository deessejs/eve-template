---
"my-agent": minor
---

Add a chat sidebar: persistent conversation list, per-thread eve-session resume, and 8 API routes for managing conversations. Built on the official shadcn `sidebar` primitive. Schema lives in `db/schema/chat.ts` with 2 new tables (`conversation`, `conversation_event`). See README § Chat sessions.
