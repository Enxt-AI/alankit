#!/usr/bin/env bash

# Computes the set of services affected by a given git diff.
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

local_mode=false

if [[ -z "$head_ref" ]]; then
  # If no args are provided, default to local uncommitted changes
  local_mode=true
  base_ref="HEAD"
  head_ref=""
else
  # CI Mode fallback logic
  if [[ -z "$base_ref" || "$base_ref" =~ ^0+$ ]]; then
    if git rev-parse "${head_ref}^" >/dev/null 2>&1; then
      base_ref="${head_ref}^"
    else
      base_ref="$head_ref"
    fi
  fi
fi

declare -A changed=(
  [auth-service]=0
  [payments-service]=0
  [stocks-service]=0
  [ticketing-service]=0
  [storage-service]=0
  [web]=0
  [panels]=0
  [rm-distributors]=0
)

mark_all() {
  for svc in "${!changed[@]}"; do
    changed[$svc]=1
  done
}

# Fan out shared package changes to the services they affect.
while IFS= read -r file_path; do
  [[ -z "$file_path" ]] && continue

  case "$file_path" in
    apps/*)
      svc_name=$(echo "$file_path" | cut -d'/' -f2)
      if [[ -n "${changed[$svc_name]:-}" ]]; then
        changed[$svc_name]=1
      fi
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
    .github/workflows/*|scripts/ci/*)
      mark_all
      ;;
  esac
done < <(
  if [[ "$local_mode" == "true" ]]; then
    # In local testing, diff against HEAD to see uncommitted changes
    git diff --name-only "$base_ref"
  else
    # In CI, diff between the two commits
    git diff --name-only "$base_ref" "$head_ref"
  fi
)

services=()
for service in auth-service payments-service stocks-service ticketing-service storage-service web panels rm-distributors; do
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

echo "Changed services: $services_json"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "services=$services_json"
    echo "has_changes=$has_changes"
  } >> "$GITHUB_OUTPUT"
fi