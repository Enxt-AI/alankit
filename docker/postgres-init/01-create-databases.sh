#!/bin/sh
set -euo pipefail

# This script runs automatically on first container init.
# It creates additional databases required by the monorepo.

create_db() {
  local db=$1
  if ! psql -U "$POSTGRES_USER" -lqt | cut -d \| -f 1 | grep -qw "$db"; then
    echo "Creating database $db..."
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -c "CREATE DATABASE $db;"
  else
    echo "Database $db already exists."
  fi
}

create_db "unlisted_stox_db"
create_db "ticketing_system"

