# CodeQL — semantic code analysis for security

> **TL;DR.** [CodeQL](https://codeql.github.com/) is GitHub's semantic code analysis engine. It treats source code as data — you query the AST the same way you'd query a database — and ships with a large library of security queries written by GitHub Security Lab and the community. The [`github/codeql-action`](https://github.com/github/codeql-action) wraps the CLI in a GitHub Actions workflow that scans your repo on push/PR and uploads results to the **Security** tab. **Free for public repos**, metered for private. For a TS app with an auth surface, it's the highest-leverage SAST you can add in 15 minutes.

---

## Mental model — language packs + query packs + a CLI

Three layers, each its own artifact:

```
┌────────────────────────────────────────────────────────────────┐
│  1. CodeQL CLI            (the analyzer; ships in the action) │
│  2. Language packs        (one per language: typescript, go,  │
│                            python, java, ruby, swift, …)        │
│  3. Query packs           (collections of .ql files that the   │
│                            CLI runs against the extracted DB)  │
│                                                                 │
│  The action: init → analyze                                    │
│    init    = downloads CLI + language pack, builds the DB      │
│    analyze = runs query packs, uploads SARIF to Code Scanning  │
└────────────────────────────────────────────────────────────────┘
```

For **TypeScript**, the build mode is `none` (it's an interpreted language — no `tsc` step needed to extract the DB). This is the cheapest setup in the CodeQL ecosystem.

---

## Workflow skeleton — the minimum viable CodeQL

```yaml
name: "CodeQL"

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    strategy:
      fail-fast: false
      matrix:
        language: [typescript]

    steps:
      - uses: actions/checkout@v6

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          queries: security-extended

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v4
        with:
          category: /language:${{ matrix.language }}
```

That's it. ~25 lines. On push to `main` or `staging`, or on any PR against those branches, the action:

1. Builds a CodeQL database from your TS source (no actual `npm run build` required for `build-mode: none`)
2. Runs the `security-extended` query pack (more on packs below)
3. Uploads results as SARIF to GitHub Code Scanning
4. Posts annotations on PRs; surfaces alerts in the Security tab

### Required permissions

| Permission | Why | Default |
|---|---|---|
| `security-events: write` | Upload SARIF | Required for advanced setup |
| `contents: read` | Checkout code | Required for private repos |
| `actions: read` | Read workflow metadata | Required |

If you forget `security-events: write`, the workflow runs but silently fails to upload.

---

## Query packs — what gets scanned

The `queries` input controls which pack runs. Three named packs ship by default:

| Pack | Scope | False-positive rate | Recommended for |
|---|---|---|---|
| `security` | Critical vulns: SQLi, XSS, command injection, hardcoded creds | Low | Public repos, minimum surface |
| `security-extended` | `security` + medium-severity, more variants | Low-medium | **Default choice** for most codebases |
| `security-and-quality` | `security-extended` + maintainability/lint alerts | Higher | When you want a single tool for both |

For an auth-heavy TS app, **`security-extended`** is the right starting point. Add `security-and-quality` later if you want code-smell coverage too.

You can also pin a specific version: `queries: security-extended@csharp-2026-07-01`. Unpinned (`@latest` is the default) gets fresh queries weekly — sometimes noisy, often catches new CWE coverage.

### Custom query packs

If you have a recurring vulnerability pattern (e.g. "we always forget to validate `userId` in eve route handlers"), write a `.ql` file and pack it. The action picks it up if you reference it in `queries` as `path/to/local-pack`:

```yaml
- uses: github/codeql-action/init@v4
  with:
    languages: typescript
    queries: security-extended,./codeql-custom-queries
```

Writing a CodeQL query is a real skill — `codeql/` packs for security audits are out of scope here. For 95 % of projects, the upstream `security-extended` pack is enough.

---

## Build modes — for interpreted vs compiled languages

| Mode | When | Notes |
|---|---|---|
| `none` | TS/JS, Python, Ruby | No build step. Cheapest. **Use this for `eve-template`.** |
| `autobuild` | Java, C#, Go (sometimes) | CodeQL tries to detect the build system. Often works, sometimes misses. |
| `manual` | Compiled languages where autobuild fails | You write the build steps between `init` and `analyze`. |

For TypeScript you can omit `build-mode` entirely — `none` is implicit.

If you ever scan a compiled language, prefer `manual` over `autobuild` once you have a working setup; it's more deterministic.

---

## `paths-ignore` — keep the noise down

By default CodeQL scans everything. For most repos you want to ignore:

```yaml
- uses: github/codeql-action/init@v4
  with:
    languages: typescript
    queries: security-extended
    paths-ignore:
      - ".next"
      - "node_modules"
      - ".eve"
      - "**/*.test.ts"
      - "**/*.test.tsx"
      - "tests/**"
```

Critical for `eve-template` because `.eve/dev-runtime/snapshots/` and `.next/` contain generated code that isn't yours.

---

## How this maps to `eve-template`

The project has **two surfaces that CodeQL finds well**:

1. **Auth surface** — `lib/auth.ts`, `lib/eve-auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `app/login/page.tsx`
2. **DB surface** — `db/index.ts`, `db/schema/auth.ts`

CodeQL's TS pack includes queries that catch:

- Hardcoded credentials / secrets
- SQL injection (parameter binding issues)
- XSS via unsafe `dangerouslySetInnerHTML` (none in this repo — good)
- Missing CSRF tokens
- Insecure cookie flags (e.g. setting `secure: false` on a session cookie)
- Insufficient rate limiting on auth endpoints

Concrete CodeQL config for `eve-template`:

```yaml
name: "CodeQL"

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]
  schedule:
    # Weekly cron — catches new CVEs that apply to your code
    - cron: "17 6 * * 1"

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    strategy:
      fail-fast: false
      matrix:
        language: [typescript]

    steps:
      - uses: actions/checkout@v6

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          queries: security-extended
          paths-ignore:
            - ".next"
            - "node_modules"
            - ".eve"
            - ".claude"
            - "**/*.test.ts"
            - "**/*.test.tsx"
            - "tests/**"

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v4
        with:
          category: /language:${{ matrix.language }}
```

The `schedule.cron` is critical: **even without a push, CodeQL re-scans weekly**. That's how it catches a newly disclosed CVE that affects a dep you're using.

The `paths-ignore` for `.claude/` matters — the `agent-memory/` folder contains prose, not code, and CodeQL still scans it if you don't exclude it. (And yes, scanning agent memory for security issues is a fun future category.)

---

## Gotchas worth knowing

1. **`build-mode` is implicitly `none` for TS.** Don't set it explicitly unless you need to override.
2. **`security-extended` runs ~30 queries for TS.** Initial scan takes 3-5 minutes; subsequent scans 1-2 min.
3. **Alerts in Code Scanning ≠ alerts in Dependabot.** Dependabot alerts are about vulnerable deps; CodeQL alerts are about your code. They live in different tabs but complement each other.
4. **`paths-ignore` accepts globs but not regex.** Use `**/*.test.ts` not `\.test\.ts$`.
5. **CodeQL on a fork** doesn't upload to the parent repo's Security tab. PRs from forks still get inline annotations if the fork has Code Scanning enabled.
6. **Initial run will surface a few alerts** even on clean code. Triage them: mark as "won't fix" with a comment, or fix. The point isn't zero alerts — it's knowing what you have.
7. **`category: /language:typescript`** controls how alerts group in the UI. Different per-language scans get different categories — useful if you add Python or Go later.
8. **The action supports pinning to a specific version** (`@v3` vs `@v4`). `@v4` is current (as of 2026). GitHub recommends pinning to a major tag for auto-updates.
9. **CodeQL queries can have non-deterministic results** if a query pack update ships mid-scan. Rerunning on the same commit usually resolves "the alert doesn't reproduce" cases.
10. **You can disable CodeQL on a specific path** with `paths-ignore` — useful for generated code, vendor folders, fixture data.

---

## When to skip CodeQL

- **Private repos without GitHub Advanced Security** — public repos and GHAS-enabled private repos get Code Scanning; otherwise, alerts don't surface.
- **Trivial repos** — a 50-line CLI doesn't need a SAST pipeline.
- **You already have a paid SAST** (Snyk, Semgrep, etc.) and don't want two scanners.

For `eve-template`, none of these apply: it's a public OSS scaffold with a real auth surface. CodeQL is the right floor.

---

## Sources

- [github/codeql-action README](https://github.com/github/codeql-action/blob/main/README.md) — canonical workflow reference
- [Code scanning with CodeQL](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql) — concept overview
- [Workflow configuration options for code scanning](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options) — every input documented
- [Configuring advanced setup for code scanning](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/configuring-advanced-setup-for-code-scanning) — when default isn't enough
- [codeql starter workflow](https://github.com/actions/starter-workflows/blob/main/code-scanning/codeql.yml) — copy-pasteable workflow
- [CodeQL query packs](https://github.com/github/codeql) — the underlying queries (advanced reference)
- [Customizing your advanced setup](https://docs.github.com/en/code-security/code-scanning/creating-an-advanced-setup-for-code-scanning/customizing-your-advanced-setup-for-code-scanning) — custom packs, paths-ignore, matrix tricks
- [GitHub Security Lab](https://securitylab.github.com/) — the humans behind many of the default queries