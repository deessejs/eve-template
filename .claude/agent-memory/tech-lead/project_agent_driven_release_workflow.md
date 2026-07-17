---
name: project-agent-driven-release-workflow
description: eve-template release engineering is agent-driven (skills `ship` + `release`), NOT GitHub-Actions-driven — no `.github/workflows/release.yml` is expected.
metadata:
  type: project
---

In `templates/eve-template/`, the release pipeline is **fully driven by Claude agent skills**, not by GitHub Actions or changesets-bot. The expected wiring is:

- `ship` skill — selects merged PRs from `staging`, cherry-picks them onto a `release/v{NEXT_VERSION}` branch from `main`, opens a release PR.
- `release` skill — after that release PR merges to `main`: verifies CI/changeset, runs `git merge origin/staging --no-ff`, calls `gh release create`, posts changelog, deletes merged branches, tags `v{version}`.
- `.changeset/*.md` files are **read** by the skills to determine the next version (`patch|minor|major`), not processed by an action.

**Why:** On 2026-07-17, the user pointed at `.claude/skills/release/SKILL.md` and `.claude/skills/ship/SKILL.md` to refute an earlier analysis that had flagged "missing `.github/workflows/release.yml`" as a P0 gap. The two skills together implement the whole pipeline through agent-orchestrated `gh` and `git` commands; the on-disk artifacts (`.changeset/`, `CHANGELOG.md`, git tags, GitHub Releases) are produced by the agent at release time, not by an action. This matches the project-level pattern in [[project_eve_template_goal]]: the repo is a scaffold for *building eve agents*, and the agent IS the tooling — not a wrapper around conventional OSS plumbing.

**How to apply:** When reviewing this repo, do not recommend `.github/workflows/release.yml` or changesets-bot — those would be redundant. Do check that (1) `.changeset/` exists for the first release to land, (2) `package.json#version` is bumped by the agent at release time, (3) GitHub Releases appear as the public changelog surface (no need for a `CHANGELOG.md` committed file if Releases are sufficient). If asked "why no CI release workflow", answer with this — the skills ARE the workflow.