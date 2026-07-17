---
name: implement
description: Implement a spec-reviewed issue, or apply requested changes from a PR review. Use --review flag for review-driven mode.
---

# `implement` Skill

Two modes:

- **Spec-driven** (default): implement a spec-reviewed issue
- **Review-driven** (`--review`): apply requested changes from a PR review

## Definition of Done

An implementation is **done** when all of the following are true:

1. All acceptance criteria from the spec are met
2. Build, typecheck, tests, and lint pass
3. Relevant documentation is updated (if specified in the spec)
4. No regressions are introduced
5. The implementation stays within the spec's scope boundaries

## When to use

**Spec-driven trigger phrases:** "implement #N", "work on #N", "start #N", "/implement #N".
**Review-driven trigger phrases:** "implement #N --review", "apply review #N", "/implement #N --review".

**Prerequisite (spec-driven):** `/spec #{n}` must have been run first.
**Prerequisite (review-driven):** PR must be open with a review requesting changes.

## Workflow overview

### Spec-driven (default)

```
0. Reset       — return to staging and pull latest
1. Fetch       — read the issue + look for the spec
2. Check       — gate A: status:ready · gate B: spec exists · gate C: branch exists
3. Review      — ask for approval if not already given
4. Checkout    — fetch and checkout the branch
5. Implement   — write the code following the spec + resolve open questions
6. Validate    — technical: build → typecheck → test → lint
7. Finalize   — acceptance criteria, scope check, docs check
8. Done        — git push + tell user to run /create-pr #{n}
```

### Review-driven (`--review`)

```
0. Reset      — return to staging and pull latest
1. Fetch      — PR details + review comments
2. Check      — gate A: PR open · gate B: has review with requested_changes
3. Parse      — extract all requested changes from review comments
4. Apply      — fix each blocking issue from the review
5. Validate   — build → typecheck → test → lint
6. Push       — git push
7. Reviewer   — re-request review from original reviewer
```

---

# SPEC-DRIVEN MODE (default)

## §0 — Reset (always)

```bash
git checkout staging && git pull origin staging
```

## §1 — Fetch

```bash
gh api "https://api.github.com/repos/<org>/<repo>/issues/{n}"
gh api --paginate "https://api.github.com/repos/<org>/<repo>/issues/{n}/comments"
```

## §2 — Check

Three sequential gates. Refuse immediately at the first failure.

**Gate A — status:ready**

Refuse if `status:ready` label is absent:

> "Issue #{n} does not have the `status:ready` label. Run `/triage #{n}` first."

**Gate B — spec exists**

Look for the spec file on the branch. Adapt the path to your project conventions:

```bash
gh api "https://api.github.com/repos/<org>/<repo>/contents/<spec-path>?ref=<impl-branch>" \
  --jq '.content' 2>/dev/null | base64 -d -
```

Refuse if not found:

> "No spec found for issue #{n}. Run `/spec #{n}` first to write the implementation plan."

**Gate C — branch exists**

```bash
git fetch origin "<impl-branch>" 2>/dev/null && echo "found" || echo "missing"
```

Refuse if not on origin:

> "Branch `<impl-branch>` does not exist on origin. Run `/spec #{n}` first to create it."

## §3 — Review

Read the spec. Check the YAML `status` field.

- **`status: approved`** → proceed to §4 without asking
- **`status: draft`** → **blocking**: present a summary and ask for approval

When asking for approval, include:
- TL;DR from the spec
- Scope (IN / OUT)
- Files count + step count
- Key risk (warn if `breaking-change` label present)
- Open questions (if any)
- Branch + spec path

**If approved:**
1. Update the spec YAML on the branch:
   - `status: approved`
   - `reviewer: <author>`
   - `reviewed: {YYYY-MM-DD}`
2. Commit the update and push
3. Proceed to §4

**If rejected:**
> "Implementation blocked. The spec remains on `<impl-branch>`."

## §4 — Checkout the branch

```bash
git fetch origin "<impl-branch>"
git checkout "<impl-branch>"
git merge origin/<impl-branch>  # pull latest spec if updated
```

## §5 — Implement

Read the spec and follow it exactly.

### Open questions

Check the spec's "Open questions" section. For each question:
- **Resolved during implementation** — make a decision and note it in the commit message or as a code comment
- **Cannot be resolved** — post a comment on the issue asking for clarification, then stop

If you discover a scope question (something that seems out of scope but might be needed):
- If clearly out of scope → create a follow-up issue, note it in the commit
- If unclear → stop and ask

### Implementation rules

- Use `Edit` and `Write` to modify/create files
- Execute steps in the order listed in the Outline
- Keep the diff clean: no unrelated reformats mixed with logic changes
- If the issue has `breaking-change` label → review Risks section carefully before starting
- Do not deviate from the spec unless you hit a concrete contradiction — then stop and ask

## §6 — Validate (technical)

After every file change and again at the end, run in sequence:

```bash
<build-cmd>
<typecheck-cmd>
<test-cmd>
<lint-cmd>
```

Adapt these commands to your project (e.g., `pnpm build`, `npm run build`, `make build`, etc.).

If any step fails:
1. Fix the failure
2. Re-run the full sequence
3. If the fix requires diverging from the spec → stop and ask before continuing

## §7 — Finalize

### Acceptance criteria

Check the spec's "Acceptance criteria" section. For each criterion:
- Verify it is met
- If not met → implement until it is
- If impossible to meet → stop and explain why

### Scope check

Review the diff against the spec's scope:

```bash
git diff --stat
```

Compare against the spec's "Files to touch" and "Scope IN/OUT" sections.

- **Unexpected files added?** → either add them to the scope (if needed) or remove them
- **Expected files not touched?** → implement them or flag why not
- **Files outside scope?** → remove or create a follow-up issue

### Documentation check

If the spec mentions documentation to update:
- Check that the documentation is updated
- If not → update it or flag it

## §8 — Push + Done

```bash
git add {files from plan + modified files}
git commit -m "{type}: {concise description}

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin "<impl-branch>"
```

Tell the user:

> "Implementation complete and pushed to `<impl-branch>`. Now run `/create-pr #{n}` to open the PR."

**Commit type:** match the primary area label — `ci`, `chore`, `docs`, `feat`, `fix`, `refactor`.

---

# REVIEW-DRIVEN MODE (`--review`)

## §0 — Reset (always)

```bash
git checkout staging && git pull origin staging
```

## §1 — Fetch

```bash
# PR details
gh api "https://api.github.com/repos/<org>/<repo>/pulls/{n}"

# All reviews with their comments
gh api --paginate "https://api.github.com/repos/<org>/<repo>/pulls/{n}/reviews"

# Review comments (includes file-level + line-level)
gh api --paginate "https://api.github.com/repos/<org>/<repo>/pulls/{n}/comments"

# The branch name
BRANCH=$(gh api "https://api.github.com/repos/<org>/<repo>/pulls/{n}" --jq '.head.ref')
```

## §2 — Check

**Gate A — PR must be open**

```bash
STATE=$(gh api "https://api.github.com/repos/<org>/<repo>/pulls/{n}" --jq '.state')
```

Refuse if `state != open`:

> "PR #{n} is not open ({state}). Nothing to apply."

**Gate B — must have a review with `requested_changes`**

```bash
REVIEW_STATE=$(gh api --paginate "https://api.github.com/repos/<org>/<repo>/pulls/{n}/reviews" \
  --jq '.[] | select(.state == "CHANGES_REQUESTED") | .user.login' | head -1)
```

Refuse if no review with `CHANGES_REQUESTED`:

> "PR #{n} has no review requesting changes. Run `/review-pr #{n}` first."

Capture the review author for later — this is who we re-request review from.

## §3 — Parse review comments

From the reviews + comments, extract:

- **Blocking issues** — from comments on the `requested_changes` review
- **File + line** — which file and line the comment references
- **What to change** — the body of the comment

Group comments by:
1. File changed
2. Line/section
3. Requested fix

Present the list to the user before applying:

> "Found {count} requested changes from @{reviewer}:"
>
> 1. `{file}:{line}` — {comment summary}
> 2. ...

Ask for confirmation before proceeding:

> "Apply all changes and push? (y/n)"

## §4 — Apply fixes

For each blocking comment, make the necessary edit:

- Use `Edit` or `Write` to fix the issue
- Group fixes by file when possible to keep the diff clean
- Do not make unrelated changes — stick to what the reviewer requested
- If a comment is unclear → post a reply question before proceeding

## §5 — Validate

After every file change and again at the end:

```bash
<build-cmd>
<typecheck-cmd>
<test-cmd>
<lint-cmd>
```

Adapt these commands to your project.

If any step fails → fix, re-validate, continue.

## §6 — Push

```bash
git add {modified files}
git commit -m "fix: address review comments from @{reviewer}

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin "$BRANCH"
```

## §7 — Re-request review

```bash
gh api -X POST "https://api.github.com/repos/<org>/<repo>/pulls/{n}/reviews/{review_id}/events" \
  -H "Accept: application/vnd.github+json" \
  -f event="REQUEST_REVIEW"
```

Or via CLI (if supported):

```bash
gh pr review {n} --request-reviewer "@{reviewer}"
```

## Output

Tell the user:

> "Changes pushed and review re-requested from @{reviewer}. Run `/review-pr #{n}` again once CI passes."

---

# Shared error handling

| Situation | Action |
|---|---|
| Already on a branch | §0 resets to staging automatically |
| Spec mode: not `status:ready` | Refuse — Gate A |
| Spec mode: no spec found | Refuse — Gate B |
| Spec mode: branch not on origin | Refuse — Gate C |
| Review mode: PR not open | Refuse — Gate A |
| Review mode: no requested_changes review | Refuse — Gate B |
| `breaking-change` label present | Warn and review Risks before proceeding |
| Tests fail | Fix → re-validate → ask if outside scope |
| Spec not approved | Ask for approval in §3 |
| Open question cannot be resolved | Post comment on issue, stop |
| Acceptance criteria not met | Implement until met or explain why not |
| Unexpected files in diff | Remove or justify adding to scope |

## Constraints

- **Always return to `staging` first.**
- **Never opens a PR** — run `/create-pr #{n}` after spec-driven mode.
- **Never merges** — merge to `staging` is manual, `staging → main` is also manual.
- Never push to `main`.
- Do not use `--force` to overwrite branches without permission.
- Adapt `<org>/<repo>`, `<impl-branch>`, `<spec-path>`, `<author>`, and validation commands to your project conventions.
