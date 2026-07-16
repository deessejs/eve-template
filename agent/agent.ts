import { defineAgent } from "eve";
import { minimax } from "vercel-minimax-ai-provider";

export default defineAgent({
  // Direct provider: vercel-minimax-ai-provider, Anthropic-compatible API.
  // No AI Gateway — we hit api.minimaxi.io/anthropic/v1 directly with
  // the MINIMAX_API_KEY. To switch to OpenAI-compat, swap to
  // `import { minimaxOpenAI } from 'vercel-minimax-ai-provider'`.
  model: minimax("MiniMax-M3"),
});
