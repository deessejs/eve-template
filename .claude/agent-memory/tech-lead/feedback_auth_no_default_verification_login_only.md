---
name: feedback-auth-no-default-verification-login-only
description: For login-only templates where admin-created users are the only onboarding path, don't default to requireEmailVerification
metadata:
  type: feedback
---

When wiring auth into a login-only template (or any system where account creation is gated by an admin, not by self-service signup), **do not default `requireEmailVerification` to `true`** on the auth provider. Leave it `false`.

**Why:** The user pushed back on 2026-07-16 when the drizzle+better-auth integration plan set `requireEmailVerification: true` as a "defensive default". In a login-only flow with CLI-created users, there is no public signup → no email to verify → enabling verification either:
- breaks the login flow entirely (CLI-created user can't receive a verification email), or
- forces the admin to also configure a transactional email provider (Resend, SendGrid) for a threat that doesn't exist.

Admin vetting at user-creation time **is** the verification layer in this model.

**How to apply:** When wiring better-auth (or any auth provider) into a template/project with admin-gated onboarding, set `requireEmailVerification: false` by default. Document the choice in the security model section. Only flip it on if the project later adds a self-service signup path — and revisit email provider dependencies at the same time. The same principle applies to "MFA required by default" — add friction only when the threat model demands it.
