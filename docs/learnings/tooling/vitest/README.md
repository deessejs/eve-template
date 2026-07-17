# Vitest — modern test runner for TS-first projects

> **TL;DR.** [Vitest](https://vitest.dev/) is a Vite-native test runner that gives you Jest's API (`describe`/`it`/`expect`) with native ESM, native TypeScript (no `ts-jest`), and the same config as your dev server. For a TypeScript-first project that doesn't already use Jest, it's the obvious choice — one less transpiler in the pipeline, faster watch mode, and zero-config TS support.

---

## Mental model — Vite does the heavy lifting

Vitest piggybacks on [Vite](https://vitejs.dev/)'s transform pipeline. If your project already uses Vite for dev/build (this one doesn't — it uses Next.js, which uses Turbopack — but the principle holds), tests share the same plugins, the same config, the same module resolution.

For a Next.js + Turbopack project like `eve-template`, Vitest still gives you:

- **Native ESM** — no `ts-node`, no `ts-jest`, no Babel config for tests
- **Native TypeScript** via Vite's esbuild transform — runs `.ts` files as-is
- **Jest-compatible API** — `describe`, `it`, `expect`, `vi.mock()`, `vi.fn()`
- **Worker isolation by default** — tests run in parallel by default (Jest runs in a single thread by default)
- **Watch mode that actually works on large projects** — Vite's HMR means re-running tests after a code change is fast

```
┌─────────────────────────────────────────────────────┐
│  vitest (default mode)        ← interactive, watch  │
│  vitest run                  ← CI, run once        │
│  vitest --coverage           ← with v8/istanbul    │
│  vitest --ui                 ← browser-based UI     │
└─────────────────────────────────────────────────────┘
```

---

## When Vitest wins, when it doesn't

### Pick Vitest over Jest when:

- Your project is TypeScript-first
- You value ESM (not "we transpile our ESM to CJS to run tests")
- You want test runs to be parallel by default
- You're starting greenfield — no migration cost
- You use Vite for dev/build

### Pick Jest when:

- You're already on Jest and the migration cost isn't worth it
- You need to ship React Native tests (Vitest's browser mode doesn't cover RN yet)
- Your team has deep Jest plugin knowledge and no time to relearn

### Vitest's positioning vs other runners

| Runner | Headline trade-off |
|---|---|
| **Jest** | Mature, ubiquitous, plugin ecosystem, but the ESM story is awkward |
| **Vitest** | TS-first, Vite-native, fast; assumes you can stand up Vite as a dev dep |
| **uvu** | Tiny, fast, but single-threaded and no watch |
| **Mocha** | Flexible but bare — bring your own assertions, mocks, snapshots |
| **Playwright** | E2E only — complementary to Vitest, not a replacement |
| **node:test** | Built into Node, zero deps, but the API is bare and async-only |

For `eve-template`: Vitest is the right pick. We don't have Jest; we have TS + Node 24 + a smoke test to write.

---

## The config file — `vitest.config.ts`

Most projects don't need one. The defaults work. When you do:

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",          // default; "jsdom" or "happy-dom" for browser-ish
    globals: true,                // if you want describe/it without imports
    include: ["tests/**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next", ".eve", "dist"],
    coverage: {
      provider: "v8",             // or "istanbul"
      reporter: ["text", "html"],
      include: ["agent/**/*.ts", "lib/**/*.ts", "db/**/*.ts"],
    },
  },
});
```

Key inputs:

| Input | Default | Notes |
|---|---|---|
| `environment` | `node` | Switches to `jsdom`/`happy-dom` for component tests. Adds ~50 MB to startup. |
| `globals` | `false` | If `true`, `describe`/`it`/`expect` are global; otherwise you `import { describe, it, expect } from "vitest"`. |
| `include` | `["**/*.{test,spec}.?(c|m)[jt]s?(x)"]` | Glob pattern for test files. |
| `exclude` | standard ignore list | Auto-excludes `node_modules`, `.next`, etc. |
| `coverage.provider` | `v8` | `v8` is faster; `istanbul` is more compatible. |
| `setupFiles` | `[]` | Glob of setup files (e.g. `tests/setup.ts`). |
| `testTimeout` | `5000` ms | Bump for slow integration tests. |

---

## The CLI — three commands cover 95 % of use

| Command | What it does | When |
|---|---|---|
| `vitest` | Watch mode (default). Re-runs tests on file change. | Local dev |
| `vitest run` | Run once, exit. | CI |
| `vitest --coverage` | Run with coverage report. | Pre-release, coverage gates |
| `vitest --ui` | Open the Vitest browser UI. | Debugging failures interactively |

Filters:

- `vitest run auth` — runs only test files whose path contains `auth`
- `vitest run -t "login"` — runs only tests whose name contains `"login"`
- `vitest run --reporter=verbose` — full per-test output instead of dots

---

## The Jest API parity

Vitest implements the Jest API directly. Code that looks like Jest works in Vitest with **zero changes**:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
// or, with globals: true, no imports needed

describe("betterAuthFn", () => {
  it("returns null when no session cookie is present", async () => {
    const result = await betterAuthFn(new Request("http://localhost/"));
    expect(result).toBeNull();
  });

  it("returns a SessionAuthContext when the cookie is valid", async () => {
    const req = new Request("http://localhost/", {
      headers: { cookie: "valid-session=xyz" },
    });
    const ctx = await betterAuthFn(req);
    expect(ctx).toMatchObject({ authenticator: "better-auth" });
  });

  it("returns null for banned users", async () => {
    // …
  });
});
```

Vitest-specific additions worth knowing:

- `vi.mocked(fn)` — type-safe version of Jest's `fn as jest.MockedFunction<typeof fn>`
- `vi.hoisted()` — runs setup code before `vi.mock()` factory calls (useful for env vars)
- `vi.useFakeTimers()` / `vi.useRealTimers()` — same as Jest's timer mocking
- `expect.assertions(n)` — assert that `n` expectations ran

---

## A first smoke test for `eve-template`

What the project actually wants from a smoke test (no DB, no network, no real auth):

```ts
// tests/smoke.test.ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

describe("project structure", () => {
  it("ships the canonical eve agent files", () => {
    expect(existsSync(resolve(ROOT, "agent/agent.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "agent/instructions.md"))).toBe(true);
    expect(existsSync(resolve(ROOT, "agent/channels/eve.ts"))).toBe(true);
  });

  it("ships the web UI surface", () => {
    expect(existsSync(resolve(ROOT, "app/layout.tsx"))).toBe(true);
    expect(existsSync(resolve(ROOT, "app/login/page.tsx"))).toBe(true);
    expect(existsSync(resolve(ROOT, "app/(authenticated)/layout.tsx"))).toBe(true);
  });

  it("ships auth + DB wiring", () => {
    expect(existsSync(resolve(ROOT, "lib/auth.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "lib/auth-client.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "lib/eve-auth.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "db/schema/auth.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "db/migrations/0000_init.sql"))).toBe(true);
  });

  it("exports the right symbols from lib/auth.ts", async () => {
    const mod = await import("../lib/auth");
    expect(mod.auth).toBeDefined();
    // The Auth type is structural — we just check it's exported
    expect(typeof mod.auth.api.getSession).toBe("function");
  });

  it("package.json has the expected fields", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    expect(pkg.name).toBe("my-agent");
    expect(pkg.private).toBe(true);
    expect(pkg.engines.node).toBe("24.x");
  });
});
```

This catches ~80 % of "the build passes but everything is broken" regressions without needing a Postgres, a Next dev server, or an LLM provider.

---

## Wiring into CI

```yaml
# .github/workflows/ci.yml — append a 4th job
test:
  name: Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "24"
        cache: "npm"
    - run: npm install --include=dev --legacy-peer-deps
    - run: npm test
```

`npm test` runs `vitest run` (configured via `package.json#scripts.test`).

---

## How this maps to `eve-template`

Vitest is the right runner here because:

1. **No Jest baggage.** Greenfield choice — no migration story.
2. **TypeScript-native.** The smoke test above uses TS imports and types without a transpiler step.
3. **Next.js + Vitest coexist** — Vitest only owns the test runner role; Next keeps owning build/dev. No conflicts.
4. **Worker isolation by default** means smoke tests against files are fast (no shared state).
5. **`environment: "node"`** is the right default for a backend-heavy scaffold.

What's *not* worth doing yet:

- Coverage gates (no real code to cover yet)
- jsdom environment (no components to render)
- Visual regression tests (that's Playwright, not Vitest)
- Browser mode (no real browser flows to test)

When you do add real tests, two patterns to reach for:

- **`vi.mock("../db")`** — replace the Drizzle pool with a stub to test schema-level code without Postgres
- **`vi.spyOn(auth.api, "getSession")`** — mock better-auth's session resolver to test `app/(authenticated)/layout.tsx` and `agent/channels/eve.ts` end-to-end

---

## Gotchas worth knowing

1. **`environment: "node"` is the default** but if you accidentally pick `jsdom` (because of a copy-pasted config from a React project), startup is ~50 MB heavier and `window`/`document` appear where they shouldn't.
2. **`globals: true` vs explicit imports.** Most projects skip globals so tests are grep-friendly and don't rely on TS lib config.
3. **`vitest run` is what CI calls.** Plain `vitest` enters watch mode and never exits.
4. **Vite version mismatch with Vitest** can cause weird transform errors. Lock them together via `package.json#overrides` if you have a complex setup.
5. **Snapshot tests** use `.snap` files in `__snapshots__/` next to the test file. Commit them; review diffs.
6. **Test discovery** follows the `include` glob. If you write `tests/foo.ts` (no `.test.` suffix), it won't run.
7. **Path aliases** (`@/lib/utils`) work in Vitest if they're in `tsconfig.json` `paths`. No extra config needed.

---

## Should you use it?

**Use Vitest when:**

- Greenfield TS/JS project
- You want Jest's API without Jest's ESM pain
- You value fast watch mode
- You're on Vite (or willing to add it as a dev dep just for tests)

**Skip Vitest when:**

- You're already on Jest and tests pass
- You need React Native coverage
- Your team has standardized on a different runner for tooling consistency

**For `eve-template`:** Vitest + a single smoke test file is the right floor. The next step (when there's actual logic to test) is `vi.mock`-based integration tests against the schema and the eve route-auth chain — but that's not needed on day one.

---

## Sources

- [Vitest guide](https://vitest.dev/guide/) — official docs root
- [Comparisons with other test runners](https://vitest.dev/guide/comparisons) — Vitest's positioning vs Jest, Mocha, Playwright, etc.
- [Vitest config reference](https://vitest.dev/config/) — every config input
- [Vitest CLI](https://vitest.dev/guide/cli) — every command and flag
- [Vitest mocking API](https://vitest.dev/api/vi.html) — `vi.mock`, `vi.fn`, `vi.spyOn`, `vi.hoisted`
- [Vitest vs Jest 2026 — QASkills](https://qaskills.sh/blog/vitest-vs-jest-2026) — recent benchmarks and tradeoffs
- [Migrating from Jest to Vitest 4 — jangwook.net](https://jangwook.net/en/blog/en/vitest-4-jest-migration-guide-2026/) — migration playbook if you ever need it
- [How to Set Up Vitest in a React + TypeScript Project — devtoolbox](https://devtoolbox.blog/vitest-setup-react-typescript-zero-jest-config/) — minimal config walkthrough