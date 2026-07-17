---
name: feedback-deessejs-correct-org
description: In the eve-template repo, `deessejs` IS the canonical GitHub organization — do not flag LICENSE/README/issue-template references to it as inconsistencies or fork leftovers.
metadata:
  type: feedback
---

In `templates/eve-template/`, the GitHub organization across LICENSE (`Copyright 2026 deessejs`), README (`github.com/deessejs/eve-template`), and `.github/ISSUE_TEMPLATE/config.yml` contact links is **`deessejs`** — correct and intentional. The local checkout path `C:/Users/dpereira/Documents/github/templates/eve-template/` is just a local-disk convention, not a different org. The template name `eve-template` is also confirmed (not a placeholder).

**Why:** On 2026-07-17, the user corrected a previous analysis where I had flagged the `deessejs` references and the `saas-template` contact links as broken/copy-paste leftovers. The user explicitly said: "on est toujours deessejs comm orga, le nom, de template est ok". There may be related sister repos under the same org (e.g. `deessejs/saas-template`) that legitimately share issue-template scaffolding.

**How to apply:** When reviewing this repo, do not surface `deessejs` references as inconsistencies between LICENSE, README, contact links, or CODEOWNERS names. If a code review surfaces a `deessejs/<other-repo>` URL, treat it as a sister project link, not a misconfiguration. If a future unrelated file (release workflow, package.json `repository` field) appears with a different org, that *would* be worth flagging — because `deessejs` is the established baseline.
