# Support

Where to ask for help with `eve-template`. Pick the channel that fits the
question — using the right one gets you a faster, more relevant answer.

---

## 💬 Questions, ideas, "how do I…"

**GitHub Discussions** is the right place for almost everything that isn't
a bug report or a security disclosure:

👉 **[github.com/deessejs/eve-template/discussions](https://github.com/deessejs/eve-template/discussions)**

Useful categories:

- **Q&A** — "How do I add a tool that calls an external API?"
- **Show and tell** — Built something with the template? Share it.
- **Feedback** — Opinions on defaults, naming, or ergonomics.
- **General** — Anything that doesn't fit the above.

Before posting, search for similar threads — chances are someone already
asked.

---

## 🐛 Bug reports

Open an issue using the [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
Include reproduction steps, expected vs. actual behavior, logs, and the
affected `🎯 Area`.

For feature requests, use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).

> **Not sure if it's a bug?** Ask in Discussions first. Bug reports create
> maintenance overhead, and we want to triage correctly.

---

## 🔒 Security vulnerabilities

**Do not file a public issue.** Use the channels documented in
[`SECURITY.md`](./SECURITY.md):

- GitHub Security Advisories (private) — preferred
- Direct email to a maintainer — for sensitive reports

---

## 📚 Documentation

- [`README.md`](./README.md) — quick start, layout, deployment, auth flow
- [`docs/learnings/vercel/eve/README.md`](./docs/learnings/vercel/eve/README.md) —
  how the `eve` framework works (durable execution, sandbox, channels, evals)
- [`docs/learnings/vercel/eve/auth.md`](./docs/learnings/vercel/eve/auth.md) —
  the route-auth / connection-auth split, where better-auth plugs in
- [`docs/plans/drizzle-better-auth-integration.md`](./docs/plans/drizzle-better-auth-integration.md) —
  the original integration plan that produced `lib/auth.ts` and `db/schema/auth.ts`
- `node_modules/eve/docs/` — bundled docs for the installed eve version
  (preferred over the website; matches the code on disk)
- [eve.dev](https://eve.dev) — official site

---

## 🤝 Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). It covers setup, the branching
model, the seven Claude agent skills that drive the lifecycle, the
Definition of Done, and the changeset workflow.

---

## 👥 Code of Conduct

All community spaces — issues, PRs, Discussions — are governed by
[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

---

## 🐦 Sister projects under `deessejs`

If you arrived here from a related scaffold, you may also be interested in:

- [`deessejs/saas-template`](https://github.com/deessejs/saas-template) —
  the sister SaaS starter this template shares its issue workflow with.

---

## 📈 Project status

This scaffold is **actively maintained**. We aim for:

- **48-hour** first response on issues and Discussions
- **7-day** triage → actionable response
- **Quarterly** releases aligned with `eve` minor versions

There's no SLA and no paid support tier. If you need a contractual response
time, this isn't the right project — fork it.