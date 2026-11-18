#!/bin/bash
#
# Script Name: deploy-to-ec2.sh
# Description: Deploy SMC Unlisted Stox to EC2 staging environment
# Author: SMC DevOps Team
# Created: 2026-01-19
# Last Modified: 2026-01-19
#
# Usage:
#   ./scripts/deploy-to-ec2.sh [OPTIONS]
#
# Options:
#   --ip <ip>           EC2 public IP address (required)
#   --key <path>        Path to SSH private key file (required)
#   --branch <branch>   Git branch to deploy (default: main)
#   --skip-build        Skip Docker image rebuild (restart only)
#   --user <username>   SSH username (default: ec2-user)
#   --help              Show this help message
#
# Examples:
#   ./scripts/deploy-to-ec2.sh --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem
#   ./scripts/deploy-to-ec2.sh --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem --branch develop
#   ./scripts/deploy-to-ec2.sh --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem --skip-build
#
# Prerequisites:
#   - EC2 instance set up with Docker and Docker Compose
#   - SSH access to EC2 instance
#   - Repository cloned on EC2
#   - .env.staging file on EC2
#
# Exit Codes:
#   0 - Success
#   1 - Deployment failed
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
EC2_IP=""
SSH_KEY=""
SSH_USER="ec2-user"
GIT_BRANCH="main"
SKIP_BUILD=false
DEPLOY_LOG="/tmp/ec2-deploy-$(date +%Y%m%d-%H%M%S).log"

# Helper functions
print_header() {
    echo -e "${BLUE} SMC Unlisted Stox - EC2 Deployment${NC}"
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
SMC Unlisted Stox - EC2 Deployment

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --ip <ip>           EC2 public IP address (required)
    --key <path>        Path to SSH private key file (required)
    --branch <branch>   Git branch to deploy (default: main)
    --skip-build        Skip Docker image rebuild (restart only)
    --user <username>   SSH username (default: ec2-user)
    --help              Show this help message

EXAMPLES:
    $0 --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem
    $0 --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem --branch develop
    $0 --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem --skip-build

PREREQUISITES:
    - EC2 instance set up with Docker and Docker Compose
    - SSH access to EC2 instance
    - Repository cloned on EC2
    - .env.staging file on EC2

EOF
}

log_command() {
    local cmd="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd" >> "$DEPLOY_LOG"
}

run_ssh() {
    local cmd="$1"
    local description="$2"

    print_info "Running: $description" >&2
    log_command "SSH: $cmd"

    if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$EC2_IP" "$cmd"; then
        print_success "$description completed" >&2
        return 0
    else
        print_error "$description failed" >&2
        return 1
    fi
}

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --ip)
                if [ -n "$2" ]; then
                    EC2_IP="$2"
                    shift 2
                else
                    print_error "--ip requires a value"
                    exit 2
                fi
                ;;
            --key)
                if [ -n "$2" ]; then
                    SSH_KEY="$2"
                    shift 2
                else
                    print_error "--key requires a value"
                    exit 2
                fi
                ;;
            --branch)
                if [ -n "$2" ]; then
                    GIT_BRANCH="$2"
                    shift 2
                else
                    print_error "--branch requires a value"
                    exit 2
                fi
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --user)
                if [ -n "$2" ]; then
                    SSH_USER="$2"
                    shift 2
                else
                    print_error "--user requires a value"
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

check_local_prerequisites() {
    print_info "Checking local prerequisites..."

    # Check SSH
    if ! command -v ssh >/dev/null 2>&1; then
        print_error "SSH is not installed or not in PATH"
        exit 2
    fi

    print_success "SSH available"

    # Check SSH key file
    if [ ! -f "$SSH_KEY" ]; then
        print_error "SSH key file not found: $SSH_KEY"
        exit 2
    fi

    print_success "SSH key file exists"

    # Check git
    if ! command -v git >/dev/null 2>&1; then
        print_error "Git is not installed or not in PATH"
        exit 2
    fi

    print_success "Git available"

    # Check EC2 IP
    if [ -z "$EC2_IP" ]; then
        print_error "EC2 IP address is required (--ip)"
        exit 2
    fi

    print_success "EC2 IP: $EC2_IP"
}

test_ssh_connection() {
    print_info "Testing SSH connection..."

    if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$EC2_IP" "echo 'SSH connection successful'" >/dev/null 2>&1; then
        print_success "SSH connection established"
    else
        print_error "Cannot connect to EC2 instance via SSH"
        echo "  - Verify EC2 IP address"
        echo "  - Verify SSH key file path"
        echo "  - Verify SSH username ($SSH_USER)"
        echo "  - Check AWS Security Group allows SSH (port 22) from your IP"
        exit 1
    fi
}

check_remote_prerequisites() {
    print_info "Checking remote prerequisites..."

    # Check Docker
    if ! run_ssh "docker --version" "Check Docker installation" >/dev/null 2>&1; then
        print_error "Docker is not installed on EC2 instance"
        echo "  Run: ./scripts/setup-ec2.sh --ip $EC2_IP --key $SSH_KEY"
        exit 1
    fi

    # Check Docker Compose
    if ! run_ssh "docker-compose --version" "Check Docker Compose installation" >/dev/null 2>&1; then
        print_error "Docker Compose is not installed on EC2 instance"
        echo "  Run: ./scripts/setup-ec2.sh --ip $EC2_IP --key $SSH_KEY"
        exit 1
    fi

    # Check repository directory
    if ! run_ssh "test -d ~/smc-unlisted-stox" "Check repository directory" >/dev/null 2>&1; then
        print_error "Repository directory not found on EC2"
        echo "  Clone the repository first:"
        echo "  ssh -i $SSH_KEY $SSH_USER@$EC2_IP"
        echo "  cd ~ && git clone <repository-url> smc-unlisted-stox"
        exit 1
    fi

    # Check .env.staging file
    if ! run_ssh "test -f ~/smc-unlisted-stox/.env.staging" "Check .env.staging file" >/dev/null 2>&1; then
        print_error ".env.staging file not found on EC2"
        echo "  Copy the environment file:"
        echo "  scp -i $SSH_KEY .env.staging $SSH_USER@$EC2_IP:~/smc-unlisted-stox/"
        exit 1
    fi

    print_success "Remote prerequisites verified"
}

pull_latest_code() {
    print_info "Pulling latest code from branch: $GIT_BRANCH"

    run_ssh "cd ~/smc-unlisted-stox && git fetch origin" "Fetch latest changes"
    run_ssh "cd ~/smc-unlisted-stox && git checkout $GIT_BRANCH" "Checkout branch"
    run_ssh "cd ~/smc-unlisted-stox && git pull origin $GIT_BRANCH" "Pull latest code"

    # Get commit info
    local commit_info
    commit_info=$(run_ssh "cd ~/smc-unlisted-stox && git log -1 --oneline" "Get commit info" 2>/dev/null || echo "unknown")
    print_success "Code updated: $commit_info"
}

stop_services() {
    print_info "Stopping running services..."

    # Graceful stop with timeout
    run_ssh "cd ~/smc-unlisted-stox && docker-compose -f docker-compose.staging.yml down --timeout 30" "Stop services"

    # Check if services stopped
    local running_containers
    running_containers=$(run_ssh "cd ~/smc-unlisted-stox && docker ps --filter 'name=smc-' --format 'table {{.Names}}' | wc -l" "Check running containers" 2>/dev/null || echo "0")

    if [ "$running_containers" -gt 1 ]; then  # wc -l includes header
        print_warning "Some containers may still be running"
    else
        print_success "All services stopped"
    fi
}

build_images() {
    if [ "$SKIP_BUILD" = "true" ]; then
        print_info "Skipping image build (--skip-build flag set)"
        return 0
    fi

    print_info "Building Docker images..."

    # Build images
    if run_ssh "cd ~/smc-unlisted-stox && docker-compose -f docker-compose.staging.yml build" "Build images"; then
        print_success "Images built successfully"
    else
        print_error "Image build failed"
        return 1
    fi
}

start_services() {
    print_info "Starting services..."

    run_ssh "cd ~/smc-unlisted-stox && docker-compose -f docker-compose.staging.yml up -d" "Start services"

    # Wait for services to start
    print_info "Waiting for services to start..."
    sleep 10

    # Check running containers
    local containers
    containers=$(run_ssh "cd ~/smc-unlisted-stox && docker-compose -f docker-compose.staging.yml ps --services --filter 'status=running'" "Check running services")

    if [ -n "$containers" ]; then
        print_success "Services started:"
        echo "$containers" | while read -r service; do
            echo "  - $service"
        done
    else
        print_error "No services are running"
        return 1
    fi
}

verify_deployment() {
    print_info "Verifying deployment..."

    # Check all containers are running
    local running_count
    running_count=$(run_ssh "cd ~/smc-unlisted-stox && docker ps --filter 'name=smc-' --filter 'status=running' --format '{{.Names}}' | wc -l" "Count running containers")

    if [ "$running_count" -lt 4 ]; then  # nginx + 3 services
        print_error "Expected 4 running containers, found $running_count"
        run_ssh "cd ~/smc-unlisted-stox && docker-compose -f docker-compose.staging.yml ps" "Show container status" >&2
        return 1
    fi

    print_success "$running_count containers running" >&2

    # Test health endpoints
    print_info "Testing health endpoints..."

    # Auth service
    if run_ssh "curl -f http://localhost:3002/api/health" "Test auth service health" >/dev/null 2>&1; then
        print_success "Auth service health: OK"
    else
        print_error "Auth service health check failed"
    fi

    # Stocks service
    if run_ssh "curl -f http://localhost:3003/api/health" "Test stocks service health" >/dev/null 2>&1; then
        print_success "Stocks service health: OK"
    else
        print_error "Stocks service health check failed"
    fi

    # Ticketing service
    if run_ssh "curl -f http://localhost:3001/api/health" "Test ticketing service health" >/dev/null 2>&1; then
        print_success "Ticketing service health: OK"
    else
        print_error "Ticketing service health check failed"
    fi

    # Nginx
    if run_ssh "curl -f http://localhost:80/health" "Test nginx health" >/dev/null 2>&1; then
        print_success "Nginx health: OK"
    else
        print_error "Nginx health check failed"
    fi

    print_success "Deployment verification completed"
}

cleanup_old_images() {
    print_info "Cleaning up old images..."

    local space_saved
    space_saved=$(run_ssh "cd ~/smc-unlisted-stox && docker image prune -f" "Prune dangling images" 2>&1 | grep -o "[0-9.]*GB\|[0-9.]*MB" || echo "0B")

    if [ "$space_saved" != "0B" ]; then
        print_success "Cleaned up $space_saved of disk space"
    else
        print_success "No cleanup needed"
    fi
}

main() {
    print_header
    echo "Deployment started at: $(date)"
    echo "Target: $SSH_USER@$EC2_IP"
    echo "Branch: $GIT_BRANCH"
    echo "Log file: $DEPLOY_LOG"
    if [ "$SKIP_BUILD" = "true" ]; then
        echo "Mode: Restart only (skip build)"
    else
        echo "Mode: Full deployment"
    fi
    echo

    parse_arguments "$@"
    check_local_prerequisites
    echo

    test_ssh_connection
    echo

    check_remote_prerequisites
    echo

    pull_latest_code
    echo

    stop_services
    echo

    build_images
    echo

    start_services
    echo

    verify_deployment
    echo

    cleanup_old_images
    echo

    print_success "Deployment completed successfully!"
    echo
    echo "Service URLs:"
    echo "  Auth API:     http://$EC2_IP/api/auth"
    echo "  Stocks API:   http://$EC2_IP/api/stocks"
    echo "  Ticketing API: http://$EC2_IP/api/tickets"
    echo "  Health Check: http://$EC2_IP/health"
    echo
    echo "To view logs:"
    echo "  ssh -i $SSH_KEY $SSH_USER@$EC2_IP"
    echo "  cd ~/smc-unlisted-stox"
    echo "  docker-compose -f docker-compose.staging.yml logs -f [service-name]"
    echo
    echo "Deployment log saved to: $DEPLOY_LOG"
}

# Run main function with all arguments
main "$@"
