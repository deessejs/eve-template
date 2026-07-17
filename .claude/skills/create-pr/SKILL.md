---
name: create-pr
description: Open a PR for an implemented issue — reads the spec, validates the implementation is done, opens PR, updates labels, posts comment.
---

# `create-pr` Skill

Open a PR, validate the implementation is done, update issue labels, assign, and post a comment.

## When to use

**Trigger phrases:** "create-pr #N", "open pr #N", "/create-pr #N".

Run this **after** `/implement #{n}` — the branch must be pushed with the implementation.

## Prerequisites

The implementation must be **done** according to the Definition of Done:

1. All acceptance criteria from the spec are met
2. Build, typecheck, tests, and lint pass
3. Relevant documentation is updated
4. No regressions are introduced
5. The implementation stays within the spec's scope boundaries

## Workflow overview

```
0. Reset       — return to staging and pull latest
1. Fetch       — read the issue + the spec
2. Validate    — check implementation is done (Definition of Done)
3. PR          — open the pull request to staging
4. Update      — label, assign, post comment
5. Changeset   — verify .changeset/*.md exists, add if missing
```

## §0 — Reset (always)

```bash
git checkout staging && git pull origin staging
```

## §1 — Fetch

Fetch all in parallel:

```bash
gh api "https://api.github.com/repos/<org>/<repo>/issues/{n}"
gh api --paginate "https://api.github.com/repos/<org>/<repo>/issues/{n}/comments"
gh api -H "X-GitHub-Api-Version: 2026-03-10" \
  "https://api.github.com/orgs/<org>/issue-fields"
gh api "https://api.github.com/repos/<org>/<repo>/contents/<spec-path>?ref=<impl-branch>" \
  --jq '.content' 2>/dev/null | base64 -d -
```

Also fetch the latest commit to confirm branch is up to date:

```bash
git fetch origin "<impl-branch>"
```

## §2 — Validate (Definition of Done)

Before opening a PR, verify the implementation is complete.

### Check 1 — Spec status

Read the spec YAML `status` field:
- **`status: approved`** → proceed
- **`status: draft`** → refuse:
  > "The spec is not approved. Run `/implement #{n}` to review and approve it first."

### Check 2 — Open questions

If the spec has an "Open questions" section:
- Check if all questions have been resolved
- If any remain unresolved → refuse:
  > "Open questions remain unresolved in the spec. Resolve them before opening a PR."

### Check 3 — Acceptance criteria

If the spec has an "Acceptance criteria" section:
- Present the criteria to the user
- Ask them to confirm each is met:
  > "Please confirm the following acceptance criteria are met before I open the PR:
  >
  > - [ ] {criterion 1}
  > - [ ] {criterion 2}"

If any criterion is not met → refuse.

### Check 4 — Scope

If the spec has a "Scope OUT" section:
- Review the diff to confirm nothing outside scope was added:
  ```bash
  git fetch origin "<impl-branch>"
  git diff origin/staging...origin/<impl-branch> --stat
  ```
- If unexpected files are present → ask whether to proceed or clean up:
  > "Files outside the spec scope were found in the diff. Should I remove them before opening the PR?"

## §3 — Gather PR context

Before opening the PR, gather context for the PR body:

### PR size signal

Check the diff stats:

```bash
git diff origin/staging...origin/<impl-branch> --stat
```

Note the total lines changed. If the PR is large, flag it:

| Lines changed | Signal |
|---|---|
| < 200 | Small — ideal |
| 200 - 400 | Medium — acceptable |
| > 400 | Large — consider splitting next time |

If > 400 lines, add a note to the PR body:
> **Note:** This PR is larger than ideal (>400 lines). Consider splitting large changes next time.

### Breaking changes check

If `breaking-change` label is present, note that breaking changes need explicit documentation in the PR body.

### UI changes check

If the PR touches UI files (components, styles, pages), ask the user:
> "Does this PR have UI changes that would benefit from screenshots? If yes, please provide them or describe what changed."

## §4 — Open PR

```bash
gh pr create \
  --base staging \
  --title "{issue title}" \
  --body "$(cat <<'EOF'
## Summary

{TL;DR from the spec}

## Context

{Context from the spec (2-3 sentences)}

## Scope

**IN:**
{Scope IN from the spec}

**OUT:**
{Scope OUT from the spec (if present)}

{If PR is large (>400 lines):}
> **Note:** This PR is larger than ideal (>400 lines). Consider splitting large changes next time.

## What changed

{Files to touch table from the spec}

## How tested

{Describe how the change was validated beyond CI:}

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated (if applicable)
- [ ] Manual testing: {describe what was tested manually}
- [ ] Tested on: {env or browser if applicable}

{If UI changes:}
## Screenshots / Demo

{Attach screenshots or describe UI changes}

## Acceptance criteria

{Acceptance criteria from the spec}

{If open questions were resolved during implementation:}
## Open questions resolved

- {question}: {decision made}

## Risks addressed

{Risks from the spec, with resolution noted}

{If breaking-change label present:}
## Breaking Changes

- {describe the breaking change}
- Migration required: {what users need to do}

{If regression label present:}
> **Note:** This PR addresses a regression. A `regression` label has been applied to the issue.

## Changeset

<!-- changeset-type: patch | minor | major -->

A `.changeset/*.md` file should be present in this PR to document the change type and trigger the release workflow on merge to main.

## Verification

- [ ] Build passes
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Lint passes

## Related

Part of #{n}

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --label "{labels}" \
  --assignee <author>
```

**Notes:**
- Extract Scope IN/OUT, Acceptance Criteria, and Open Questions from the spec if present
- If the spec does not have a section, omit that part from the PR body
- If `regression` label is on the issue, mention it explicitly
- If `breaking-change` label is present, add the Breaking Changes section

Capture the returned URL.

## §5 — Update Issue

After PR is open, do all three in parallel:

**1. Remove `status:ready`**, add `status:in-progress`:

```bash
gh issue edit {n} --remove-label "status:ready" --add-label "status:in-progress"
```

**2. Assign to `<author>`:**

```bash
gh issue edit {n} --add-assignee <author>
```

**3. Post a comment:**

```markdown
## Implementation started

PR opened: {PR URL}

The spec was reviewed and approved. This PR targets `staging`. After CI green + approval, merge `staging → main` manually.

_{If regression: Note: This addresses a regression. The `regression` label has been applied.}_
_{If breaking-change: Note: This includes breaking changes. Migration steps are documented in the PR.}_
```

## §6 — Verify changeset

Check if a `.changeset/*.md` file exists in the branch:

```bash
git fetch origin "<impl-branch>"
git ls-tree -r --name-only origin/<impl-branch> | grep "^.changeset/"
```

If **missing**, offer to create one. Adapt to your project's changeset tooling:

```bash
<pkg-manager> changeset add
```

Ask the user to describe the change and select `patch`, `minor`, or `major`. Commit and push:

```bash
git add .changeset/*.md
git commit -m "docs(changeset): document change

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin "<impl-branch>"
```

Determine changeset type based on scope:

| Scope | Type |
|---|---|
| Bug fix, no new features | `patch` |
| New feature, backward-compatible change | `minor` |
| Breaking change, significant redesign | `major` |

Tell the user:

> "Changeset `.changeset/*.md` added as `{type}`. This will trigger the release workflow when staging → main merges."

## Output

Confirm with a one-liner: PR number, title, changeset type, URL, and next step.

> "PR #{n}: {title} — {changeset type} — {PR URL}. Targets `staging`. After CI green + review approval, merge `staging → main` → release workflow triggers automatically."

## Error handling

| Situation | Action |
|---|---|
| Already on a branch | §0 resets to staging automatically |
| Branch not on origin | Refuse — Gate A |
| Spec not approved | Refuse — spec must be approved first |
| Open questions unresolved | Refuse — resolve them first |
| Acceptance criteria not met | Refuse — implement until met |
| Unexpected files in diff | Ask user: remove or proceed |
| PR already exists | Tell user; offer to update instead |
| No changeset file found | Create one before creating PR |
| PR creation fails | Check labels are valid, then retry |

## Constraints

- **Always return to `staging` first.**
- **Run after `/implement #{n}`** — the branch must exist and be pushed.
- **Validate the Definition of Done before opening the PR.**
- **PR always targets `staging`.**
- **A `.changeset/*.md` file must be present** — the release workflow depends on it.
- Never push to `main`.
- Never merge a PR from this skill.
- Adapt `<org>/<repo>`, `<impl-branch>`, `<spec-path>`, `<author>`, and changeset commands to your project conventions.
