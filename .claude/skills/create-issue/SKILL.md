---
name: create-issue
description: Create GitHub issues with org-level type, Priority, Effort, and custom fields via the REST API. Use when asked to "create an issue", "file an issue", or "open an issue".
---

# `create-issue` Skill

Create GitHub issues with org-level `type`, `Priority`, and `Effort` fields via the REST API. Falls back to plain `gh issue create` if no structured fields are needed.

> **Note:** This skill creates issues. It does not triage them. After creation, use `/triage #N` to verify, deduplicate, categorize, and set the final Priority/Effort/Type values.

## When to use

Use this skill whenever the user asks to create an issue, file an issue, or open an issue. The skill decides whether a simple `gh issue create` suffices or whether `gh api` with structured fields is needed.

**Trigger phrases:** "create an issue", "file an issue", "open an issue", "add an issue", "create a ticket".

## Org-fields are the source of truth

Priority, Effort, and Type are set via **org-level fields** (API), not labels. The `/triage` skill will review and adjust these values after creation — the values set here are initial estimates, not final assessments.

## How it works

### Step 1 — Resolve field IDs (once per org, cached in memory)

The org's `issue_field` IDs are stable for `<org>` (see the verified table below) but should be re-fetched if a call ever fails with an unknown-field error:

```bash
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
  gh api -H "X-GitHub-Api-Version: 2026-03-10" \
  "https://api.github.com/orgs/<org>/issue-fields"
```

Parse the response to build a map of `{ fieldName → { id, options: { optionName → id } } }`.

**Known gotcha (Windows/Git Bash):** URLs are rewritten as filesystem paths and get mangled — the leading `https://` alone is **not** enough. You **must** prefix the command with `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'`. Without it, `gh api` fails with a Cygwin `add_item ... failed, errno 1` fatal error. Apply this prefix to **every** `gh api` call in this skill.

### Step 2 — Create the issue

Use `gh issue create` for title, body, labels, and milestone (it handles Markdown rendering, @mention parsing, and label validation).

Then enrich it with `type` + `issue_field_values` via `PATCH`.

### Step 3 — Apply type + fields

`gh api` via `--input -` with a JSON body:

```bash
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' \
  gh api -X PATCH "https://api.github.com/repos/<org>/<repo>/issues/{n}" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  --input - <<EOF
{
  "type": "Task",
  "issue_field_values": [
    {"field_id": <Priority_field_id>, "value": "Medium"},
    {"field_id": <Effort_field_id>, "value": "Medium"}
  ]
}
EOF
```

**Known gotchas:**

- `-f` and `-F` do NOT work for `issue_field_values` (they send a string, not an array). **Must use `--input -` with a heredoc.**
- `value` for **single-select** fields is the **option name as a string** (e.g. `"Medium"`, `"High"`, `"Low"`). The numeric option ID is **wrong** — the API rejects it with `"must be a string option name"`. Always use the text name, resolved from the GET above.
- `type` is a **string name** (e.g. `"Task"`, `"Bug"`, `"Feature"`), not an ID.
- Both `type` and `issue_field_values` can be set in the same PATCH call.

## Prompt the user for

Before creating, confirm:

1. **Title** — short, imperative, prefixed with conventional type (`feat:`, `fix:`, `chore:`, `ci:`, `refactor:`, `docs:`).
2. **Body** — structured with at minimum: Description, Why, Acceptance criteria (checkboxes), Related (links to PRs/docs), Risks (if any).
3. **Labels** — from the existing set only (`gh label list`). Do NOT create new labels unless asked.
4. **Type** — `Task`, `Bug`, or `Feature` (org-level, set via `type` in PATCH).
5. **Priority** — `Urgent`, `High`, `Medium`, or `Low` (option name, resolved from org fields via GET).
6. **Effort** — `High`, `Medium`, or `Low` (option name, resolved from org fields via GET).

If the user only provides a title, use reasonable defaults: `Task` / `Medium` / `Medium`.

> Note: `/triage` will review and adjust these values after creation if needed.

## Repo context — `<repo>`

Repo: `github.com/<org>/<repo>` — default branch `main`. Org: `<org>`.

**Issue types** (verified via API — set via `type` in PATCH, by name string):

- `Task` — a specific piece of work
- `Bug` — an unexpected problem or behavior
- `Feature` — a request, idea, or new functionality

**Issue fields** (verified via API — numeric IDs, set via `issue_field_values`):

| Field    | `field_id`  | Options                                                     |
| -------- | ----------- | ----------------------------------------------------------- |
| Priority | `<field_id>` | Urgent, High, Medium, Low                                  |
| Effort   | `<field_id>` | High, Medium, Low                                          |
| Start date | `<field_id>` | ISO date string                                          |
| Target date | `<field_id>` | ISO date string                                        |

(Replace `<field_id>` with the actual IDs from your org's issue-fields endpoint. Always PATCH with the **name string**, not the numeric option ID.)

### Labels available in this repo

Labels are **repo-level** (set via `--label` in `gh issue create`). This repo uses a `prefix: value` scheme with **a space after the colon**. Do NOT create new labels unless the user explicitly asks.

**type: \*** — nature of the work

- `type: feature` — New feature
- `type: chore` — General maintenance / tooling / deps
- `type: docs` — Documentation
- `type: refactor` — Refactoring / code restructuring
- `type: bug` — Bug / defect fix
- `type: security` — Security fix

**status: \*** — workflow state

- `status: triage` — Tech Lead hasn't seen it yet
- `status: ready` — Validated by Tech Lead, ready to pick up
- `status: needs-info` — Ticket is incomplete, dev can't work on it
- `status: in-progress` — A dev is working on it
- `status: in-review` — In Code Review
- `status: blocked` — Depends on another task or decision

**Cross-cutting**

- `breaking-change` — affects public API surface
- `github_actions` — related to CI/CD
- `dependencies` — dependency update request
- `version bump` — marks a PR for release version bump

**GitHub defaults (keep)**
`bug`, `enhancement`, `documentation`, `duplicate`, `invalid`, `question`, `wontfix`, `good first issue`, `help wanted`

### Templates available

Issue templates live in `.github/ISSUE_TEMPLATE/`:

- `bug_report.yml` — "Report something that is not working correctly", title `[BUG] `, labels: `bug`
- `feature_request.yml` — "Suggest a new feature or improvement", title `[FEATURE] `, labels: `enhancement`
- `docs_request.yml` — "Propose new / updated documentation", title `[Docs]: `, labels: `type: docs`, `status: triage`
- `refactor_request.yml` — "Propose a code/architecture refactoring", title `[Refactor]: `, labels: `type: refactor`, `status: triage`
- `task.yml` — "General maintenance / tooling / deps", title `[Chore]: `, labels: `type: chore`, `status: triage`

`config.yml` disables blank issues. Do NOT create a blank issue; use the templates or the structured `gh api` flow.

### Templates preferred for this repo

When a user asks to create an issue, use this **structured format** (not a blank issue):

- **Bug** → `bug_report.yml`
- **Feature request** → `feature_request.yml`
- **Docs** → `docs_request.yml`
- **Refactor** → `refactor_request.yml`
- **Task / chore** → `task.yml`
- **Anything else / needs custom fields** → structured PATCH via `gh api` (see Step 3 above)

## Output

After creation, confirm with a one-liner: issue number, title, type, Priority, Effort, and the URL.

## Error Handling

| Situation | Action |
|---|---|
| Org-field GET returns 404 | Report to user — org may not have Issue Fields enabled |
| Field value rejected | Verify option name matches the org-field definition; re-fetch if needed |
| PR creation fails | Check labels are valid, then retry |

## Constraints

- Prefix **every** `gh api` call with `MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'` (Windows Git Bash path-rewrite bug).
- Use `--input -` for `issue_field_values` array — not `-f` or `-F`.
- **Priority** values: `Urgent`, `High`, `Medium`, `Low`. **Effort** values: `High`, `Medium`, `Low`. **Type** values: `Task`, `Bug`, `Feature`.
- Do NOT use label names that don't exist — check `gh label list` first.
- Priority, Effort, Type are set via **org-fields** (API), NOT via labels.
- Do NOT open blank issues — always use the template picker or the structured API flow.
- Replace `<org>`, `<repo>`, `<field_id>`, `<team>` placeholders with your actual values.
