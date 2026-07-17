---
name: feedback-yaml-github-actions-quote-keys
description: GitHub Actions workflow files MUST quote every YAML 1.1 reserved-word-adjacent key/value, including `name`, `on`, `jobs`, `true`/`false`/`yes`/`no`/`off`. Unquoted keys fall through to GitHub's parser silently and the workflow is "registered as active" but no jobs ever run.
metadata:
  type: feedback
---

When writing `.github/workflows/*.yml` files for GitHub Actions, **quote every key and value that could be parsed as a YAML 1.1 reserved word**. The existing pattern in `.github/workflows/ci.yml` is the canonical fix — every string is double-quoted (`"on"`, `"jobs"`, etc.).

**Why:** YAML 1.1 (still used by GitHub's parser as of 2026) reserves `on`, `off`, `yes`, `no`, `true`, `false`, `null` as boolean/keyword tokens. When a key like `name: CodeQL` or `on: push` is unquoted, GitHub's parser silently falls back to using the workflow file's path as the display name (`name: ".github/workflows/codeql.yml"`) and schedules zero jobs. The workflow shows up as `active` in `gh workflow list` but every run concludes `failure` in 0 seconds with no logs.

Symptoms of this trap (all observed 2026-07-17 on the eve-template bootstrap):
- `gh workflow view "<name>"` returns "could not find any workflows named X"
- `gh workflow list` shows `name: ".github/workflows/<file>.yml"` instead of the file's `name:` field
- `gh api .../actions/runs/<id>/jobs` returns `total_count: 0`
- `gh run view ... --log` returns "log not found"
- The workflow file is structurally valid YAML (passes `js-yaml` locally)

**How to apply:** When adding or editing any `.github/workflows/*.yml` file in this repo, mirror the ci.yml pattern: every key and value quoted with double quotes. Specifically watch for: `name`, `on`, `jobs`, `true`, `false`, `yes`, `no`, `off`, `null`, `~`. Numeric values (`runs-on: ubuntu-latest`) can stay unquoted if they're strings, but quoting is harmless. If a workflow is mysteriously failing with zero jobs, this is the first thing to check — `gh workflow list` will show the path-as-name symptom if so.