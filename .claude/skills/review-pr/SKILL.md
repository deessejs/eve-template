---
name: review-pr
description: Review an open PR — check CI, validate against the spec, assess design/complexity/tests/docs, post a GitHub review.
---

# `review-pr` Skill

Review an open pull request: check CI, validate against the spec, assess design and quality, and post a GitHub review.

## What to Check in a Review

A thorough review covers all of the following:

| Domain | What to check |
|---|---|
| **CI** | All checks pass |
| **Spec match** | Diff matches the implementation spec |
| **Scope** | Nothing outside the spec's scope was added |
| **Acceptance criteria** | All criteria from the spec are met |
| **Design** | The change makes sense in the broader system |
| **Complexity** | Not over-engineered, no unnecessary abstraction |
| **Functionality** | Does what it claims to do, works for users |
| **Tests** | Correct, useful, cover edge cases |
| **Documentation** | Updated if the change affects how users interact with the system |
| **Security** | Authorization, authentication, input validation are correct |
| **Performance** | No obvious regressions |
| **Style** | Follows the project's style guide |

If a domain is not applicable, skip it. If a domain is critical and not met, block.

## When to use

**Trigger phrases:** "review #N", "/review #N", "review pr #N", "check pr #N".

Can run at any point:
- Right after `/create-pr` — pre-merge review
- Before merging — final check
- After requested changes — re-review

## Workflow overview

```
0. Reset  — return to staging and pull latest
1. Fetch  — PR details, CI status, diff, spec (if exists)
2. Check  — PR state, CI, blocking comments
3. Review — analyze diff, assess against spec, check all domains
4. Post   — post GitHub review (approve / request changes / comment)
5. Update — label if approved
```

## §0 — Reset (always)

```bash
git checkout staging && git pull origin staging
```

## §1 — Fetch

Fetch all in parallel:

```bash
# PR details
gh api "https://api.github.com/repos/<org>/<repo>/pulls/{n}"

# CI / checks status
gh api "https://api.github.com/repos/<org>/<repo>/commits/{sha}/statuses"
gh api "https://api.github.com/repos/<org>/<repo>/check-runs?per_page=100"

# Issue linked to this PR (parse from body)
gh api "https://api.github.com/repos/<org>/<repo>/issues/{n}"

# Diff
gh pr view {n} --json diff
```

## §2 — Check

**Gate A — PR must be open**

Refuse if `state != open`:

> "PR #{n} is not open ({state}). Nothing to review."

**Gate B — CI must be green**

Check all check-runs and statuses:
- All must be `success` or `neutral`
- Any `failure` or `action_required` → block with details

Report CI status to the user:

> "CI: {passed}/{total} checks passing. {details}"

**Gate C — no unresolved blocking comments**

```bash
gh api "https://api.github.com/repos/<org>/<repo>/pulls/{n}/comments?status=open"
```

If unresolved review comments exist → note them, include in review decision.

## §3 — Review

### 3.1 — Read the spec (if exists)

Look for `Closes #{issue}` in the PR body, then try to fetch the spec:

```bash
ISSUE_N=$(echo "$PR_BODY" | grep -oP 'Closes #\K\d+')
if [ -n "$ISSUE_N" ]; then
  SPEC_BRANCH=$(gh api "https://api.github.com/repos/<org>/<repo>/pulls/{n}" --jq '.head.ref')
  gh api "https://api.github.com/repos/<org>/<repo>/contents/<spec-path>?ref=${SPEC_BRANCH}" \
    --jq '.content' 2>/dev/null | base64 -d -
fi
```

### 3.2 — Assess against the spec

Validate:
- [ ] All files in `Files to touch` are in the diff
- [ ] No unexpected files added outside scope
- [ ] Acceptance criteria are met
- [ ] Risks from the spec were addressed

### 3.3 — Assess the code

**Design:**
- Do the interactions between components make sense?
- Does it belong in the codebase?
- Does it integrate well with the rest of the system?

**Complexity:**
- Is any part more complex than it needs to be?
- Is there over-engineering (abstraction for problems not yet present)?
- Are functions and classes reasonably sized?

**Functionality:**
- Does the code do what it claims?
- Are there edge cases that aren't handled?
- Is there concurrency that could cause race conditions?

**Tests:**
- Are tests correct and useful?
- Do they test the right things?
- Would the tests fail if the code broke?

**Documentation:**
- If the change affects how users interact with the system, is the documentation updated?

**Security:**
- Are authorization and authentication correct?
- Is user input validated?
- Are there obvious security issues?

**Style:**
- Does it follow the project's style guide?
- Use "nit:" prefix for style suggestions that aren't enforced by tooling.

### 3.4 — Decision

Three outcomes:

| Situation | Decision |
|---|---|
| CI green + all domains met | **Approve** |
| CI green + minor nits only | **Comment** (with nitpicks) |
| CI red OR blocking issue in any domain | **Request changes** |

Present the decision to the user before posting:

> **CI:** {passed}/{total} ✅
> **Spec match:** ✅/⚠️/❌
> **Design:** ✅/⚠️/❌
> **Complexity:** ✅/⚠️/❌
> **Tests:** ✅/⚠️/❌
> **Recommendation:** Approve / Request changes / Comment

Include details for any ⚠️ or ❌ items.

Ask for confirmation before posting (unless the user explicitly said "review and approve").

## §4 — Post the review

### Approve

```bash
gh pr review {n} --approve --body "## Review

**Spec:** `<spec-path>`
**CI:** {passed}/{total} ✅

**Checks:**
- Spec match: ✅
- Acceptance criteria: ✅
- Design: ✅
- Complexity: ✅
- Tests: ✅
- Documentation: ✅
- Security: ✅

{If regression addressed: **Regression:** addressed ✅}

Reviewed against the implementation spec and code quality standards. Changes look good.

---
🤖 Reviewed with [Claude Code](https://claude.com/claude-code)"
```

### Request changes

```bash
gh pr review {n} --request-changes --body "## Review

**CI:** {passed}/{total} {✅/❌}

**Checks:**
{list each failing domain with the specific issue}

**Blocking issues:**
- {issue 1 — domain and problem}
- {issue 2 — domain and problem}

---
🤖 Reviewed with [Claude Code](https://claude.com/claude-code)"
```

### Comment (nits only)

```bash
gh pr review {n} --comment --body "## Review

**CI:** {passed}/{total} ✅
**Spec match:** ✅

**Non-blocking observations:**

{nit: style suggestion 1}
{nit: style suggestion 2}

Optional: **Praise:** {something good about the code}

---
🤖 Reviewed with [Claude Code](https://claude.com/claude-code)"
```

## §5 — Update labels (if approved)

If the decision is **Approve**, offer to update the linked issue:

```bash
gh issue edit {issue_n} --remove-label "status:in-progress" --add-label "status:staging-approved"
```

Tell the user:

> "PR approved. After CI green, merge `staging → main` manually."

## Output

One-liner: PR number, decision, CI status, next step.

> "PR #{n}: **Approved** ✅ CI green. Merge `staging → main` when ready."

## Error Handling

| Situation | Action |
|---|---|
| PR not open | Refuse — Gate A |
| CI failing | Block — include failure details in review body |
| Spec not found | Review diff only; note "no spec found" |
| Review already posted | Tell user; offer to update instead |
| Code is hard to understand | Ask author for clarification before completing review |

## Review Principles

- **Approve if it improves the codebase, even if not perfect.** There is no such thing as perfect code.
- **Use "nit:" prefix** for non-blocking style suggestions. These are improvements the author can choose to ignore.
- **Facts over opinions.** If something violates the style guide, it's blocking. If it's just your preference, use "nit:".
- **Praise good code.** If you see something done well, say so.
- **Review every line you've been asked to review.** If you can't understand it, ask for clarification.
- **Mentoring is part of review.** If you can teach something, do so — but prefix non-critical educational comments with "nit:".
- **Never block on personal style preferences** unless the style guide requires it.

## Constraints

- **Always return to `staging` first.**
- **CI must be green before approving.**
- **Never merge** — merge to `staging` is manual, `staging → main` is also manual.
- Do not approve if the diff doesn't match the spec (unless explicitly overridden by the user).
- Adapt `<org>/<repo>`, `<spec-path>`, and label names to your project conventions.
