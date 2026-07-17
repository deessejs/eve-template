---
"my-agent": patch
---

Fix: reload of `/` (without `?c=<id>`) now resolves to the most-recent non-archived conversation via `redirect(/?c=<id>)`. Before, the page fell through to the empty composer even though `useEveAgent` would replay events just fine. This is the deferred decision from `docs/plans/5.md` that surfaces as the most-likely root cause of "no history on reload" in `docs/plans/5.1`.

No data-layer changes; the 10 events persisted to `conversation_event` are projected correctly by the default reducer (verified by `tests/replay-diagnosis.test.ts` and `tests/use-eve-agent-replay.test.ts`).
