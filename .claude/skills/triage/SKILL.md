---
name: triage
description: Triage a GitHub issue — verify, deduplicate, assess, categorize, prioritize, escalate if needed, post a structured review comment.
---

# `triage` Skill

Triage a GitHub issue: verify, deduplicate, assess completeness, categorize, prioritize, escalate if needed, and post a structured review comment.

## Definition of "Triaged"

An issue is **triaged** when all of the following are true:

1. **Understood** — the problem or request is clear, not ambiguous
2. **Verified** — the issue matches the current state of the codebase
3. **Categorized** — type, area, and cross-cutting labels are applied
4. **Prioritized** — Priority and Effort are assessed and set
5. **Actionable** — the next step is clear (ready, blocked, needs-info, closed)

If any of these is missing, the issue is only partially triaged.

## Source of truth

**Org-level fields** (Priority, Effort, Type) are the single source of truth for these values. **Labels do NOT represent Priority or Effort** in this workflow — use org-fields only.

## When to use

Use this skill when the user asks to triage or review an issue. Usually runs on newly opened issues.

**Trigger phrases:** "triage #N", "review this issue", "/triage #N".

## Prerequisites

The `gh` CLI must be authenticated:
```bash
gh auth status
```

## Step-by-step workflow

### Step 1 — Fetch issue details

```bash
gh issue view <issueNumber> --json title,body,labels,state,author
gh api "https://api.github.com/repos/<org>/<repo>/issues/<issueNumber>"
```

Read: `title`, `body`, `labels[]`, `state`, `author.login`.

Also fetch the org's issue fields to know what's available:

```bash
gh api "https://api.github.com/orgs/<org>/issue-fields"
```

Parse to build a map of `{ fieldName → { id, options: { optionName → id } } }`.

### Step 2 — Identify what's already present

From the `labels` array, note:
- Does it have an `area:*` label?
- Does it have a `status:*` label?
- Does it have a `regression` label?

From the issue API response, note the existing org-field values (Priority, Effort, Type).

### Step 3 — Search for duplicates

```bash
# Search for open issues with similar titles
gh search issues --repo <org>/<repo> "<title keywords>" --state open --limit 10
```

If similar issues are found:

- Present them to the user
- Ask if the new issue is a duplicate of an existing one
- If yes → apply `duplicate` label and link to the existing issue (see closure template)
- If no → continue

### Step 4 — Verify against codebase

Read the codebase to confirm the issue is real, not based on incorrect assumptions.

**Bug report** (`bug` label present):
- Locate the relevant code mentioned in the issue
- **Attempt to reproduce** the bug. If reproduction steps are provided, follow them exactly.
- If the bug cannot be reproduced → note this in the triage comment. It may be environment-specific or already fixed.
- If the bug exists → continue

**Feature request** (`enhancement` label present):
- Check if the requested feature or equivalent already exists in the codebase
- If the feature exists → note it in triage comment
- If partial → note what's missing

**Refactor request**:
- Locate the code referenced in the issue
- Confirm the problematic pattern exists
- If the code looks fine → flag it

**Task / chore**:
- Identify the files or areas mentioned
- Confirm the task is applicable and not already done

If the issue describes something that doesn't match reality → mark as `needs-info` with explanation. Do not apply `status:ready` on an unverified issue.

### Step 5 — Check for regression

For bug reports, check if the issue might be a regression (a bug introduced by a recent change):

```bash
# Check git history for recent changes to the affected area
git log --oneline -10 -- <file>
git log --oneline -10 --since="2 weeks ago"
```

**If recent changes are found in the affected area:**
- This may be a regression
- Apply the `regression` label if present
- Set Priority higher than you normally would (a regression is more urgent than a pre-existing bug)
- Note in the triage comment that this appears to be a regression

**Regression detection is important** because regressions signal that recent work broke something. They warrant higher urgency and direct notification to the contributor responsible.

### Step 6 — Assess completeness

Based on the template type, check for required fields:

**Bug report** (`bug` label present):
- ✅ **Required:** `📝 Bug Description` filled?
- ✅ **Required:** `📋 Steps to Reproduce` filled?
- ✅ **Required:** `🎯 Area` selected?
- ℹ️ `❌ Actual Behavior` and `✅ Expected Behavior` — strongly recommended but not hard-required

**Feature request** (`enhancement` label present):
- ✅ **Required:** `📝 Feature Summary` filled?
- ✅ **Required:** `📖 Detailed Description` filled?
- ✅ **Required:** `🎯 Area` selected?

**Any other issue** (no template used):
- ✅ Is the body substantive (not just a title)?
- ✅ Is the intent clear enough to act on?

### Step 7 — Triage decision

Apply the decision tree:

```
1. Is it a duplicate of an existing issue?
   YES → label: duplicate + link to existing issue

2. Is it complete?
   NO  → label: needs-info
   YES → continue

3. Is it a valid task? (not question/invalid/wontfix)
   wontfix    → label: wontfix
   question   → label: question
   invalid    → label: invalid
   YES        → continue

4. Is it blocked by another issue? (mentioned in body or comments)
   YES → label: status:blocked + link blocking issue

5. Does the issue match reality? (codebase verified)
   NO  → label: needs-info with explanation
   YES → continue

6. Otherwise → status:ready
```

### Step 8 — Set org-fields and labels

#### Org-fields (Priority, Effort, Type)

If any org-field is missing or incorrect, set or correct it via PATCH:

```bash
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
  gh api -X PATCH "https://api.github.com/repos/<org>/<repo>/issues/<issueNumber>" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  --input - <<EOF
{
  "type": "Task",
  "issue_field_values": [
    {"field_id": <field_id>, "value": "<value>"}
  ]
}
EOF
```

- Use the **option name as a string** (e.g., `"Medium"`, `"High"`, `"Low"`) — NOT the numeric option ID.
- Both `type` and `issue_field_values` can be set in the same PATCH call.
- **Regression bugs** → set Priority one level higher than the assessed severity (e.g., assessed Medium → set High).

#### Labels

```bash
gh issue edit <issueNumber> --add-label "label1,label2"
```

Labels to add if missing (do NOT remove existing labels):

**area:** (required — always add if absent)
- `area:auth`, `area:ui`, `area:web`, `area:app`, `area:docs`, `area:database`, `area:email`, `area:ci`, `area:build`, `area:deploy`
- Infer from body content if the dropdown was not used

**status:** (override template default only when justified)
- `status:ready` — complete + valid + unblocked + verified
- `status:needs-triage` — keep as-is, already set by template
- `needs-info` — incomplete or unverifiable, ask for more
- `status:in-progress` — someone is already working it
- `status:blocked` — depends on another issue

**cross-cutting** (add when applicable)
- `regression` — bug introduced by recent change
- `breaking-change` — affects public API surface
- `github_actions` — related to CI/CD
- `dependencies` — dependency update request

### Step 9 — Escalate if needed

Some issues warrant immediate stakeholder notification. After labeling and setting org-fields, escalate directly:

| Trigger | Action |
|---|---|
| **Security vulnerability** | Do not file a public issue. Follow the security disclosure process. |
| **Data loss or corruption** | Notify the engineering lead and data team immediately. |
| **Critical feature broken for all users** | Notify the product manager and engineering lead directly. |
| **Regression in active development** | Notify the contributor responsible for the recent change (via @mention or DM). |

Escalation is not a substitute for proper triage. **Always triage first, then escalate.**

If escalation is triggered, note it in the triage comment and include who was notified.

### Step 10 — Post triage comment

Read the relevant template from `comments-templates/<status>.md` and fill in the placeholders:

```bash
# Read the template
cat comments-templates/<status>.md

# Post the comment
gh issue comment create <issueNumber> --body "$(cat comments-templates/<status>.md)"
```

Available templates:

| Decision | Template |
|---|---|
| `status:ready` | `comments-templates/status-ready.md` |
| `needs-info` | `comments-templates/needs-info.md` |
| `status:blocked` | `comments-templates/status-blocked.md` |
| `duplicate` | `comments-templates/duplicate.md` |
| `wontfix` | `comments-templates/wontfix.md` |
| `question` | `comments-templates/question.md` |
| `invalid` | `comments-templates/invalid.md` |

## Label Handling Rules

- **Always check existing labels** before adding — don't double-apply
- **Add missing labels only** — never remove user-added labels
- **Preserve user intent** — keep labels even if they seem slightly off
- **Keep `status:needs-triage`** — it's the template default; only change if justified
- **Infer `area:*` from body** when the template dropdown wasn't used
- **Verify before marking `status:ready`** — an issue that describes non-existent code should not be marked ready
- **Regression bumps priority** — set Priority one level higher than assessed

## Error Handling

| Situation | Action |
|---|---|
| Org-field GET returns 404 | Report to user — org may not have Issue Fields enabled |
| Org-field value rejected | Verify option name matches the org-field definition; re-fetch if needed |
| Missing `area:*` label | Always add if absent; infer from issue body |
| Codebase check inconclusive | Default to `needs-info` |
| Bug cannot be reproduced | Note in comment; do not assume it's fixed — flag as environment-specific or needs-info |

## Constraints

- Prefix **every** `gh api` call with `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'` (Windows Git Bash path-rewrite bug).
- Use `--input -` for `issue_field_values` array — not `-f` or `-F`.
- **Priority** values: `Urgent`, `High`, `Medium`, `Low`. **Effort** values: `High`, `Medium`, `Low`. **Type** values: `Task`, `Bug`, `Feature`.
- Priority, Effort, Type are set via **org-fields** (API), NOT via labels.
- Never remove existing labels added by the user.
- Do not mark an issue `status:ready` unless the codebase has been verified.
- **Always triage before escalating.** Escalation is not triage.
