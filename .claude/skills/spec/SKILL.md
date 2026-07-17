---
name: spec
description: Explore a status:ready GitHub issue, write an implementation spec for human review, and push it to the branch. Never writes implementation code.
---

# `spec` Skill

Read a `status:ready` GitHub issue, explore the codebase, write a spec, and ask for human approval before implementation begins.

## When to use

**Trigger phrases:** "spec #N", "/spec #N", "write the spec for #N", "plan #N", "/plan #N".

## Workflow overview

```
0. Reset      — return to staging and pull latest
1. Fetch      — read the issue, check status:ready
2. Research   — web search, read codebase, check learnings, challenge the issue
3. Branch     — create impl/{n}-{slug} from staging
4. Explore    — read related files and patterns
5. Resolve    — address blocking questions before writing
6. Write      — build docs/plans/{n}.md from PLAN_TEMPLATE.md
7. Review     — present to human for approval
8. Push       — push branch so the plan persists on origin
```

## §0 — Reset (always)

```bash
git checkout staging && git pull origin staging
```

## §1 — Fetch

```bash
gh api "https://api.github.com/repos/<org>/<repo>/issues/{n}"
```

Extract: title, body, labels, comments.

**Gate: refuse if not `status:ready`**:

> "Issue #{n} does not have the `status:ready` label. Run `/triage #{n}` first, or use `--force` to proceed anyway."

Pass `--force` to skip this gate if you want to spec a draft issue.

## §2 — Research

Before writing a single step, understand the problem deeply.

**Read the issue thoroughly:**
- What is the actual problem being solved?
- Who benefits and how?
- What are the acceptance criteria?
- Are the acceptance criteria complete?

**Check for existing context:**
- Read existing code in the affected area
- Check `docs/internal/learnings/` for related past decisions
- Check for ADRs (Architecture Decision Records)
- Look at similar implementations in the codebase

**Web research when needed:**
- Search for how similar problems are solved in other projects
- Check documentation of libraries or frameworks involved
- Look for known pitfalls or breaking changes
- Find best practices for the technology in question

**Challenge the issue:**
- Is the proposed solution the right approach?
- Are there simpler alternatives?
- What are the trade-offs?
- Is this scope creep or a genuine requirement?

> If the issue is unclear or the solution is wrong, go back to triage. A spec on a flawed plan is wasted effort.

## §3 — Branch

Generate slug from title (kebab-case, max 50 chars):

```bash
SLUG=$(echo "impl/{n}-$(echo '{issue_title}' | sed 's/[^a-z0-9]+/-/gi' | tr '[:upper:]' '[:lower:]' | sed 's/^-//;s/-$//' | cut -c1-50)")
echo "$SLUG"
```

Delete if exists, then create from staging:

```bash
git branch -D "$SLUG" 2>/dev/null
git push origin --delete "$SLUG" 2>/dev/null
git checkout -b "$SLUG"
```

## §4 — Explore

Read:
- Files mentioned in the issue's acceptance criteria or description
- Relevant config (turbo.json, tsconfig.json, eslint.config.mjs, etc.)
- Existing patterns in the target packages (`apps/`, `packages/`)
- Learning docs in `docs/internal/learnings/` if referenced

Keep notes — they feed the spec.

**Do not write any implementation code during exploration.**

## §5 — Resolve blockers

After exploration, assess whether there are open questions that block writing the spec.

### Non-blocking questions

If the question can be resolved during implementation (e.g., "what should the error message say?"):
- Document it in the spec's "Open Questions" section
- Proceed to §6

### Blocking questions

If the spec cannot be written without an answer (e.g., "should this be per-IP or per-user rate limiting?"):

1. Post a comment on the issue asking the question:

```bash
gh issue comment create {n} --body "## Spec question

Before I can write the implementation plan, I need clarification on:

**Question:** {the question}

{a brief explanation of why it matters for the spec}

Please comment so I can proceed with the spec."
```

2. Apply `needs-info` label:

```bash
gh issue edit {n} --add-label "needs-info"
```

3. Stop — do not write the spec until the question is answered.

When the question is answered, resume from §5.

## §6 — Write the spec

Create the plan directory and copy the template:

```bash
mkdir -p "docs/plans"
cp .claude/skills/spec/PLAN_TEMPLATE.md "docs/plans/{n}.md"
```

Fill in every section. Key points:

- **Scope**: list what is IN and what is explicitly OUT
- **TL;DR**: one sentence — the end state after this PR merges
- **Files to touch**: exact paths, not directories
- **Step-by-step**: explain *what* to do and *why* this order
- **Open questions**: list non-blocking questions that will be resolved during implementation
- **Risks**: flag breaking-changes, side-effects, migration needs
- **YAML metadata**: set `status: draft`

If the issue is significantly more complex than described, flag it in TL;DR or Risks — do not surprise the reviewer mid-implementation.

## §7 — Review (blocking)

Present the spec to the user. **Do not proceed without approval.**

Use `AskUserQuestion` with a single approve/reject option. Include:

- TL;DR
- Scope (IN / OUT)
- Files count + step count
- Key risk (especially if `breaking-change` label present)
- Open questions (if any)
- Branch + docs/plans/{n}.md path

**If approved:**
1. Update YAML: `status: approved`, `reviewer: <author>`, `reviewed: {date}`
2. Push branch

**If rejected:**
> "Spec rejected. Branch `{slug}` still exists with the spec at `docs/plans/{n}.md`. Say the word and I'll delete it, or keep it open for later."

## §8 — Push

```bash
git add docs/plans/{n}.md
git commit -m "docs: write spec for issue #{n}

Co-Authored-By: Claude <noreply@anthropic.com>"

git push -u origin "{slug}"
```

## Idempotency

- **Spec already approved** → "A spec already exists and is approved. Run `/implement #{n}` to start."
- **Spec is draft** → "A draft spec exists. Review it at `docs/plans/{n}.md` on `{slug}`, or run `/spec #{n}` again to overwrite it."

## Error handling

| Situation | Action |
|---|---|
| Already on a branch | §0 resets to staging automatically |
| Issue not `status:ready` (no --force) | Refuse — see §1 |
| Branch already exists | Delete and recreate (see §3) |
| Blocking question found | §5: post comment, stop |
| No files to explore | Write spec from issue + research |

## Constraints

- **Always return to `staging` first.**
- **Refuse if not `status:ready` (unless --force).**
- **Research before planning — do not skip §2.**
- **Exploration only — no implementation code.**
- **Resolve blocking questions before writing the spec.**
- **Push the branch.** The spec must persist on origin so `/implement` can find it.
- Never write to `main` or merge directly to `main`.
- Adapt `staging` branch, `docs/plans/` path, and assignee `<author>` to your project conventions.

---

## PLAN_TEMPLATE.md

> Copy this to `docs/plans/{n}.md` when writing a spec.

```markdown
---
issue: {n}
title: "{issue title}"
author: <author>
generated: {YYYY-MM-DD}
status: draft
reviewer:
reviewed:
branch: impl/{n}-slug
labels: []
priority:
effort:
---

## TL;DR

{One sentence. What is the end state after this PR merges?}

---

## Context

{2–3 sentences. Why does this need to be done? What problem does it solve?}

---

## Scope

**IN:**
- {what this spec covers}

**OUT:**
- {what this spec explicitly does NOT cover}

---

## Files to touch

| File | Action | Why |
|------|--------|-----|
| `path/to/file` | create / edit / delete | reason |

---

## Step-by-step implementation

### Step 1 — {name}

`path/to/file`

- What to do
- Why this approach and not another

#### 1.1 — {sub-step name}

`path/to/file`

- Sub-step detail

### Step 2 — {name}

`path/to/file`

- ...

---

## Acceptance criteria

- [ ] {criterion 1}
- [ ] {criterion 2}

---

## Open questions

These will be resolved during implementation:

- {question 1}
- {question 2}

---

## Risks / edge cases

- {risk 1 — description and mitigation}
- {risk 2 — description and mitigation}

---

## PR metadata

| Field | Value |
|-------|-------|
| **Branch** | `impl/{n}-slug` |
| **PR title** | `{issue title}` |
| **Labels** | `{labels from issue}` |
| **Assignee** | `<author>` |
```
