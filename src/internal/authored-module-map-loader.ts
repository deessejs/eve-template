// Bridge for vercel/eve#92 — eve 0.24.4 expects a user-authored module
// map loader at this path. The actual implementation lives inside eve's
// dist; we re-export it. This shim goes away once PR #156 ships.
//
// PR #156 changes eve to resolve code-defined models from the bundled
// module map directly rather than expecting this user-authored re-export.
// Until then, this file exists only to satisfy the bundler's static
// import resolution at `src/internal/authored-module-map-loader.ts`.

export {
  loadCompiledModuleMapFromAuthoredSource,
} from "../../node_modules/eve/dist/src/internal/authored-module-map-loader.js";
