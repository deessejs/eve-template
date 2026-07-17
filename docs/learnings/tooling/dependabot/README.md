# Dependabot — automated dependency PRs

> **TL;DR.** [Dependabot](https://docs.github.com/en/code-security/dependabot) is GitHub's built-in bot that opens pull requests whenever a tracked dependency has a new version (or a known vulnerability). It's configured via a single YAML file — `.github/dependabot.yml` — and runs on GitHub's infrastructure (free for public repos, metered for private). For a TypeScript project with a release-critical RC dep (like `eve-template`'s `better-auth@1.7.0-rc.1`), it's the cheapest way to make sure a GA cut doesn't sneak up on you.

---

## Mental model — config + schedule + grouping

The whole configuration sits in one file. GitHub parses it, schedules runs based on the `schedule.interval` you set, and opens PRs. There's no CLI to run locally.

```
┌─────────────────────────────────────────────────────────────┐
│  .github/dependabot.yml                                     │
│                                                             │
│  version: 2                  ← always                       │
│  updates:                                                  │
│    - package-ecosystem: npm  ← per ecosystem                │
│      directory: /                                           │
│      schedule.interval: weekly                              │
│      groups:                                               │
│        prod: ...                                           │
│        dev: ...                                            │
│      labels: [dependencies]                                │
│      commit-message.prefix: "chore(deps)"                   │
└─────────────────────────────────────────────────────────────┘
```

Two important defaults that bite if you don't override them:

1. **Security updates** open a PR as soon as a CVE is published, regardless of `schedule.interval`. They go to the same `target-branch` (default branch) and bypass version cadence.
2. **A 3-day cooldown** applies to *version* updates (not security) — a new release is not considered until 3 days after publication. This dampens "I shipped and immediately yanked" noise. Configurable per dep via `cooldown`.

---

## The schema — top to bottom

### Required keys (these must be present)

| Key | Where | Purpose |
|---|---|---|
| `version` | top-level | Always `2`. The schema version, not the tool version. |
| `updates` | top-level | Array of ecosystem configs. |
| `package-ecosystem` | per update | One of: `npm`, `pip`, `cargo`, `gomod`, `composer`, `bundler`, `maven`, `gradle`, `nuget`, `docker`, `github-actions`, `terraform`, `devcontainers`, etc. |
| `directory` or `directories` | per update | Where the manifest lives. `"/"` for the root. Globbing is supported in `directories` only. |
| `schedule.interval` | per update | `daily`, `weekly`, `monthly`, `quarterly`, `semiannually`, `yearly`, or `cron` (5-field cron expression). |

### Optional keys you'll likely touch

| Key | Default | What it does |
|---|---|---|
| `schedule.day` | varies by interval | `monday`–`sunday`. With `weekly`, defaults to whichever day the config was first parsed. |
| `schedule.time` | `06:00 UTC` | Hour-of-day for the run. |
| `schedule.timezone` | `UTC` | IANA tz (e.g. `Europe/Paris`). |
| `open-pull-requests-limit` | `5` | Max open Dependabot PRs at once. Lower it if your CI is slow. |
| `labels` | none | Array of label names applied to every PR. |
| `assignees` | none | GitHub usernames with write access. |
| `reviewers` | none | GitHub usernames / team slugs. |
| `commit-message.prefix` | inferred from repo history | Prefix on the commit message + PR title. E.g. `"chore(deps)"` for `chore(deps): bump foo from 1.0 to 1.1`. |
| `commit-message.include` | `scope` | Appends `deps` or `deps-dev` after the prefix. |
| `target-branch` | default branch | Where Dependabot opens the PR. Useful when you have a `staging` integration branch. |
| `versioning-strategy` | `increase` (npm: `lockfile`) | `increase` / `lockfile-only` / `widen` / `increase-if-necessary`. |
| `rebase-strategy` | `auto` | `auto`, `disabled`, or `conflicting`. Controls how Dependabot handles merge conflicts on its open PR. |
| `groups` | none | Bundle multiple deps into one PR — see below. |
| `allow` / `ignore` | none | Whitelist / blacklist with `dependency-name`, `dependency-type`, `versions`, `update-types`. |
| `cooldown` | 3 days | Per-dep cooldown. Configurable for major/minor/patch bumps separately. |

### The `groups` block — the noise reducer

By default, Dependabot opens **one PR per dependency**. With 50 deps, you get 50 PRs on Monday morning after a renovate-equivalent release spree. The `groups` block bundles them:

```yaml
groups:
  prod:
    dependency-type: production
    update-types: [minor, patch]
  dev:
    dependency-type: development
  better-auth-major:
    dependency-name: better-auth
    update-types: [major]
```

Rules of thumb:

- Group by `dependency-type` (production / development) first — it almost always matches your mental model.
- Add a special-purpose group for things that need careful review (RC → GA migrations, breaking-change-prone libs).
- Within a group, Dependabot's PR title becomes the group's identifier.
- A dep matching multiple groups lands in the **first** one that matches.

---

## The `cooldown` block — the patience knob

Available since 2024. Default is **3 days for version updates** (security updates skip cooldown).

```yaml
cooldown:
  default-days: 7                  # default for any dep not in semver-* lists
  semver-major-days: 30            # wait 30d before proposing a major
  semver-minor-days: 7
  semver-patch-days: 0
  include: ["@types/*"]            # per-dep overrides
  exclude: ["typescript"]          # always-update overrides
```

Useful when:

- Your deps have a history of yanked releases
- You want majors to age a few weeks before they hit your inbox
- You use type packages that should update immediately

`exclude` always wins over `include` if a dep appears in both.

---

## npm-specific notes

- **`directory: "/"`** for a single-package repo, or per-package dirs for monorepos.
- **`dependency-type: production | development`** is supported (matches `package.json#dependencies` vs `devDependencies`). `indirect` is **not** supported for npm — only direct deps are tracked.
- **Lockfile-only updates** are the default. Dependabot updates `package-lock.json` to the new minor without bumping `package.json` unless the new version forces a new range. `versioning-strategy: increase` lets it bump `package.json` too.
- **`commit-message.prefix: "chore(deps)"`** matches the project's conventional-commits style.
- **Workspace protocol** (`workspace:*`) is supported; Dependabot handles it like any other range.

---

## GitHub Actions ecosystem — bonus

You can also update Actions versions with Dependabot:

```yaml
- package-ecosystem: "github-actions"
  directory: "/"
  schedule:
    interval: "weekly"
  groups:
    actions:
      patterns: ["*"]
```

Critical for a project whose CI depends on `actions/checkout@v4`, `actions/setup-node@v4`, `github/codeql-action/init@v3`. Pinning to a major (`@v4`) means Dependabot will suggest patch updates within v4; if a v5 ships and you want to track it, you have to bump the major by hand.

---

## How this maps to `eve-template`

The project is **sitting on three release-critical upgrade tracks** that Dependabot would catch:

| Track | Why it matters | Suggested Dependabot config |
|---|---|---|
| `better-auth@1.7.0-rc.1` → 1.7 GA | RC overrides (`jose ^6.1.0`, `kysely ^0.28.17`) become stale on GA. Without Dependabot, you find out the day after a CI break. | `groups: { "better-auth-track": { dependency-name: "better-auth", update-types: [major] } }` + weekly cadence |
| `eve@^0.24.4` | eve is at 0.x — minor bumps can carry breaking changes per semver. | weekly, in `prod` group with `update-types: [minor, patch]` |
| `ai@^7.0.26` (and other RC-adjacent deps) | RC-shaped deps break often. | weekly, separate group, faster cooldown (default 3 days) |

Concrete minimal config for the project:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels: ["dependencies"]
    commit-message:
      prefix: "chore(deps)"
      include: "scope"
    groups:
      production:
        dependency-type: production
        update-types: [minor, patch]
      development:
        dependency-type: development
      breaking-track:
        dependency-name: ["better-auth", "eve"]
        update-types: [major]
    ignore:
      - dependency-name: "typescript"
        update-types: [version-update:semver-major]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      actions:
        patterns: ["*"]
```

This produces ~3-5 PRs per week max (one per group), each with a focused scope. CI runs on each, so a bad dep is caught at PR time, not after merge.

---

## Gotchas worth knowing

1. **The 3-day default cooldown is invisible** until you wonder why a release that shipped Friday hasn't appeared Monday. Set your own `cooldown` to make it explicit.
2. **`open-pull-requests-limit: 5` is not a rate limit, it's a queue size.** Dependabot stops opening new PRs when the count is hit. Lower it to keep the queue manageable; raise it if you batch-merge.
3. **`target-branch` defaults to the repo's default branch.** If you have a `staging` integration branch and want Dependabot to open PRs there instead, set it. The default branch still receives *security* updates unless you override per-update.
4. **Dependabot does NOT run `npm install`** in its own runner. It computes the diff and edits the lockfile; CI runs the install. A broken CI on a Dependabot PR is your signal, not theirs.
5. **`dependency-name: "foo*"`** with a trailing wildcard matches any name starting with `foo`. Useful for scope-based grouping (`@types/*`).
6. **`groups` and `ignore` interact.** A dep listed in a group's `exclude-patterns` is still subject to the `ignore` filter. The order is: `allow` → `ignore` → groups.
7. **Dependabot on GitHub Enterprise Server** lags ~1-2 minor versions behind GitHub.com. Don't pin features that landed in the last 30 days if you target GHES.

---

## Should you use it?

**Use Dependabot when:**

- You have >10 deps in `package.json`
- Any of them are RC, 0.x, or known-fast-moving
- You want security CVEs caught and fixed without manual triage
- You can tolerate a weekly trickle of small PRs

**Skip it when:**

- Your deps are hand-pinned for stability and you review upgrades manually
- You're on a paid Renovate tier and don't want two bots
- Your CI is so slow that PR queue matters more than PR freshness

**For `eve-template` specifically:** it's borderline-mandatory. The combination of an RC dep (better-auth) + a 0.x dep (eve) + overrides that break on dep upgrades means silent debt accumulates fast. Set it up with groups, weekly cadence, and a `breaking-track` group for the two deps that warrant eyes-on review.

---

## Sources

- [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) — full schema, every key documented
- [Configuring Dependabot version updates](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/customizing-dependency-updates) — tutorials and examples
- [Customizing dependency updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates) — step-by-step
- [Dependabot's own `dependabot.yml`](https://github.com/dependabot/dependabot-core/blob/main/.github/dependabot.yml) — real-world example with multiple ecosystems and groups
- [Dependabot version updates docs root](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates) — landing page for all sub-docs
- [dependabot-v2.json JSON Schema](https://catalog.lintel.tools/schemas/github/dependabot-v2-json/) — machine-readable schema for validators