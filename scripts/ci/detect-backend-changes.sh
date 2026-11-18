#!/usr/bin/env bash

# Computes the set of backend services affected by a given git diff.
# The workflows use this to avoid validating, building, and deploying untouched services.

set -euo pipefail

base_ref=""
head_ref=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      base_ref="${2:-}"
      shift 2
      ;;
    --head)
      head_ref="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$head_ref" ]]; then
  echo "Missing --head argument" >&2
  exit 1
fi

# On first pushes GitHub may provide an all-zero base SHA. Fall back to the previous
# commit when possible so the script can still calculate a meaningful diff.
if [[ -z "$base_ref" || "$base_ref" =~ ^0+$ ]]; then
  if git rev-parse "${head_ref}^" >/dev/null 2>&1; then
    base_ref="${head_ref}^"
  else
    base_ref="$head_ref"
  fi
fi

declare -A changed=(
  [auth-service]=0
  [payments-service]=0
  [stocks-service]=0
  [ticketing-service]=0
)

mark_all() {
  changed[auth-service]=1
  changed[payments-service]=1
  changed[stocks-service]=1
  changed[ticketing-service]=1
}

# Fan out shared package and deployment-asset changes to the services they affect.
while IFS= read -r file_path; do
  [[ -z "$file_path" ]] && continue

  case "$file_path" in
    apps/auth-service/*)
      changed[auth-service]=1
      ;;
    apps/payments-service/*)
      changed[payments-service]=1
      ;;
    apps/stocks-service/*)
      changed[stocks-service]=1
      ;;
    apps/ticketing-service/*)
      changed[ticketing-service]=1
      ;;
    packages/db-unlisted-stox/*|packages/cookie-crypto/*|packages/typescript-config/*)
      mark_all
      ;;
    packages/db-ticketing/*|packages/shared-types/*|packages/stats-types/*)
      changed[ticketing-service]=1
      ;;
    packages/redis-service/*)
      changed[auth-service]=1
      changed[stocks-service]=1
      ;;
    packages/email-service/*)
      changed[payments-service]=1
      changed[stocks-service]=1
      changed[ticketing-service]=1
      ;;
    package.json|pnpm-lock.yaml|pnpm-workspace.yaml|turbo.json)
      mark_all
      ;;
    .github/workflows/*|scripts/ci/*|scripts/deploy/*|deploy/staging/*|docs/BACKEND_CICD_V1.md|docs/STAGING_DEPLOYMENT_GUIDE.md)
      mark_all
      ;;
  esac
done < <(git diff --name-only "$base_ref" "$head_ref")

services=()
# Preserve a stable service order so workflow output is predictable across runs.
for service in auth-service payments-service stocks-service ticketing-service; do
  if [[ "${changed[$service]}" == "1" ]]; then
    services+=("\"$service\"")
  fi
done

if [[ ${#services[@]} -eq 0 ]]; then
  services_json='[]'
  has_changes='false'
else
  services_json="[$(IFS=,; echo "${services[*]}")]"
  has_changes='true'
fi

echo "Changed backend services: $services_json"

# Emit outputs for GitHub Actions when the script is running inside a workflow job.
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "services=$services_json"
    echo "has_changes=$has_changes"
  } >> "$GITHUB_OUTPUT"
fi
