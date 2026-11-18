#!/usr/bin/env bash

# Recreates a single staging service from the image that is already present on EC2.
# This is useful for picking up .env.staging changes without running the full Actions workflow.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <auth-service|payments-service|stocks-service|ticketing-service>" >&2
  exit 1
fi

service="$1"

case "$service" in
  auth-service)
    prefix="smc-auth-staging"
    ;;
  payments-service)
    prefix="smc-payments-staging"
    ;;
  stocks-service)
    prefix="smc-stocks-staging"
    ;;
  ticketing-service)
    prefix="smc-ticketing-staging"
    ;;
  *)
    echo "Unsupported service: $service" >&2
    exit 1
    ;;
esac

# Look for the currently known blue/green container and reuse its image reference.
container_name="$({ docker ps --format '{{.Names}}'; docker ps -a --format '{{.Names}}'; } | grep -E "^${prefix}-(blue|green)$" | head -n 1)"

if [[ -z "$container_name" ]]; then
  echo "No existing staging container found for $service" >&2
  exit 1
fi

image_ref="$(docker inspect -f '{{.Config.Image}}' "$container_name")"

# Delegate the actual recreation logic to the main staging deploy script, but skip
# the registry pull because the image is already present locally on EC2.
bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/staging.sh" --service "$service" --image "$image_ref" --skip-pull