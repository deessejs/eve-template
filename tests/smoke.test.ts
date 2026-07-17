import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
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
    // The chat page lives under the (with-sidebar) sub-group so the sidebar
    // does not leak into sibling pages (e.g. settings).
    expect(
      existsSync(
        resolve(ROOT, "app/(authenticated)/(with-sidebar)/layout.tsx"),
      ),
    ).toBe(true);
    expect(
      existsSync(resolve(ROOT, "app/(authenticated)/(with-sidebar)/page.tsx")),
    ).toBe(true);
  });

  it("ships auth + DB wiring", () => {
    expect(existsSync(resolve(ROOT, "lib/auth.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "lib/auth-client.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "lib/eve-auth.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "db/schema/auth.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "db/schema/chat.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "db/schema/index.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "db/migrations/0000_init.sql"))).toBe(true);
    expect(
      existsSync(resolve(ROOT, "db/migrations/0001_unusual_red_shift.sql")),
    ).toBe(true);
  });

  it("ships the chat session surface", () => {
    expect(existsSync(resolve(ROOT, "lib/conversations.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "lib/require-user.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "lib/events.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "app/api/conversations/route.ts"))).toBe(
      true,
    );
    expect(
      existsSync(resolve(ROOT, "app/api/conversations/[id]/route.ts")),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          ROOT,
          "app/api/conversations/[id]/eve-state/route.ts",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(ROOT, "app/api/conversations/[id]/events/route.ts"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          ROOT,
          "app/(authenticated)/_components/sidebar.tsx",
        ),
      ),
    ).toBe(true);
  });

  it("ships the shadcn sidebar primitive", () => {
    expect(existsSync(resolve(ROOT, "components/ui/sidebar.tsx"))).toBe(
      true,
    );
    expect(existsSync(resolve(ROOT, "components/ui/sheet.tsx"))).toBe(true);
    expect(existsSync(resolve(ROOT, "hooks/use-mobile.ts"))).toBe(true);
  });

  it("ships community files", () => {
    expect(existsSync(resolve(ROOT, "CONTRIBUTING.md"))).toBe(true);
    expect(existsSync(resolve(ROOT, "CODE_OF_CONDUCT.md"))).toBe(true);
    expect(existsSync(resolve(ROOT, "SECURITY.md"))).toBe(true);
    expect(existsSync(resolve(ROOT, "SUPPORT.md"))).toBe(true);
    expect(existsSync(resolve(ROOT, ".github/PULL_REQUEST_TEMPLATE.md"))).toBe(true);
  });

  it("ships the changesets bootstrap", () => {
    expect(existsSync(resolve(ROOT, ".changeset/config.json"))).toBe(true);
    expect(existsSync(resolve(ROOT, ".changeset/README.md"))).toBe(true);
    expect(existsSync(resolve(ROOT, ".changeset/v0.1.0.md"))).toBe(true);
  });
});

describe("package.json", () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")) as Record<string, unknown> & {
    engines: { node: string };
  };

  it("declares the package private", () => {
    expect(pkg.private).toBe(true);
  });

  it("pins Node 24.x in engines", () => {
    expect(pkg.engines.node).toBe("24.x");
  });

  it("uses module type", () => {
    expect(pkg.type).toBe("module");
  });

  it("has the expected scripts", () => {
    const scripts = pkg.scripts as Record<string, string>;
    expect(scripts.build).toBe("next build");
    expect(scripts.dev).toBe("next dev");
    expect(scripts.typecheck).toBe("tsc --noEmit -p tsconfig.json");
    expect(scripts.lint).toBe("eslint .");
    expect(scripts.test).toBe("vitest run");
  });

  it("includes better-auth and eve as runtime deps", () => {
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps["better-auth"]).toBeDefined();
    expect(deps["eve"]).toBeDefined();
  });
});

describe("better-auth instance", () => {
  it("exports an `auth` instance with the expected API surface", async () => {
    const mod = await import("../lib/auth");
    expect(mod.auth).toBeDefined();
    expect(typeof mod.auth.api.getSession).toBe("function");
    expect(typeof mod.auth.handler).toBeDefined();
  });
});

describe("eve route auth chain", () => {
  it("exports betterAuthFn", async () => {
    const mod = await import("../lib/eve-auth");
    expect(mod.betterAuthFn).toBeDefined();
    expect(typeof mod.betterAuthFn).toBe("function");
  });
});

describe("agent configuration", () => {
  it("default-exports an eve agent definition", async () => {
    const mod = await import("../agent/agent");
    expect(mod.default).toBeDefined();
  });

  it("ships a non-empty instructions.md", () => {
    const md = readFileSync(resolve(ROOT, "agent/instructions.md"), "utf8").trim();
    expect(md.length).toBeGreaterThan(0);
  });
});

describe("Drizzle schema", () => {
  it("exports the four canonical better-auth tables", async () => {
    const schema = await import("../db/schema/auth");
    expect(schema.user).toBeDefined();
    expect(schema.session).toBeDefined();
    expect(schema.account).toBeDefined();
    expect(schema.verification).toBeDefined();
  });
});