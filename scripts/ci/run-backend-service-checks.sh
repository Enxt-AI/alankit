#!/usr/bin/env bash

# Runs the build-only validation gate for a single backend service.
# Each branch explicitly builds the shared packages required by that service first.

set -euo pipefail

service="${1:-}"

if [[ -z "$service" ]]; then
  echo "Usage: $0 <auth-service|stocks-service|ticketing-service>" >&2
  exit 1
fi

case "$service" in
  auth-service)
    # auth-service depends on the unlisted-stox Prisma client, Redis wrapper,
    # cookie crypto package, and email-service.
    pnpm --filter db-unlisted-stox run generate
    pnpm --filter db-unlisted-stox run build
    pnpm --filter redis-service run build
    pnpm --filter email-service run build
    pnpm --filter cookie-crypto run build
    pnpm --filter auth-service run build
    ;;
  payments-service)
    # payments-service uses the unlisted-stox DB package plus email and cookie helpers.
    pnpm --filter db-unlisted-stox run generate
    pnpm --filter db-unlisted-stox run build
    pnpm --filter email-service run build
    pnpm --filter cookie-crypto run build
    pnpm --filter payments-service run build
    ;;
  stocks-service)
    # stocks-service depends on Redis, email delivery, and cookie crypto.
    pnpm --filter db-unlisted-stox run generate
    pnpm --filter db-unlisted-stox run build
    pnpm --filter redis-service run build
    pnpm --filter email-service run build
    pnpm --filter cookie-crypto run build
    pnpm --filter stocks-service run build
    ;;
  ticketing-service)
    # ticketing-service has the widest dependency graph because it uses both DB
    # packages plus shared stats/type packages.
    pnpm --filter db-unlisted-stox run generate
    pnpm --filter db-ticketing run generate
    pnpm --filter db-unlisted-stox run build
    pnpm --filter db-ticketing run build
    pnpm --filter email-service run build
    pnpm --filter shared-types run build
    pnpm --filter stats-types run build
    pnpm --filter cookie-crypto run build
    pnpm --filter ticketing-service run build
    ;;
  *)
    echo "Unsupported service: $service" >&2
    exit 1
    ;;
esac
