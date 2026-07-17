---
name: ship
description: Select which merged PRs go from staging to main, create a release PR, trigger auto-release.
---

# `ship` Skill

Select which merged PRs go from staging to main, create a release branch, and open a PR to trigger auto-release.

## When to use

**Trigger phrases:** "ship", "/ship", "prepare release".

Run this **after** `/review-pr` approves — CI must be green on staging.

## Prerequisites

1. PRs are merged to `staging` and CI is green
2. A changeset file (`.changeset/*.md`) exists in `staging`

## Workflow overview

```
0. Reset       — return to main and pull latest
1. List        — show PRs merged to staging since last release
2. Select      — user selects which PRs go to main
3. Branch      — create release branch with selected PRs
4. PR          — open PR to main
5. Done        — user merges → push → auto-release
```

## §0 — Reset (always)

```bash
git checkout main && git pull origin main
```

## §1 — List merged PRs

Find PRs merged to staging since the last release tag:

```bash
LAST_TAG=$(git describe --tags --abbrev=0 origin/main 2>/dev/null || echo "none")

# Get the next version from changeset
NEXT_VERSION=$(cat .changeset/*.md | grep -oP '(?<=^## )\d+\.\d+\.\d+' || echo "patch")

# Create release branch from main
RELEASE_BRANCH="release/v${NEXT_VERSION}"
```

List the PRs that contributed those commits:

```bash
gh pr list --base staging --state=merged --limit=50 \
  --json number,title,author,labels,mergedAt
```

Present to the user in a clear format:

```
PRs merged to staging since {LAST_TAG}:

1. #123 — Add authentication — @author — labels: type:feature, area:auth
2. #124 — Fix login bug — @author — labels: type:bug, area:auth
3. #125 — Update dependencies — @author — labels: type:chore

Select which PRs should go to main for this release.
```

## §2 — Select

Ask the user to select which PRs go to main.

### Option A — All PRs

If the user wants all PRs in staging:
> "Include all {n} PRs in the release?"

### Option B — Specific PRs

If the user wants to select specific PRs:
> "Which PRs should go to main? (e.g., #123, #124, skip #125)"

### Option C — Exclude specific PRs

If the user wants most PRs but excludes a few:
> "Include all except which PRs? (e.g., all except #125)"

Document the selection for the release notes.

## §3 — Create release branch

Create a release branch with the selected PRs:

```bash
# Get the selected PR numbers
SELECTED_PR_NUMS="{1,2,3}"

# Create release branch from main
RELEASE_BRANCH="release/v${NEXT_VERSION}"
git checkout -b "$RELEASE_BRANCH" origin/main

# Cherry-pick commits from the selected PRs
for pr in $SELECTED_PR_NUMS; do
  # Get the merge commit SHA for each PR
  SHA=$(gh api "repos/<org>/<repo>/pulls/{pr}/merge" --jq '.merge_commit_sha')
  git cherry-pick "$SHA"
done

# Push release branch
git push -u origin "$RELEASE_BRANCH"
```

If cherry-pick has conflicts:
1. Resolve conflicts
2. `git add .`
3. `git cherry-pick --continue`
4. If a PR shouldn't be included due to conflicts, note it for the user

## §4 — Open PR to main

```bash
gh pr create \
  --base main \
  --head "$RELEASE_BRANCH" \
  --title "Release {date}" \
  --body "$(cat <<'EOF'
## Release Summary

This PR ships the following changes from staging:

{List of selected PRs with titles and authors}

### Included
{PR list}

### Changeset
A `.changeset/*.md` file is included to trigger version bump and auto-release.

### Next step
Review and merge this PR. Auto-release will trigger on push to main.

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --label "release"
```

## §5 — Done

Tell the user:

> "Release PR opened: {PR URL}. Merge it to main to trigger auto-release."

## Error handling

| Situation | Action |
|---|---|
| No PRs merged since last release | Tell user: "No PRs merged since last tag. Nothing to ship." |
| Cherry-pick conflict | Resolve conflicts, or skip the conflicting PR |
| Release branch already exists | Delete and recreate |
| No changeset in staging | Warn user: "No changeset found. Auto-release may not trigger." |

## Constraints

- **Run after `/review-pr`** — PRs must be merged to staging first.
- **Always create a release branch** — never merge staging directly to main.
- **Cherry-pick, don't merge** — staging may have PRs that shouldn't go to main.
- **Test the release branch locally** before opening the PR if possible.
- Adapt `<org>/<repo>` to your project conventions.
