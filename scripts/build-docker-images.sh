#!/bin/bash
#
# Script Name: build-docker-images.sh
# Description: Build all Docker images for SMC Unlisted Stox staging deployment
# Author: SMC DevOps Team
# Created: 2026-01-19
# Last Modified: 2026-01-19
#
# Usage:
#   ./scripts/build-docker-images.sh [OPTIONS]
#
# Options:
#   --no-cache          Force clean build without cache
#   --service <name>    Build only specific service (auth-service, stocks-service, ticketing-service)
#   --tag <tag>         Tag images with custom tag (default: staging)
#   --help              Show this help message
#
# Examples:
#   ./scripts/build-docker-images.sh
#   ./scripts/build-docker-images.sh --no-cache
#   ./scripts/build-docker-images.sh --service auth-service
#
# Prerequisites:
#   - Docker installed and running
#   - pnpm installed
#   - Repository root contains docker-compose.staging.yml
#
# Exit Codes:
#   0 - Success
#   1 - Build failed
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
SERVICES=("auth-service" "stocks-service" "ticketing-service")
BUILD_START_TIME=""
NO_CACHE=""
SPECIFIC_SERVICE=""
CUSTOM_TAG="staging"
FAILED_BUILDS=()

# Helper functions
print_header() {
    echo -e "${BLUE} SMC Unlisted Stox - Docker Image Builder${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
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
SMC Unlisted Stox - Docker Image Builder

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --no-cache          Force clean build without using Docker cache
    --service <name>    Build only specific service (auth-service, stocks-service, ticketing-service)
    --tag <tag>         Tag images with custom tag (default: staging)
    --help              Show this help message

EXAMPLES:
    $0
    $0 --no-cache
    $0 --service auth-service
    $0 --tag v1.0.0

PREREQUISITES:
    - Docker installed and running
    - pnpm installed
    - Repository root contains docker-compose.staging.yml

EOF
}

check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker is not installed or not in PATH"
        exit 2
    fi

    if ! docker ps >/dev/null 2>&1; then
        print_error "Docker daemon is not running"
        exit 2
    fi

    print_success "Docker $(docker --version | cut -d' ' -f3)"

    # Check pnpm
    if ! command -v pnpm >/dev/null 2>&1; then
        print_error "pnpm is not installed or not in PATH"
        exit 2
    fi

    print_success "pnpm $(pnpm --version)"

    # Check repository structure
    if [ ! -f "$REPO_ROOT/docker-compose.staging.yml" ]; then
        print_error "docker-compose.staging.yml not found in repository root"
        exit 2
    fi

    # Check disk space (warn if less than 5GB free)
    DISK_FREE=$(df "$REPO_ROOT" | tail -1 | awk '{print $4}')
    DISK_FREE_GB=$((DISK_FREE / 1024 / 1024))

    if [ "$DISK_FREE_GB" -lt 5 ]; then
        print_warning "Low disk space: ${DISK_FREE_GB}GB free. Consider freeing up space before building."
    else
        print_success "${DISK_FREE_GB}GB disk space available"
    fi

    print_success "Prerequisites check passed"
}

build_service() {
    local service="$1"
    local image_name="smc-${service}"

    print_info "Building $service..."
    echo "  Image: $image_name:$CUSTOM_TAG"
    echo "  Dockerfile: apps/$service/Dockerfile"
    echo "  Context: $REPO_ROOT"

    local build_cmd="docker build -f apps/$service/Dockerfile -t $image_name:$CUSTOM_TAG"
    if [ "$NO_CACHE" = "true" ]; then
        build_cmd="$build_cmd --no-cache"
    fi
    build_cmd="$build_cmd $REPO_ROOT"

    if $build_cmd; then
        # Get image size
        local image_size=$(docker images "$image_name:$CUSTOM_TAG" --format "table {{.Size}}" | tail -n 1)
        print_success "$service built successfully (${image_size})"
        return 0
    else
        print_error "$service build failed"
        FAILED_BUILDS+=("$service")
        return 1
    fi
}

verify_images() {
    print_info "Verifying built images..."

    local all_exist=true
    for service in "${SERVICES[@]}"; do
        local image_name="smc-${service}:$CUSTOM_TAG"
        if docker images "$image_name" | grep -q "$image_name"; then
            print_success "$image_name exists"
        else
            print_error "$image_name not found"
            all_exist=false
        fi
    done

    if [ "$all_exist" = "true" ]; then
        print_success "All images verified successfully"
        return 0
    else
        print_error "Some images are missing"
        return 1
    fi
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --no-cache)
                NO_CACHE="true"
                shift
                ;;
            --service)
                if [ -n "$2" ] && [[ " ${SERVICES[*]} " =~ " $2 " ]]; then
                    SPECIFIC_SERVICE="$2"
                    shift 2
                else
                    print_error "Invalid service name. Must be one of: ${SERVICES[*]}"
                    exit 2
                fi
                ;;
            --tag)
                if [ -n "$2" ]; then
                    CUSTOM_TAG="$2"
                    shift 2
                else
                    print_error "--tag requires a value"
                    exit 2
                fi
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

main() {
    BUILD_START_TIME=$(date +%s)

    print_header
    echo "Build started at: $(date)"
    echo

    parse_arguments "$@"
    check_prerequisites
    echo

    # Determine which services to build
    if [ -n "$SPECIFIC_SERVICE" ]; then
        print_info "Building specific service: $SPECIFIC_SERVICE"
        SERVICES_TO_BUILD=("$SPECIFIC_SERVICE")
    else
        print_info "Building all services: ${SERVICES[*]}"
        SERVICES_TO_BUILD=("${SERVICES[@]}")
    fi

    echo

    # Build services
    for service in "${SERVICES_TO_BUILD[@]}"; do
        if ! build_service "$service"; then
            print_error "Failed to build $service"
        fi
        echo
    done

    # Verify images
    echo
    if verify_images; then
        BUILD_END_TIME=$(date +%s)
        BUILD_DURATION=$((BUILD_END_TIME - BUILD_START_TIME))

        echo
        print_success "Build completed successfully!"
        echo "  Total time: ${BUILD_DURATION}s"
        echo "  Images tagged: $CUSTOM_TAG"

        if [ ${#FAILED_BUILDS[@]} -eq 0 ]; then
            echo "  Status: All builds successful"
            exit 0
        else
            echo "  Status: ${#FAILED_BUILDS[@]} build(s) failed: ${FAILED_BUILDS[*]}"
            exit 1
        fi
    else
        print_error "Image verification failed"
        exit 1
    fi
}

# Run main function with all arguments
main "$@"