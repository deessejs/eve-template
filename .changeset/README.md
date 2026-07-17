# Changesets

This folder holds the inputs to the project's release pipeline.

The release workflow is **agent-driven**, not GitHub-Actions-driven. The
[`ship`](../../.claude/skills/ship/SKILL.md) and [`release`](../../.claude/skills/release/SKILL.md)
Claude agent skills read the `.changeset/*.md` files in this directory,
determine the next version, and orchestrate the merge → tag → GitHub Release
flow via `gh` and `git`.

## What is a changeset?

A Markdown file with YAML front matter:

```md
---
"<package-name>": <patch|minor|major>
---

A one-paragraph summary of the change.
```

The contributor writes one of these per PR. The release skill consumes all of
them at release time.

## How do I add one?

Drop a file in this directory:

```bash
# Example filename — kebab-case slug of the change
echo '---
"my-agent": minor
---

Short summary of the change.' > .changeset/<slug>.md
git add .changeset/<slug>.md
git commit -m "docs(changeset): add changeset for <slug>"
```

The bump type follows [semver](https://semver.org/):

| Type | Use for |
|---|---|
| `patch` | Bug fixes, internal refactors, no API change |
| `minor` | Backward-compatible new features |
| `major` | Breaking changes |

If your PR doesn't ship a release (CI fix, test-only change, docs-only), use
an **empty changeset**:

```md
---
---

Empty — no version bump. Used to pass a CI gate without shipping.
```

## How do I ship a release?

Run the `ship` skill — it parses the changesets in this folder, prompts for
which PRs to include, cherry-picks them onto a `release/v<X.Y.Z>` branch, and
opens a release PR against `main`. Once that PR merges, the `release` skill
finishes the job: merges to `main`, posts the GitHub Release, tags `v<X.Y.Z>`.

See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) § "Branching model" for the
full picture.

## Why changesets at all (instead of CI-versioning)?

The `create-pr` skill enforces a changeset per PR — same discipline as the
upstream `changesets/changesets` workflow. The difference is *who* runs the
`version` step:

- **Classic changesets** — `changesets/action` opens a "Version Packages"
  PR and (optionally) runs `changeset publish` to npm on merge.
- **`eve-template`** — an agent runs the equivalent commands inline, no npm
  publish (this scaffold isn't a registry package).

Either way, the contributor decision is preserved.

## Deep dive

For the full mental model, every config key, every CLI command, and the
GitHub Action inputs, see
[`docs/learnings/tooling/changesets/README.md`](../../docs/learnings/tooling/changesets/README.md).