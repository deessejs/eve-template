#!/usr/bin/env bash
# Bootstrap the first admin user via better-auth's `create-admin` CLI.
#
# Sources .env first so DATABASE_URL and BETTER_AUTH_SECRET are visible to
# the underlying Node process. Re-pinned to the RC (1.7.0-rc.1) to match
# package.json — `auth@latest` resolves to 1.6.23 on npm and lacks the
# create-admin subcommand.
#
# Usage:
#   ./scripts/create-admin.sh --email admin@co.com --password 'correct horse battery staple' --name Admin
#
# Optional flags (forwarded verbatim):
#   --role <role>          default: 'admin' (the CLI's whole point)
#   --data <json>          extra fields for the user
#   --no-email-verified    skip marking the email as verified
#   --force / -y           skip the "users already exist" confirmation
set -euo pipefail

if [ -f .env ]; then
  set -a; source .env; set +a
elif [ -f .env.local ]; then
  set -a; source .env.local; set +a
fi

exec npx -y auth@1.7.0-rc.1 create-admin "$@"
