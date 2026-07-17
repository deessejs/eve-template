---
name: release
description: Complete a release — merge staging to main, generate changelog, clean up branches, post release notes. Run after review-pr approves.
---

# `release` Skill

Complete a release: verify CI is green, merge staging to main, generate changelog, clean up branches, post release notes.

## When to use

**Trigger phrases:** "release", "/release", "ship it", "deploy".

Run this **after** `/review-pr` approves — CI must be green on staging before merging.

## Prerequisites

1. All PRs targeting `staging` are approved and merged
2. CI is green on `staging`
3. A changeset file (`.changeset/*.md`) exists in `main`

## Workflow overview

```
0. Reset       — return to main and pull latest
1. Fetch       — verify CI, check changeset, check staging is empty
2. Merge       — merge staging to main
3. Generate    — changelog from commits since last release
4. Publish     — post release notes
5. Clean       — delete merged branches, tag if needed
```

## §0 — Reset (always)

```bash
git checkout main && git pull origin main
```

## §1 — Fetch

### Check 1 — CI is green

Verify CI passed on the latest staging commit:

```bash
gh run list --workflow=ci.yml --branch=staging --status=completed --limit=1
```

If CI is not green:
> "CI is not passing on staging. Fix failing checks before releasing."

### Check 2 — Changeset exists

Verify a changeset file exists in main:

```bash
git ls-tree -r --name-only origin/main | grep "^.changeset/"
```

If no changeset:
> "No changeset found in main. Create one with `<pkg-manager> changeset add` before releasing."

### Check 3 — Staging is empty

Verify all PRs are merged:

```bash
gh pr list --base staging --state=open --limit=1
```

If open PRs exist:
> "Open PRs are targeting staging. Merge or close them before releasing."

### Check 4 — Determine changeset type

Read the changeset file to determine the version bump:

```bash
cat .changeset/*.md
```

Note: `patch`, `minor`, or `major`.

## §2 — Merge

Merge staging to main:

```bash
git checkout main
git merge origin/staging --no-ff -m "Merge staging into main

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

> "Staging merged into main. The changeset will trigger the release workflow."

## §3 — Generate changelog

Generate a changelog from the commits since the last release.

### Option A — Automated (if CI generates it)

If your CI generates a changelog automatically on merge to main:
> "Changelog is generated automatically by CI. It will appear in the release workflow output."

### Option B — Manual

If no automated changelog:

```bash
# Get commits since last release tag
git log --oneline $(git describe --tags --abbrev=0)..HEAD
```

Present the commits to the user and ask them to draft release notes.

Use this template:

```markdown
## Release Notes — v{version}

### New Features
- **{Feature}:** Brief description.

### Bug Fixes
- Fixed **{issue}** — users no longer experience **{problem}**.

### Breaking Changes
- **{Change}:** Users must **{action}** before upgrading.

### Internal
- {Dependency updates, refactors}
```

## §4 — Publish release notes

### GitHub Release (if applicable)

If your repo uses GitHub Releases:

```bash
gh release create "v{version}" \
  --title "Release v{version}" \
  --notes "$(cat <<'EOF'
{Changelog generated above}
EOF
)"
```

### Internal notification

Post a summary to the team's communication channel (Slack, Discord, etc.):

```markdown
*Release v{version} deployed to production*

What's new:
- {feature 1}
- {feature 2}

Bug fixes:
- {fix 1}

Breaking changes:
- {breaking change} — [migration guide link]

Full changelog: {link}
```

### External (if applicable)

For major releases, update:
- Changelog on the website
- Product release notes page
- Social media / newsletter

Ask the user what external communication is needed.

## §5 — Clean up

### Delete merged branches

Delete the staging branch and any feature branches that are now merged:

```bash
# Delete staging
git push origin --delete staging 2>/dev/null || echo "staging already deleted"

# List merged branches (exclude main and staging)
git branch -r --merged origin/main | grep -v "main\|staging" | while read branch; do
  git push origin --delete "${branch#origin/}" 2>/dev/null || true
done
```

### Tag the release (optional)

If your repo uses git tags for releases:

```bash
git tag "v{version}"
git push origin "v{version}"
```

## Output

Confirm with a summary:

> "Release v{version} complete. Merged staging → main. Changelog generated. Branches cleaned. Ready for production deploy."

## Error handling

| Situation | Action |
|---|---|
| CI not green on staging | Refuse — fix CI first |
| No changeset in main | Refuse — create one first |
| Open PRs targeting staging | Refuse — merge or close them first |
| Merge conflict | Resolve conflicts manually, then retry |
| Push fails (protected branch) | Report to user — may need branch protection adjustment |

## Constraints

- **Always return to `main` first.**
- **Run after `/review-pr`** — CI must be green on staging.
- **Never force-push to `main`.**
- **Verify CI is green before merging.**
- **Do not release if staging has open PRs.**
- Adapt `<org>/<repo>`, `<pkg-manager>`, and notification channels to your project conventions.
