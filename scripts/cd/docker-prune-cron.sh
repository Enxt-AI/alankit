#!/usr/bin/env bash

# Scheduled Docker cleanup for the staging EC2 host.
# Removes unused images, containers, volumes, and build cache older than 24 hours.
#
# SETUP (run once on EC2):
#   chmod +x ~/smc-unlisted-stox/scripts/deploy/docker-prune-cron.sh
#   crontab -e
#   # Add this line to run daily at 3 AM IST (21:30 UTC):
#   30 21 * * * /home/ubuntu/smc-unlisted-stox/scripts/deploy/docker-prune-cron.sh >> /home/ubuntu/smc-unlisted-stox/logs/docker-prune.log 2>&1

set -euo pipefail

echo "=== Docker Prune $(date '+%Y-%m-%d %H:%M:%S %Z') ==="

# Remove stopped containers older than 24h
echo "Pruning stopped containers..."
docker container prune --filter "until=24h" -f 2>/dev/null || true

# Remove unused images (not referenced by any container) older than 24h
echo "Pruning unused images..."
docker image prune -a --filter "until=24h" -f 2>/dev/null || true

# Remove dangling build cache older than 24h
echo "Pruning build cache..."
docker builder prune --filter "until=24h" -f 2>/dev/null || true

# Remove unused anonymous volumes (be conservative — only truly dangling ones)
echo "Pruning dangling volumes..."
docker volume prune -f 2>/dev/null || true

# Log current disk usage
echo "--- Disk usage after prune ---"
df -h / | tail -1
echo "--- Docker disk usage ---"
docker system df 2>/dev/null || true
echo "=== Prune complete ==="
