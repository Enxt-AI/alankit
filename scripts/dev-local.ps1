# LOCAL DEV launcher (Option A: hybrid - Docker infra + turbo dev)
# Usage:
#   ./scripts/dev-local.ps1                    # backends + web + panels
#   ./scripts/dev-local.ps1 -BackendsOnly       # only NestJS services
#   ./scripts/dev-local.ps1 -Filters web        # pass custom turbo filters
#
# Local redis runs WITHOUT a password (see docker-compose.yml), so no
# REDIS_PASSWORD export is needed — and it must NOT be set, otherwise the
# client sends AUTH to a passwordless server and every command fails.
# (History: packages/redis-service builds its client at import time, before
# Nest loads apps/*/.env, so a password would force shell exports in every
# terminal. Passwordless local redis sidesteps that entirely.)

param(
  [switch]$BackendsOnly,
  [string[]]$Filters = @()
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# 1. Infra (redis + minio via docker-compose.yml, postgres via staging profile)
docker compose up -d redis minio
docker compose -f docker-compose.staging.yml --profile local-db up -d postgres

# 2. Make sure no stale REDIS_PASSWORD leaks in (it would break auth
#    against the passwordless local redis). REDIS_HOST/PORT default to
#    localhost:6379 in code, so nothing needs exporting.
Remove-Item Env:\REDIS_PASSWORD -ErrorAction SilentlyContinue

# 3. Run
if ($BackendsOnly) {
  pnpm start:dev
} elseif ($Filters.Count -gt 0) {
  $filterArgs = $Filters | ForEach-Object { @('--filter', $_) }
  pnpm exec turbo run dev @filterArgs
} else {
  # Default: all backends + web + panels (skip rm-distributors/android/capacitor to save RAM)
  pnpm exec turbo run dev --filter=auth-service --filter=stocks-service --filter=ticketing-service --filter=payments-service --filter=storage-service --filter=web --filter=panels
}
