#!/usr/bin/env bash

# Builds and pushes a backend service image to GHCR.
# The workflow passes in both the immutable SHA tag and the rolling channel tag.

set -euo pipefail

service="${1:-}"
image_sha_tag="${2:-}"
image_channel_tag="${3:-}"

if [[ -z "$service" || -z "$image_sha_tag" ]]; then
  echo "Usage: $0 <service> <sha-tag> [channel-tag]" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for Docker image builds" >&2
  exit 1
fi

dockerfile_path="apps/$service/Dockerfile"

if [[ ! -f "$dockerfile_path" ]]; then
  echo "Dockerfile not found for $service at $dockerfile_path" >&2
  exit 1
fi

# Buildx is used so the workflow can push directly to GHCR without a separate docker push.
build_args=(
  --build-arg "DATABASE_URL=$DATABASE_URL"
  --platform linux/amd64
  --provenance=false
  -f "$dockerfile_path"
  -t "$image_sha_tag"
)

if [[ -n "$image_channel_tag" ]]; then
  build_args+=( -t "$image_channel_tag" )
fi

if [[ "$service" == "ticketing-service" ]]; then
  # ticketing-service generates a separate Prisma client from its own database package.
  if [[ -z "${TICKETING_DATABASE_URL:-}" ]]; then
    echo "TICKETING_DATABASE_URL is required for ticketing-service builds" >&2
    exit 1
  fi
  build_args+=( --build-arg "TICKETING_DATABASE_URL=$TICKETING_DATABASE_URL" )
fi

docker buildx build --push "${build_args[@]}" .
