# changesets — versioning & changelog for humans-in-the-loop

> **TL;DR.** [Changesets](https://github.com/changesets/changesets) is a versioning and changelog tool built around a single discipline: **the contributor, not the maintainer, decides what kind of change they're shipping**. The contributor writes a Markdown file (`.changeset/<name>.md`) containing a semver bump (`patch` / `minor` / `major`) and a one-paragraph note. A `version` command later consumes every pending changeset, applies the bumps, writes changelogs, and is the gate that determines what ships. Originally designed for monorepos (and still the default expectation) but it works just as well on single-package repos. The [`changesets/action`](https://github.com/changesets/action) wraps `version` and `publish` in a GitHub Actions PR pipeline.

---

## The mental model — three commands, one source of truth

```
┌────────────────────────────────────────────────────────────────────┐
│  1. changeset add       (per PR)                                   │
│     → author writes .changeset/<name>.md with bump + summary       │
│                                                                    │
│  2. changeset version   (at release time)                          │
│     → reads every .changeset/*.md in the directory                │
│     → writes CHANGELOG.md per package                              │
│     → bumps package.json versions, deletes consumed changesets     │
│     → opens a "Version Packages" PR via the GitHub Action          │
│                                                                    │
│  3. changeset publish   (after the version PR merges)              │
│     → npm publish (or pnpm publish) on every package whose         │
│       version is newer than the registry                          │
│     → creates git tags                                            │
└────────────────────────────────────────────────────────────────────┘
```

The split is the key: **decision-time** (`add`) and **release-time** (`version` + `publish`) are decoupled. The contributor makes the call at the moment they understand the change; the maintainer just orchestrates when to run `version`.

---

## The changeset file — the atomic unit

A changeset is a Markdown file with a YAML front matter. Two pieces of info: which packages bump, and by how much.

```markdown
---
"@org/web": minor
"@org/api": patch
---

Add OAuth login. Bumps API to record the social-provider field.
```

| Front matter field | Meaning |
|---|---|
| `<package-name>` | Package(s) affected. In a single-package repo, just `"my-agent": patch` (matches `package.json#name`). |
| bump type | One of `patch`, `minor`, `major` (semver). |
| empty body (`--- ---`) | A `--empty` changeset — used to land a PR that doesn't ship a release (CI fixes, test changes). |

When a PR adds an empty changeset, the version command treats it as a no-op but still consumes the file (it gets deleted). This is the escape hatch when you need a CI gate but no version bump.

The filename is the only free-form part — `random-word.md`, or a slug like `oauth-login.md`. Whatever ships.

---

## Commands

Five commands do 95 % of the work. Everything else is configuration.

| Command | What it does | When |
|---|---|---|
| `changeset init` | Creates `.changeset/config.json` and a readme. Run once. | Project bootstrap |
| `changeset add` | Walks the changed packages, asks for bump type + summary, writes `.changeset/*.md`. Per PR. | Author time |
| `changeset version` | Consumes every changeset, bumps versions, writes `CHANGELOG.md`, deletes the changesets. | Release time |
| `changeset status [--since=ref]` | Reports whether changesets are pending. Exit code 1 if missing. | CI gate |
| `changeset publish [--tag=foo] [--otp=…]` | `npm publish` for every package whose version isn't on the registry yet, then `git tag`. | After `version` |

Two extras worth knowing:

- `changeset pre enter <tag>` / `changeset pre exit` — toggle pre-release mode (`1.0.0-next.0`). Complicated; only useful for staged releases.
- `changeset git-tag` — emits git tags *without* publishing. Useful when you ship via `pnpm publish -r` or another tool but still want changesets to manage versions.

> `status` will fail if you're in the middle of `version` or `publish`. If you want status "at the moment of version", run it immediately before `version`.

---

## `config.json` — the full surface

The default config has 12 keys. Five are monorepo-only and can be ignored on a single-package repo.

```jsonc
{
  "changelog": "@changesets/cli/changelog",  // path; false to skip; or module
  "commit": false,                            // true | false | ["path", options]
  "fixed": [],                                // monorepo: lock two pkgs to same bump
  "linked": [],                               // monorepo: share version across pkgs
  "access": "restricted",                     // "restricted" | "public"
  "baseBranch": "master",                     // git ref for diffing what changed
  "updateInternalDependencies": "patch",      // monorepo only
  "ignore": [],                               // monorepo: skip these on publish
  "bumpVersionsWithWorkspaceProtocolOnly": false, // monorepo only
  "changedFilePatterns": ["**"],              // globs that count as a change
  "format": "auto",                           // auto-detect prettier/oxfmt/dprint
  "privatePackages": { "version": true, "tag": false }
}
```

### Keys that matter for a single-package repo

| Key | Default | What to think about |
|---|---|---|
| `baseBranch` | `master` | Set to your real default branch. **Change to `main`** in 99 % of modern repos. |
| `access` | `restricted` | Flip to `"public"` if you publish to npm under an unscoped name, or under any scope that should be public. Scoped packages default to restricted; you'll need to set this explicitly. |
| `commit` | `false` | `true` makes `add` and `version` auto-commit. Convenient, but couples to your git config (committer name/email). Leave `false` if you want a clean staging area. |
| `changelog` | `@changesets/cli/changelog` | Switch to `@changesets/changelog-github` with `{ repo: "<org>/<repo>" }` to embed PR links and contributor thanks-yous. |
| `privatePackages.version` | `true` | If your app is `private: true` in `package.json`, this controls whether `version` still bumps the version field. Set `false` if you don't want CI to touch it. |

### Keys only meaningful for monorepos

`fixed`, `linked`, `ignore`, `updateInternalDependencies`, `bumpVersionsWithWorkspaceProtocolOnly` — see the [config-file-options doc](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md). Skip these for a single-package repo.

### Custom changelog generators

`changelog` accepts a module path that exports:

```ts
{ getReleaseLine, getDependencyReleaseLine }
```

`@changesets/changelog-git` (commit links) and `@changesets/changelog-github` (PR links + thanks) are the two maintained ones. `changelog-github` requires GitHub auth.

---

## Automating it on GitHub

There are two concerns: **(1)** making sure PRs ship with a changeset, and **(2)** running `version` + `publish` without a human babysitting `npm login`.

### (1) Enforcing that PRs include a changeset

Two flavors:

**Non-blocking (recommended for most OSS):**
Install the [changeset-bot](https://github.com/apps/changeset-bot) GitHub App. It comments on PRs without a changeset and (as a maintainer) lets you add one from the PR itself. Doesn't block merges.

**Blocking (good for libraries / paid products):**
Add a CI step:

```yaml
- run: npx changeset status --since=main
```

Exit code is non-zero if there are no changesets since `main`. Pair with a job-level `continue-on-error: false` (the default).

For the rare case where you want to merge without shipping, the contributor runs `changeset --empty`.

### (2) Running `version` + `publish` on merge

The canonical recipe is [`changesets/action`](https://github.com/changesets/action). It opens a **"Version Packages" PR** that always contains the latest run of `changeset version`. Merge it to ship; configure it to also `publish` if you want npm releases automatic.

Minimal `release.yml`:

```yaml
name: Release
on:
  push:
    branches: [main]
concurrency: ${{ github.workflow }}-${{ github.ref }}
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with: { node-version: 26 }
      - run: npm ci
      - uses: changesets/action@v2
```

Useful inputs (defaults in parens):

| Input | Default | Notes |
|---|---|---|
| `publish-script` | — | Required to publish. Must call `changeset publish`. |
| `version-script` | `changeset version` | Override if you wrap `changeset version` in custom logic. |
| `commit` | enabled | Auto-commits and pushes the version PR. |
| `create-github-releases` | `true` | Adds a GitHub Release per published package. |
| `push-git-tags` | `true` | Pushes tags after publish. |
| `commit-mode` | `git-cli` | `git-cli` (default) or `github-api` (GPG-signed via `GITHUB_TOKEN`). |
| `pr-draft` | unset | `create` = draft new PRs; `always` = revert existing to draft. |
| `setup-git-user` | `true` | Sets committer to `github-actions[bot]`. |

The action's `hasChangesets` output (`true` / `false`) is the gate for your downstream publish step — useful when you have your own custom publish command.

### Manual RC workflow (no action)

The maintainer of changesets recommends it only as a fallback, but it's what an agent-driven workflow looks like:

1. Stop merges to `main`.
2. Pull `main`, run `changeset version`, commit, push as a PR.
3. Merge the version PR.
4. Pull `main` again, run `changeset publish`.
5. `git push --follow-tags`.
6. Re-open merges.

The two `pull` steps are necessary because `version` and `publish` shouldn't share a commit (you want to review what `version` wrote before publishing).

---

## What changesets is *not*

- **Not** a dependency updater. That's Dependabot / Renovate territory.
- **Not** a release-note generator that writes marketing copy. It's a Markdown source-of-truth that *can* feed a generator.
- **Not** tied to npm. You can use it without ever publishing — it still bumps versions and writes changelogs (set `privatePackages.version: true` and `private: true` on the package).
- **Not** limited to monorepos anymore, though that's its origin story.

---

## How this maps to `eve-template`

The project's release pipeline is **agent-driven**, not GitHub-Actions-driven (see [[../../vercel/eve/auth.md]]'s sister doc on the project's release philosophy — `ship` + `release` skills orchestrate `gh` and `git` directly). Changesets fits this as a **data layer**, not a runtime:

| Stage | In the eve-template skills | In a classic changesets repo |
|---|---|---|
| Per-PR bump decision | `create-pr/SKILL.md` §6 enforces a `.changeset/*.md` file in every PR, with type `patch \| minor \| major` chosen by the contributor | `changeset add` CLI, also `patch \| minor \| major` |
| Version determination | `ship/SKILL.md` §1 parses `.changeset/*.md` for `^## <semver>` | `changeset version` CLI |
| Changelog | `release/SKILL.md` §3 either auto-generates from commits (Option A: "if CI generates it") or from `git log` (Option B) | `changeset version` writes `CHANGELOG.md` |
| GitHub Release | `release/SKILL.md` §4 calls `gh release create v{version}` | `changesets/action` with `create-github-releases: true` |
| Tag | `release/SKILL.md` §5 tags `v{version}` | `changesets/action` with `push-git-tags: true` |

Two practical consequences:

1. **The skills expect the changesets file format, but don't run the `changesets` CLI.** The project doesn't need `@changesets/cli` as a dependency. It just needs the file format that the skills parse.
2. **`CHANGELOG.md` is not currently committed** — `release/SKILL.md` §3 prefers the GitHub Release UI as the canonical surface. If you want a `CHANGELOG.md` checked into the repo, you'd need to either run `changeset version` manually before the release, or hand-write the file using the same Markdown structure changesets produces (so future tools can parse it).

The `create-pr` skill's enforcement of a `.changeset/*.md` per PR is a clean port of the changesets discipline to an agent-driven repo: the *human-decision-at-PR-time* invariant is preserved; the *release-orchestration* layer is delegated to the agent instead of an action.

---

## Gotchas worth knowing

1. **`.changeset/` must be committed.** Changes are file-based; nothing ships from local files.
2. **`baseBranch` default is `master`, not `main`.** Change it explicitly if your default branch is `main`. Almost every repo trips on this once.
3. **`status` exits 1 mid-`version`.** Don't run them in the same CI step.
4. **Empty changesets (`changeset --empty`) are for non-release PRs that still need to pass a CI gate.** They get consumed but bump nothing.
5. **Pre-release mode is finicky.** `changeset pre enter <tag>` / `pre exit` — read the [prereleases doc](https://github.com/changesets/changesets/blob/main/docs/prereleases.md) before using. Many safety rails come off.
6. **`access: "restricted"` is the default.** Forgetting this is the #1 reason a public scoped package silently publishes private.
7. **Don't `commit: true` if your CI uses a different committer identity than your dev setup.** The action's `setup-git-user` defaults to `github-actions[bot]`, which is fine; locally, `commit: true` uses *your* configured committer.

---

## Should you use it?

**Use changesets when:**

- You publish npm packages (it's the de facto standard for TS monorepos)
- You want per-PR contributor decisions about semver impact
- You want auto-generated changelogs that humans read
- You can tolerate a `Version Packages` PR in your workflow

**Skip it when:**

- You're not publishing to a registry (no `version` field needs to move)
- Your changelogs are curated by hand (the discipline adds friction without payoff)
- You're using semantic-release or release-please and don't want two versioners

**For `eve-template` specifically:** keep the `.changeset/*.md` discipline via the skills; don't add `@changesets/cli` as a dependency unless you also want `changeset version` to run (which would be redundant with the `release` skill's manual `gh release create`).

---

## Sources

- [changesets/changesets](https://github.com/changesets/changesets) — repo, 12K stars, MIT, primary docs source for this doc
- [changesets/action](https://github.com/changesets/action) — GitHub Action, 1K stars, MIT
- [intro-to-using-changesets.md](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md) — three-command mental model
- [command-line-options.md](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md) — full CLI reference
- [config-file-options.md](https://github.com/changesets/changesets/blob/main/docs/config-file-options.md) — every key in `config.json`, defaults, monorepo carve-outs
- [automating-changesets.md](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md) — bot + action + manual RC workflow
- [adding-a-changeset.md](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md) — contributor-facing guide
- [DevTools Guide — Changesets: Automated Versioning](https://www.devtoolsguide.com/changesets-versioning-guide/) — third-party walkthrough
- [Ignace Maes — Automate NPM releases with Changesets](https://blog.ignacemaes.com/automate-npm-releases-on-github-using-changesets/) — opinionated GitHub-Actions recipe
- [Dimitrios Lytras — Ditching manual releases with Changesets](https://dnlytras.com/blog/using-changesets) — adoption story, pitfalls in practice