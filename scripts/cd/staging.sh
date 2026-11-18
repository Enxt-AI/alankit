#!/usr/bin/env bash

# Performs per-service blue/green-style deployment on the staging EC2 host.
# The GitHub Actions workflow that deploys from the staging branch calls this
# script remotely after an image has been built and pushed.

set -euo pipefail

SERVICE=""
IMAGE=""
GIT_SHA=""
SKIP_PULL="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)
      SERVICE="${2:-}"
      shift 2
      ;;
    --image)
      IMAGE="${2:-}"
      shift 2
      ;;
    --sha)
      GIT_SHA="${2:-}"
      shift 2
      ;;
    --skip-pull)
      SKIP_PULL="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SERVICE" || -z "$IMAGE" ]]; then
  echo "Usage: $0 --service <name> --image <image-ref> [--sha <git-sha>]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_DIR="$REPO_ROOT/deploy/staging/.state"
SLOTS_FILE="$STATE_DIR/active-slots.env"
IMAGE_STATE_FILE="$STATE_DIR/image-state.env"
NGINX_TEMPLATE="$REPO_ROOT/deploy/staging/nginx.staging.template.conf"
NGINX_CONFIG="$STATE_DIR/nginx.staging.conf"
ENV_FILE="$REPO_ROOT/.env.staging"
LOG_DIR="$REPO_ROOT/logs/nginx"
UPLOADS_DIR="$REPO_ROOT/apps/stocks-service/uploads"
DOCKER_NETWORK="smc-staging-network"
NGINX_CONTAINER="smc-nginx-staging"

# This mutable tag tracks the newest successfully built image channel for the
# staging deployment branch. It is used by cold-start and recovery paths when a
# service needs a branch-level fallback image rather than a specific SHA tag.
CHANNEL_TAG="staging-latest"

# Per-service runtime metadata used during rollout, health checks, and naming.
declare -A SERVICE_PORT=(
  [auth-service]=3002
  [payments-service]=3004
  [stocks-service]=3003
  [ticketing-service]=3001
)

declare -A SERVICE_MEMORY=(
  [auth-service]=250m
  [payments-service]=250m
  [stocks-service]=250m
  [ticketing-service]=250m
)

declare -A SERVICE_ROUTE=(
  [auth-service]=/api/health
  [payments-service]=/api/payments/health
  [stocks-service]=/api/health
  [ticketing-service]=/api/health
)

declare -A SERVICE_HEALTHCHECK_ROUTE=(
  [auth-service]=/api/health
  [payments-service]=/api/payments/health
  [stocks-service]=/api/health
  [ticketing-service]=/api/health
)

declare -A SERVICE_PREFIX=(
  [auth-service]=smc-auth-staging
  [payments-service]=smc-payments-staging
  [stocks-service]=smc-stocks-staging
  [ticketing-service]=smc-ticketing-staging
)

declare -A SLOT_VAR=(
  [auth-service]=AUTH_SLOT
  [payments-service]=PAYMENTS_SLOT
  [stocks-service]=STOCKS_SLOT
  [ticketing-service]=TICKETING_SLOT
)

declare -A IMAGE_VAR=(
  [auth-service]=AUTH_IMAGE
  [payments-service]=PAYMENTS_IMAGE
  [stocks-service]=STOCKS_IMAGE
  [ticketing-service]=TICKETING_IMAGE
)

declare -A PREVIOUS_IMAGE_VAR=(
  [auth-service]=AUTH_PREVIOUS_IMAGE
  [payments-service]=PAYMENTS_PREVIOUS_IMAGE
  [stocks-service]=STOCKS_PREVIOUS_IMAGE
  [ticketing-service]=TICKETING_PREVIOUS_IMAGE
)

declare -A DEFAULT_UPSTREAM=(
  [auth-service]=smc-auth-staging
  [payments-service]=smc-payments-staging
  [stocks-service]=smc-stocks-staging
  [ticketing-service]=smc-ticketing-staging
)

mkdir -p "$STATE_DIR" "$LOG_DIR" "$UPLOADS_DIR"
mkdir -p "$UPLOADS_DIR/kyc" "$UPLOADS_DIR/documents" "$UPLOADS_DIR/upcoming-documents"
# stocks-service runs as a non-root user in the container and needs write access
# to the bind-mounted uploads tree on the host.
chmod -R 0777 "$UPLOADS_DIR"

# Loads .env.staging without relying on `source`, which breaks on some values that
# contain spaces or CRLF line endings.
load_env_file() {
  local env_path="$1"
  local line

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"

    if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
      continue
    fi

    if [[ "$line" != *"="* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    key="${key##[[:space:]]}"
    key="${key%%[[:space:]]}"

    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi

    export "$key=$value"
  done < "$env_path"
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing staging env file at $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$NGINX_TEMPLATE" ]]; then
  echo "Missing nginx template at $NGINX_TEMPLATE" >&2
  exit 1
fi

load_env_file "$ENV_FILE"

for required_service in auth-service payments-service stocks-service ticketing-service; do
  if [[ -z "${SERVICE_PORT[$required_service]:-}" ]]; then
    echo "Unknown service definition: $required_service" >&2
    exit 1
  fi
done

if [[ -z "${SERVICE_PORT[$SERVICE]:-}" ]]; then
  echo "Unsupported service: $SERVICE" >&2
  exit 1
fi

AUTH_SLOT="${AUTH_SLOT:-}"
PAYMENTS_SLOT="${PAYMENTS_SLOT:-}"
STOCKS_SLOT="${STOCKS_SLOT:-}"
TICKETING_SLOT="${TICKETING_SLOT:-}"
AUTH_IMAGE="${AUTH_IMAGE:-}"
PAYMENTS_IMAGE="${PAYMENTS_IMAGE:-}"
STOCKS_IMAGE="${STOCKS_IMAGE:-}"
TICKETING_IMAGE="${TICKETING_IMAGE:-}"
AUTH_PREVIOUS_IMAGE="${AUTH_PREVIOUS_IMAGE:-}"
PAYMENTS_PREVIOUS_IMAGE="${PAYMENTS_PREVIOUS_IMAGE:-}"
STOCKS_PREVIOUS_IMAGE="${STOCKS_PREVIOUS_IMAGE:-}"
TICKETING_PREVIOUS_IMAGE="${TICKETING_PREVIOUS_IMAGE:-}"

if [[ -f "$SLOTS_FILE" ]]; then
  source "$SLOTS_FILE"
fi

if [[ -f "$IMAGE_STATE_FILE" ]]; then
  source "$IMAGE_STATE_FILE"
fi

# The script flips between blue and green slots so it can start a candidate container
# before switching traffic away from the current live one.
opposite_slot() {
  if [[ "$1" == "blue" ]]; then
    echo "green"
  else
    echo "blue"
  fi
}

container_exists() {
  docker container inspect "$1" >/dev/null 2>&1
}

container_name() {
  local service_name="$1"
  local slot_name="$2"
  echo "${SERVICE_PREFIX[$service_name]}-$slot_name"
}

slot_value_for() {
  local service_name="$1"
  local slot_key="${SLOT_VAR[$service_name]}"
  printf '%s' "${!slot_key:-}"
}

set_slot_value() {
  local service_name="$1"
  local value="$2"
  local slot_key="${SLOT_VAR[$service_name]}"
  printf -v "$slot_key" '%s' "$value"
}

image_value_for() {
  local service_name="$1"
  local image_key="${IMAGE_VAR[$service_name]}"
  printf '%s' "${!image_key:-}"
}

set_image_value() {
  local service_name="$1"
  local value="$2"
  local image_key="${IMAGE_VAR[$service_name]}"
  printf -v "$image_key" '%s' "$value"
}

previous_image_value_for() {
  local service_name="$1"
  local image_key="${PREVIOUS_IMAGE_VAR[$service_name]}"
  printf '%s' "${!image_key:-}"
}

set_previous_image_value() {
  local service_name="$1"
  local value="$2"
  local image_key="${PREVIOUS_IMAGE_VAR[$service_name]}"
  printf -v "$image_key" '%s' "$value"
}

save_state_files() {
  # Persist active slot and image state so later deployments know which container is live
  # and which image should be retained for quick rollback.
  cat > "$SLOTS_FILE" <<EOF
AUTH_SLOT=${AUTH_SLOT:-}
PAYMENTS_SLOT=${PAYMENTS_SLOT:-}
STOCKS_SLOT=${STOCKS_SLOT:-}
TICKETING_SLOT=${TICKETING_SLOT:-}
EOF

  cat > "$IMAGE_STATE_FILE" <<EOF
AUTH_IMAGE=${AUTH_IMAGE:-}
AUTH_PREVIOUS_IMAGE=${AUTH_PREVIOUS_IMAGE:-}
PAYMENTS_IMAGE=${PAYMENTS_IMAGE:-}
PAYMENTS_PREVIOUS_IMAGE=${PAYMENTS_PREVIOUS_IMAGE:-}
STOCKS_IMAGE=${STOCKS_IMAGE:-}
STOCKS_PREVIOUS_IMAGE=${STOCKS_PREVIOUS_IMAGE:-}
TICKETING_IMAGE=${TICKETING_IMAGE:-}
TICKETING_PREVIOUS_IMAGE=${TICKETING_PREVIOUS_IMAGE:-}
EOF
}

ensure_network() {
  if ! docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
    docker network create "$DOCKER_NETWORK" >/dev/null
  fi
}

connect_to_network() {
  local container="$1"
  if container_exists "$container"; then
    docker network connect "$DOCKER_NETWORK" "$container" >/dev/null 2>&1 || true
  fi
}

bootstrap_legacy_service() {
  # Adopt any pre-blue/green containers into the current slot model so existing
  # staging hosts can transition without a one-time manual migration step.
  local service_name="$1"
  local legacy_name="${DEFAULT_UPSTREAM[$service_name]}"
  local blue_name
  local green_name
  blue_name="$(container_name "$service_name" blue)"
  green_name="$(container_name "$service_name" green)"

  if [[ -z "$(slot_value_for "$service_name")" ]]; then
    if container_exists "$legacy_name" && ! container_exists "$blue_name" && ! container_exists "$green_name"; then
      docker rename "$legacy_name" "$blue_name"
    fi

    if container_exists "$blue_name"; then
      set_slot_value "$service_name" blue
    elif container_exists "$green_name"; then
      set_slot_value "$service_name" green
    fi
  fi

  connect_to_network "$blue_name"
  connect_to_network "$green_name"
}

resolve_upstream() {
  # Resolve the container name that Nginx should currently proxy to for a service.
  local service_name="$1"
  local active_slot
  active_slot="$(slot_value_for "$service_name")"

  if [[ -n "$active_slot" ]]; then
    local slot_container
    slot_container="$(container_name "$service_name" "$active_slot")"
    if container_exists "$slot_container"; then
      echo "$slot_container"
      return 0
    fi
  fi

  local legacy_name="${DEFAULT_UPSTREAM[$service_name]}"
  if container_exists "$legacy_name"; then
    echo "$legacy_name"
    return 0
  fi

  local blue_name
  local green_name
  blue_name="$(container_name "$service_name" blue)"
  green_name="$(container_name "$service_name" green)"

  if container_exists "$blue_name"; then
    echo "$blue_name"
    return 0
  fi

  if container_exists "$green_name"; then
    echo "$green_name"
    return 0
  fi

  echo ""
}

render_nginx_config() {
  # Generate a concrete Nginx config pointing each upstream at the currently active slot.
  local auth_upstream
  local stocks_upstream
  local ticketing_upstream
  local payments_upstream
  auth_upstream="$(resolve_upstream auth-service)"
  payments_upstream="$(resolve_upstream payments-service)"
  stocks_upstream="$(resolve_upstream stocks-service)"
  ticketing_upstream="$(resolve_upstream ticketing-service)"

  if [[ -z "$auth_upstream" || -z "$payments_upstream" || -z "$stocks_upstream" || -z "$ticketing_upstream" ]]; then
    echo "Cannot render nginx config until all backend services have an active container" >&2
    exit 1
  fi

  sed \
    -e "s/__AUTH_UPSTREAM__/$auth_upstream/g" \
    -e "s/__PAYMENTS_UPSTREAM__/$payments_upstream/g" \
    -e "s/__STOCKS_UPSTREAM__/$stocks_upstream/g" \
    -e "s/__TICKETING_UPSTREAM__/$ticketing_upstream/g" \
    "$NGINX_TEMPLATE" > "$NGINX_CONFIG"
}

ensure_nginx_container() {
  # Reload the existing Nginx container when possible; recreate it only if the mounted
  # config source changed or it does not exist yet.
  render_nginx_config

  if container_exists "$NGINX_CONTAINER"; then
    connect_to_network "$NGINX_CONTAINER"
    local mounted_config_source
    mounted_config_source="$(docker inspect -f '{{ range .Mounts }}{{ if eq .Destination "/etc/nginx/nginx.conf" }}{{ .Source }}{{ end }}{{ end }}' "$NGINX_CONTAINER")"

    if [[ "$mounted_config_source" != "$NGINX_CONFIG" ]]; then
      docker rm -f "$NGINX_CONTAINER" >/dev/null 2>&1 || true
    fi
  fi

  if container_exists "$NGINX_CONTAINER"; then
    docker exec "$NGINX_CONTAINER" nginx -t >/dev/null
    docker exec "$NGINX_CONTAINER" nginx -s reload >/dev/null
  else
    docker run -d \
      --name "$NGINX_CONTAINER" \
      --restart unless-stopped \
      --network "$DOCKER_NETWORK" \
      -p 80:80 \
      -v "$NGINX_CONFIG:/etc/nginx/nginx.conf:ro" \
      -v "$LOG_DIR:/var/log/nginx" \
      fabiocicerchia/nginx-lua:1.25.3-alpine >/dev/null
  fi
}

pull_image() {
  local image_ref="$1"

  if [[ "$SKIP_PULL" == "true" ]]; then
    return 0
  fi

  # GHCR occasionally returns transient EOF/network errors on EC2, so retry with a
  # fresh login before giving up the deployment.
  local attempt=1
  local max_attempts=5

  while (( attempt <= max_attempts )); do
    if docker pull "$image_ref" >/dev/null; then
      return 0
    fi

    if (( attempt == max_attempts )); then
      echo "Failed to pull image after $max_attempts attempts: $image_ref" >&2
      return 1
    fi

    echo "docker pull failed for $image_ref on attempt $attempt/$max_attempts; retrying" >&2

    if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
      echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null 2>&1 || true
    fi

    sleep $((attempt * 5))
    attempt=$((attempt + 1))
  done
}

current_image_from_container() {
  local container="$1"
  if container_exists "$container"; then
    docker inspect -f '{{.Config.Image}}' "$container"
  fi
}

wait_for_container_health() {
  # Wait for Docker's health check to mark the candidate container healthy before
  # allowing any traffic to switch over.
  local container="$1"
  local attempt=0
  local max_attempts=24

  while (( attempt < max_attempts )); do
    local health
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$container")"

    if [[ "$health" == "healthy" ]]; then
      return 0
    fi

    if [[ "$health" == "unhealthy" ]]; then
      docker logs "$container" --tail 100 >&2 || true
      return 1
    fi

    sleep 5
    attempt=$((attempt + 1))
  done

  docker logs "$container" --tail 100 >&2 || true
  return 1
}

run_candidate_container() {
  # Start the new version in the inactive slot using the same runtime options that
  # production traffic expects once Nginx points at it.
  local service_name="$1"
  local target_slot="$2"
  local container="$3"
  local image_ref="$4"
  local port="${SERVICE_PORT[$service_name]}"
  local healthcheck_route="${SERVICE_HEALTHCHECK_ROUTE[$service_name]}"

  docker rm -f "$container" >/dev/null 2>&1 || true

  local run_args=(
    docker run -d
    --name "$container"
    --restart unless-stopped
    --network "$DOCKER_NETWORK"
    --env-file "$ENV_FILE"
    --memory "${SERVICE_MEMORY[$service_name]}"
    -e NODE_ENV=production
    -e PORT="$port"
    -e "NODE_OPTIONS=--dns-result-order=ipv4first --max-old-space-size=200"
    --health-cmd "wget --spider -q http://localhost:$port$healthcheck_route || exit 1"
    --health-interval 30s
    --health-timeout 10s
    --health-retries 3
    --health-start-period 40s
  )

  if [[ "$service_name" == "auth-service" ]]; then
    run_args+=( -e "ALLOW_CONSOLE_OTP_FALLBACK=${ALLOW_CONSOLE_OTP_FALLBACK:-false}" )
  fi

  if [[ "$service_name" == "ticketing-service" ]]; then
    run_args+=( -e "DATABASE_URL=${TICKETING_DATABASE_URL:-$DATABASE_URL}" )
  fi

  if [[ "$service_name" == "stocks-service" ]]; then
    run_args+=( -v "$UPLOADS_DIR:/app/uploads" )
  fi

  run_args+=( "$image_ref" )
  "${run_args[@]}" >/dev/null
}

image_repository_for_service() {
  # Derive sibling service image repositories from the current image reference so a
  # cold-start host can bootstrap the rest of the backend stack.
  local service_name="$1"
  local current_repository="${IMAGE%%:*}"
  echo "${current_repository%-${SERVICE}}-$service_name"
}

default_channel_image_for_service() {
  local service_name="$1"
  echo "$(image_repository_for_service "$service_name"):$CHANNEL_TAG"
}

bootstrap_missing_service() {
  # Cold-start recovery path: if a service has no live container on EC2, bootstrap it
  # from the last known image before re-rendering Nginx.
  local service_name="$1"
  local bootstrap_image
  local bootstrap_slot="blue"
  local bootstrap_container

  if [[ -n "$(resolve_upstream "$service_name")" ]]; then
    return 0
  fi

  if [[ "$service_name" == "$SERVICE" ]]; then
    bootstrap_image="$IMAGE"
  else
    bootstrap_image="$(image_value_for "$service_name")"
    if [[ -z "$bootstrap_image" ]]; then
      bootstrap_image="$(default_channel_image_for_service "$service_name")"
    fi
  fi

  bootstrap_container="$(container_name "$service_name" "$bootstrap_slot")"

  echo "Bootstrapping missing service $service_name with image $bootstrap_image"
  pull_image "$bootstrap_image"
  run_candidate_container "$service_name" "$bootstrap_slot" "$bootstrap_container" "$bootstrap_image"

  if ! wait_for_container_health "$bootstrap_container"; then
    docker rm -f "$bootstrap_container" >/dev/null 2>&1 || true
    echo "Bootstrap container failed health checks for $service_name" >&2
    exit 1
  fi

  set_slot_value "$service_name" "$bootstrap_slot"
  set_image_value "$service_name" "$bootstrap_image"
  save_state_files
}

ensure_all_services_running() {
  # Nginx only renders once every backend upstream resolves to a live container.
  local service_name
  for service_name in auth-service payments-service stocks-service ticketing-service; do
    bootstrap_missing_service "$service_name"
  done
}

smoke_check_service_route() {
  # After cutover, verify the service through Nginx rather than only through the
  # container health check. This catches routing mistakes and bad upstream config.
  local service_name="$1"
  local route="${SERVICE_ROUTE[$service_name]}"
  local status

  status="$(docker exec "$NGINX_CONTAINER" sh -c "wget -S -O /dev/null http://localhost$route 2>&1 || true" | sed -n 's/.*HTTP\/[0-9.][0-9.]* \([0-9][0-9][0-9]\).*/\1/p' | tail -n 1)"

  echo "Smoke check route for $service_name: $route"
  echo "Smoke check status for $service_name: ${status:-<empty>}"

  if [[ -z "$status" ]]; then
    return 1
  fi

  if [[ "$status" =~ ^5 ]]; then
    return 1
  fi

  return 0
}

cleanup_service_images() {
  # Keep the current image plus the previous one for rollback, and remove anything older.
  local service_name="$1"
  local current_image
  local previous_image
  local repository
  current_image="$(image_value_for "$service_name")"
  previous_image="$(previous_image_value_for "$service_name")"
  repository="${IMAGE%%:*}"

  while IFS= read -r image_ref; do
    [[ -z "$image_ref" ]] && continue
    if [[ "$image_ref" == "$current_image" || "$image_ref" == "$previous_image" ]]; then
      continue
    fi
    docker image rm "$image_ref" >/dev/null 2>&1 || true
  done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' "$repository")

  docker image prune -f >/dev/null 2>&1 || true
}

deploy_service() {
  # Blue/green deployment flow:
  # 1. Start the candidate in the opposite slot.
  # 2. Wait for it to pass Docker health checks.
  # 3. Switch the active slot and reload Nginx.
  # 4. Smoke-check the service through Nginx.
  # 5. On success, delete the old live container and clean old images.
  # 6. On failure, restore the previous slot and remove the candidate.
  local service_name="$1"
  local current_slot
  local target_slot
  local stable_container=""
  local candidate_container
  local old_image=""

  current_slot="$(slot_value_for "$service_name")"
  if [[ -z "$current_slot" ]]; then
    current_slot="blue"
  fi
  target_slot="$(opposite_slot "$current_slot")"

  if [[ -n "$(slot_value_for "$service_name")" ]]; then
    stable_container="$(container_name "$service_name" "$(slot_value_for "$service_name")")"
  else
    stable_container="$(resolve_upstream "$service_name")"
  fi

  if [[ -n "$stable_container" ]]; then
    old_image="$(current_image_from_container "$stable_container")"
  fi

  candidate_container="$(container_name "$service_name" "$target_slot")"

  pull_image "$IMAGE"
  run_candidate_container "$service_name" "$target_slot" "$candidate_container" "$IMAGE"

  if ! wait_for_container_health "$candidate_container"; then
    docker rm -f "$candidate_container" >/dev/null 2>&1 || true
    echo "Candidate container failed health checks for $service_name" >&2
    exit 1
  fi

  set_slot_value "$service_name" "$target_slot"
  save_state_files

  ensure_all_services_running

  if ! ensure_nginx_container; then
    set_slot_value "$service_name" "$current_slot"
    save_state_files
    docker rm -f "$candidate_container" >/dev/null 2>&1 || true
    echo "Failed to reload nginx for $service_name" >&2
    exit 1
  fi

  if ! smoke_check_service_route "$service_name"; then
    set_slot_value "$service_name" "$current_slot"
    save_state_files
    ensure_nginx_container
    docker rm -f "$candidate_container" >/dev/null 2>&1 || true
    echo "Nginx smoke check failed for $service_name" >&2
    exit 1
  fi

  if [[ -n "$old_image" && "$old_image" != "$IMAGE" ]]; then
    set_previous_image_value "$service_name" "$old_image"
  fi
  set_image_value "$service_name" "$IMAGE"
  save_state_files

  if [[ -n "$stable_container" && "$stable_container" != "$candidate_container" ]]; then
    docker rm -f "$stable_container" >/dev/null 2>&1 || true
  fi

  cleanup_service_images "$service_name"
}

ensure_network
# Initialize the slot state from any existing containers before deploying the target service.
bootstrap_legacy_service auth-service
bootstrap_legacy_service payments-service
bootstrap_legacy_service stocks-service
bootstrap_legacy_service ticketing-service
save_state_files
deploy_service "$SERVICE"

# System-wide cleanup: remove unused images older than 24h and dangling build cache.
# This catches stale base images and layers from services that were not part of this deploy.
docker image prune -a --filter "until=24h" -f >/dev/null 2>&1 || true
docker builder prune --filter "until=24h" -f >/dev/null 2>&1 || true

echo "Deployment completed for $SERVICE using image $IMAGE${GIT_SHA:+ at $GIT_SHA}"
