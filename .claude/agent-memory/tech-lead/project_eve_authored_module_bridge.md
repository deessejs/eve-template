---
name: project-eve-authored-module-bridge
description: Bridges file `src/internal/authored-module-map-loader.ts` exists to work around vercel/eve#92 until PR #156 ships — do NOT delete without verifying the upstream fix
metadata:
  type: project
---

In `templates/eve-template/`, the file `src/internal/authored-module-map-loader.ts` exists as a workaround. It re-exports `loadCompiledModuleMapFromAuthoredSource` from `node_modules/eve/dist/src/internal/authored-module-map-loader.js`.

**Why:** eve 0.24.4 has a bundling bug (vercel/eve#92) where the dev runtime statically imports `src/internal/authored-module-map-loader.ts` from the project root. If the file doesn't exist, the bundler crashes on first message send with `Cannot find module 'src/internal/authored-module-map-loader.ts'`. The fix is in upstream PR #156 (filed 2026-06-21, after eve@0.24.4 release). PR #156 makes eve's bundler resolve the path internally instead of expecting a user-authored shim.

**How to apply:** Keep this bridge file in place. Don't delete without first confirming a newer eve version is installed AND that PR #156's fix is included (search `node_modules/eve/dist/` for `authored-module-map-loader` references — if it's no longer in any `import` path, the shim is dead). When the day comes to delete: `rm src/internal/authored-module-map-loader.ts && rm -rf src` and one-line commit.

The bridge is also a useful diagnostic: if eve runtime is broken, check that this file is present and that its import still resolves (run `node -e "import('./node_modules/eve/dist/src/internal/authored-module-map-loader.js')"`).
