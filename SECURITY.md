# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `main` (latest) | ✅ Active development — receives all fixes |
| `staging` | ⚠️ Pre-release — receives fixes that haven't shipped yet |
| Older tags | ❌ Unsupported — please upgrade |

This is a scaffold, not a long-running service, so we don't maintain
backports. If you're on an older commit, the fix lives on `main`; rebasing
on top of it is the supported path.

---

## Reporting a Vulnerability

**Please do not file a public issue.** A public disclosure gives attackers a
free hint before a fix lands.

Use **one** of these private channels:

1. **GitHub Security Advisories** (preferred) — open a private advisory at
   `https://github.com/deessejs/eve-template/security/advisories/new`.
   This routes to the maintainers without exposing details in the public
   issue tracker.
2. **Direct email** — for sensitive disclosures that can't go through
   GitHub, see [`SUPPORT.md`](./SUPPORT.md) for the maintainer contact.

Include as much of the following as you can:

- A clear description of the vulnerability and its impact
- Steps to reproduce, ideally with a minimal proof of concept
- Affected versions (commit SHA, branch, or release tag)
- The component (`agent/`, `app/`, `lib/auth.ts`, `db/`, a third-party
  dependency, etc.)
- Any known mitigations or workarounds you've already identified

If a report crosses multiple components or dependencies, mention each one —
transitive vulnerabilities in `better-auth`, `drizzle-orm`, `eve`, or
`vercel-minimax-ai-provider` count and we'll route them upstream.

---

## Our Commitments

When you report a vulnerability through the channels above, we will:

| Step | Target window |
|---|---|
| Acknowledge receipt | within **48 hours** |
| Triage and assign a severity (CVSS or qualitative) | within **7 days** |
| Propose a fix or a workaround | within **30 days** for High / Critical |
| Coordinate disclosure timing with you | before any public mention |
| Credit you in the release notes | on request, unless you prefer anonymity |

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure):
we'll work with you to set a disclosure date that gives users time to patch,
typically 90 days from confirmation.

---

## Scope

What counts as a security issue for this repo:

- Authentication or session bypass in `lib/auth.ts` / `lib/eve-auth.ts`
- Authorization flaws in `agent/channels/eve.ts` (the route-auth walk or the
  `betterAuthFn` resolver)
- SQL injection or unsanitized Drizzle queries in `db/`
- Cross-tenant or cross-user data leakage in the agent runtime
- Secret leakage: keys committed to git, cookies that aren't `httpOnly` /
  `secure` / `sameSite=lax`, weak `BETTER_AUTH_SECRET` defaults
- Dependency vulnerabilities in `package.json` deps with no upstream patch
- Sandbox escape from the eve runtime, if you've added a custom sandbox

What we consider out of scope:

- Issues in dependencies that have an upstream fix and a Dependabot PR open
- "Best practice" hardening that doesn't have an exploit path (e.g.
  adding CSRF tokens to GET routes)
- Reports against forks or modified versions — please reproduce against
  `main`

---

## Authentication Hardening Notes

For deployers — quick reminders that show up in real audits:

1. **`BETTER_AUTH_SECRET` must be ≥32 chars** and unique per environment.
   Rotate using `BETTER_AUTH_SECRETS` (plural) — see better-auth docs.
2. **`proxy.ts` is not a security boundary.** It's a redirect optimization.
   The real check is in `app/(authenticated)/layout.tsx` and the eve route
   auth chain. Don't rely on cookie presence alone.
3. **Don't expose `placeholderAuth()` in production** — `eve init` ships
   it; remove it before any browser caller hits the deployed agent.
4. **`localDev()` trusts the request hostname.** An attacker that can inject
   a `Host` header can spoof loopback unless a real authenticator runs first
   in the auth chain. In `agent/channels/eve.ts`, `betterAuthFn` runs first;
   keep it that way.

---

## Recognition

If you report a valid vulnerability, we'll thank you in the next release
notes (unless you ask to stay anonymous). Significant reports may be
eligible for a CVE — ask if you want one filed and we'll coordinate with
GitHub Security Advisories to publish it.

---

## Related

- [`SUPPORT.md`](./SUPPORT.md) — non-security questions, Discussions link
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — how to set up a dev environment
- [GitHub Security Advisories docs](https://docs.github.com/en/code-security/security-advisories)