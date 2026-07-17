import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Vitest runs through Vite. Vite doesn't read tsconfig.json#paths by
// default, so the `@/...` alias used throughout the project (Next.js
// resolves it at build time) needs to be re-declared here.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      "@": ROOT,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".eve", "dist", "coverage"],
    testTimeout: 30_000, // pglite boot + migrations on first run
    // Per-file: replay-diagnosis uses node (DB-free reducer).
    // The component test uses happy-dom (set in its own file via
    // `// @vitest-environment happy-dom`).
  },
});