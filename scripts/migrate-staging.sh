#!/bin/bash
#
# Script Name: migrate-staging.sh
# Description: Run database migrations for SMC Unlisted Stox staging environment
# Author: SMC DevOps Team
# Created: 2026-01-19
# Last Modified: 2026-01-19
#
# Usage:
#   ./scripts/migrate-staging.sh [OPTIONS]
#
# Options:
#   --dry-run           Show commands without executing
#   --help              Show this help message
#
# Examples:
#   ./scripts/migrate-staging.sh
#   ./scripts/migrate-staging.sh --dry-run
#
# Prerequisites:
#   - .env.staging file exists in repository root
#   - pnpm installed and available
#   - Access to Supabase databases via DATABASE_URL and TICKETING_DATABASE_URL
#
# Exit Codes:
#   0 - Success
#   1 - Migration failed
#   2 - Prerequisites not met
#

set -e
set -o pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DRY_RUN=false
MIGRATE_LOG="/tmp/local-migrate-$(date +%Y%m%d-%H%M%S).log"

# Helper functions
print_header() {
    echo -e "${BLUE}  SMC Unlisted Stox - Database Migration${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN} $1${NC}"
}

print_error() {
    echo -e "${RED} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  $1${NC}"
}

print_info() {
    echo -e "${BLUE} $1${NC}"
}

show_help() {
    cat << EOF
SMC Unlisted Stox - Database Migration

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --dry-run           Show commands without executing
    --help              Show this help message

EXAMPLES:
    $0
    $0 --dry-run

PREREQUISITES:
    - .env.staging file exists in repository root
    - pnpm installed and available
    - Access to Supabase databases via DATABASE_URL and TICKETING_DATABASE_URL

EOF
}

log_command() {
    local cmd="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd" >> "$MIGRATE_LOG"
}

run_cmd() {
    local cmd="$1"
    local description="$2"

    if [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: $cmd"
        return 0
    fi

    print_info "Running: $description"
    log_command "$cmd"

    if eval "$cmd"; then
        print_success "$description completed"
        return 0
    else
        print_error "$description failed"
        return 1
    fi
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 2
                ;;
        esac
    done
}

check_local_prerequisites() {
    print_info "Checking local prerequisites..."

    # Check pnpm
    if ! command -v pnpm >/dev/null 2>&1; then
        print_error "pnpm is not installed or not in PATH"
        exit 2
    fi

    print_success "pnpm available"

    # Check .env.staging file
    if [ ! -f "$REPO_ROOT/.env.staging" ]; then
        print_error ".env.staging file not found in repository root: $REPO_ROOT/.env.staging"
        exit 2
    fi

    print_success ".env.staging file exists"

    # Source environment variables
    set -a
    source "$REPO_ROOT/.env.staging"
    set +a

    # Check DATABASE_URL
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not found in .env.staging"
        exit 2
    fi

    print_success "DATABASE_URL configured"

    # Check TICKETING_DATABASE_URL
    if [ -z "$TICKETING_DATABASE_URL" ]; then
        print_error "TICKETING_DATABASE_URL not found in .env.staging"
        exit 2
    fi

    print_success "TICKETING_DATABASE_URL configured"
}

migrate_unlisted_stox_db() {
    print_info "Migrating unlisted-stox database..."

    # Prisma Migrate should use a direct (non-pgbouncer) connection when available.
    # This avoids failures/hangs when DATABASE_URL points at Supabase transaction pooler.
    local ORIGINAL_DATABASE_URL="${DATABASE_URL:-}"
    if [ -n "${DIRECT_URL:-}" ]; then
        export DATABASE_URL="$DIRECT_URL"
        print_info "Using DIRECT_URL for unlisted-stox migrations"
    fi

    # Change to db-unlisted-stox directory
    cd "$REPO_ROOT/packages/db-unlisted-stox"

    # Generate Prisma client
    run_cmd "pnpm exec prisma generate" "Generate Prisma client for unlisted-stox"

    # Run migrations
    run_cmd "pnpm exec prisma migrate deploy" "Run migrations for unlisted-stox"

    # Restore original DATABASE_URL for any later steps
    if [ -n "$ORIGINAL_DATABASE_URL" ]; then
        export DATABASE_URL="$ORIGINAL_DATABASE_URL"
    fi

    print_success "Unlisted-stox database migration completed"
}

migrate_ticketing_db() {
    print_info "Migrating ticketing database..."

    # Ticketing package expects DATABASE_URL; point it to the ticketing DB.
    local ORIGINAL_DATABASE_URL="${DATABASE_URL:-}"
    if [ -n "${TICKETING_DATABASE_URL:-}" ]; then
        export DATABASE_URL="$TICKETING_DATABASE_URL"
        print_info "Using TICKETING_DATABASE_URL for ticketing migrations"
    fi

    # Change to db-ticketing directory
    cd "$REPO_ROOT/packages/db-ticketing"

    # Generate Prisma client
    run_cmd "pnpm exec prisma generate" "Generate Prisma client for ticketing"

    # Run migrations
    run_cmd "pnpm exec prisma migrate deploy" "Run migrations for ticketing"

    # Restore original DATABASE_URL
    if [ -n "$ORIGINAL_DATABASE_URL" ]; then
        export DATABASE_URL="$ORIGINAL_DATABASE_URL"
    fi

    print_success "Ticketing database migration completed"
}

seed_databases() {
    print_info "Seeding databases..."

    # Seed unlisted-stox database if seed script exists
    if [ -f "$REPO_ROOT/packages/db-unlisted-stox/prisma/seed.ts" ]; then
        cd "$REPO_ROOT/packages/db-unlisted-stox"
        run_cmd "pnpm exec prisma db seed" "Seed unlisted-stox database"
        print_success "Unlisted-stox database seeded"
    else
        print_info "No seed script found for unlisted-stox database"
    fi

    # Seed ticketing database if seed script exists
    if [ -f "$REPO_ROOT/packages/db-ticketing/prisma/seed.ts" ]; then
        cd "$REPO_ROOT/packages/db-ticketing"
        run_cmd "pnpm exec prisma db seed" "Seed ticketing database"
        print_success "Ticketing database seeded"
    else
        print_info "No seed script found for ticketing database"
    fi
}

verify_migrations() {
    print_info "Verifying migrations..."

    # Verify unlisted-stox database connection
    cd "$REPO_ROOT/packages/db-unlisted-stox"
    if run_cmd "pnpm exec prisma db execute --file <(echo 'SELECT 1;')" "Verify unlisted-stox database connection" >/dev/null 2>&1; then
        print_success "Unlisted-stox database: OK"
    else
        print_warning "Could not verify unlisted-stox database connection"
    fi

    # Verify ticketing database connection
    cd "$REPO_ROOT/packages/db-ticketing"
    if run_cmd "pnpm exec prisma db execute --file <(echo 'SELECT 1;')" "Verify ticketing database connection" >/dev/null 2>&1; then
        print_success "Ticketing database: OK"
    else
        print_warning "Could not verify ticketing database connection"
    fi

    print_success "Migration verification completed"
}

main() {
    print_header
    echo "Migration started at: $(date)"
    echo "Log file: $MIGRATE_LOG"
    if [ "$DRY_RUN" = "true" ]; then
        echo "Mode: Dry run (commands will be shown but not executed)"
    else
        echo "Mode: Live migration"
    fi
    echo

    parse_arguments "$@"
    check_local_prerequisites
    echo

    migrate_unlisted_stox_db
    echo

    migrate_ticketing_db
    echo

    seed_databases
    echo

    verify_migrations
    echo

    if [ "$DRY_RUN" = "true" ]; then
        print_success "Dry run completed - review commands above"
        exit 0
    fi

    print_success "Database migration completed successfully!"
    echo
    echo "Migration log saved to: $MIGRATE_LOG"
    echo
    echo "Next steps:"
    echo "1. Deploy the application:"
    echo "   ./scripts/deploy-to-ec2.sh --ip YOUR_EC2_IP --key ~/.ssh/your-key.pem"
}

# Run main function with all arguments
main "$@"

log_command() {
    local cmd="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd" >> "$MIGRATE_LOG"
}

# Helper functions
print_header() {
    echo -e "${BLUE}  SMC Unlisted Stox - Database Migration${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN} $1${NC}"
}

print_error() {
    echo -e "${RED} $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  $1${NC}"
}

print_info() {
    echo -e "${BLUE} $1${NC}"
}

show_help() {
    cat << EOF
SMC Unlisted Stox - Database Migration

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --ip <ip>           EC2 public IP address (required)
    --key <path>        Path to SSH private key file (required)
    --user <username>   SSH username (default: ec2-user)
    --dry-run           Show commands without executing
    --help              Show this help message

EXAMPLES:
    $0 --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem
    $0 --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem --dry-run

PREREQUISITES:
    - EC2 instance set up with Docker and Docker Compose
    - SSH access to EC2 instance
    - Repository cloned on EC2
    - .env.staging file on EC2
    - Docker containers running (or will be started)

EOF
}

# Run main function with all arguments
main "$@"