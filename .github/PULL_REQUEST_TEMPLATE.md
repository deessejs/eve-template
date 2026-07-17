# Pull Request

<!--
Thanks for contributing to eve-template!

If you used the `create-pr` Claude skill to generate this PR, most of these
fields are already filled in — please review and clean up anything that
doesn't apply.

If you're opening this PR through the GitHub UI, fill in the sections below.
PRs target `staging`, never `main`. See CONTRIBUTING.md for the full flow.
-->

## Summary

<!-- One or two sentences: what does this PR do, and why? -->

## Related Issue

<!-- "Closes #N" or "Part of #N" — links the PR to the spec. -->

## Type of change

- [ ] Bug fix (patch)
- [ ] New feature (minor)
- [ ] Breaking change (major)
- [ ] Documentation only
- [ ] Refactor / cleanup
- [ ] CI / tooling

## What changed

<!-- A short list of files / areas touched. For larger PRs, link to the spec. -->

- [ ] `agent/` — agent behavior
- [ ] `app/` — web UI / routes
- [ ] `components/` — shared UI primitives
- [ ] `lib/` — auth / helpers
- [ ] `db/` — schema / migrations
- [ ] `docs/` — documentation
- [ ] `.github/` — workflows / templates
- [ ] `scripts/` — CLI bootstrap
- [ ] Other: <!-- describe -->

## How tested

<!-- Check all that apply. Manual testing notes go below. -->

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Tests pass (if any)
- [ ] Lint passes (if configured)
- [ ] Manual testing on a clean Postgres (`docker compose up postgres` + `npm run dev`)
- [ ] Manual testing against the deployed preview on Vercel

**Manual test notes:**
<!-- Describe what you did, what you observed, what URLs you hit. -->

## Screenshots / Demo

<!-- Required if you touched UI files. Attach images or describe what changed. -->

## Breaking changes

<!-- Required if you checked "Breaking change" above. Describe user-facing
     impact and the migration path. -->

- [ ] No breaking changes

## Changeset

<!-- A `.changeset/<name>.md` file MUST be included in this PR.

     If you used the `create-pr` skill, one was created automatically.
     Otherwise, run `npx changeset` and commit the result.

     See CONTRIBUTING.md § "Definition of Done" for the rules. -->

- [ ] `.changeset/*.md` included
- [ ] Bump type is correct (`patch` | `minor` | `major`)

## Checklist

- [ ] I have read [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [ ] I have read [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- [ ] My branch targets `staging`, not `main`
- [ ] I have not introduced any new lint or typecheck warnings
- [ ] I have updated relevant documentation (README, inline comments, `docs/`)
- [ ] I have not committed secrets, `.env` files, or build artifacts

## Additional context

<!-- Anything else the reviewer should know: design tradeoffs, follow-up
     work, links to design docs, related PRs, etc. -->

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)