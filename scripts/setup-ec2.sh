#!/bin/bash
#
# Script Name: setup-ec2.sh
# Description: Set up EC2 instance for SMC Unlisted Stox staging deployment
# Author: SMC DevOps Team
# Created: 2026-01-19
# Last Modified: 2026-01-19
#
# Usage:
#   ./scripts/setup-ec2.sh [OPTIONS]
#
# Options:
#   --ip <ip>           EC2 public IP address (required)
#   --key <path>        Path to SSH private key file (required)
#   --user <username>   SSH username (default: ec2-user)
#   --dry-run           Show commands without executing
#   --help              Show this help message
#
# Examples:
#   ./scripts/setup-ec2.sh --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem
#   ./scripts/setup-ec2.sh --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem --user ubuntu
#
# Prerequisites:
#   - SSH access to EC2 instance
#   - SSH private key file
#   - EC2 instance with internet access
#
# Exit Codes:
#   0 - Success
#   1 - Setup failed
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
DRY_RUN=false
SETUP_LOG="/tmp/ec2-setup-$(date +%Y%m%d-%H%M%S).log"

# Helper functions
print_header() {
    echo -e "${BLUE}🔵 SMC Unlisted Stox - EC2 Setup${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}🔵 $1${NC}"
}

show_help() {
    cat << EOF
SMC Unlisted Stox - EC2 Setup

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
    $0 --ip 54.123.45.67 --key ~/.ssh/my-ec2-key.pem --user ubuntu

PREREQUISITES:
    - SSH access to EC2 instance
    - SSH private key file exists
    - EC2 instance has internet access

EOF
}

log_command() {
    local cmd="$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $cmd" >> "$SETUP_LOG"
}

run_ssh() {
    local cmd="$1"
    local description="$2"

    if [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: ssh -i \"$SSH_KEY\" -o StrictHostKeyChecking=no \"$SSH_USER@$EC2_IP\" \"$cmd\""
        return 0
    fi

    print_info "Running: $description"
    log_command "SSH: $cmd"

    if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$EC2_IP" "$cmd"; then
        print_success "$description completed"
        return 0
    else
        print_error "$description failed"
        return 1
    fi
}

detect_os() {
    print_info "Detecting OS..."

    local os_info
    os_info=$(run_ssh "cat /etc/os-release" "Detect OS" 2>/dev/null || echo "")

    if echo "$os_info" | grep -qi "amazon linux"; then
        echo "amazon"
    elif echo "$os_info" | grep -qi "ubuntu"; then
        echo "ubuntu"
    else
        echo "unknown"
    fi
}

install_docker() {
    local os_type
    os_type=$(detect_os)

    print_info "Installing Docker on $os_type..."

    case "$os_type" in
        amazon)
            run_ssh "sudo yum update -y" "Update package manager"
            run_ssh "sudo yum install docker -y" "Install Docker"
            ;;
        ubuntu)
            run_ssh "sudo apt-get update" "Update package manager"
            run_ssh "sudo apt-get install -y docker.io" "Install Docker"
            ;;
        *)
            print_warning "Unknown OS, attempting Amazon Linux commands..."
            run_ssh "sudo yum update -y" "Update package manager"
            run_ssh "sudo yum install docker -y" "Install Docker"
            ;;
    esac

    run_ssh "sudo systemctl start docker" "Start Docker service"
    run_ssh "sudo systemctl enable docker" "Enable Docker on boot"
    run_ssh "sudo usermod -aG docker $SSH_USER" "Add user to docker group"

    # Verify installation
    local docker_version
    docker_version=$(run_ssh "docker --version" "Check Docker version" 2>&1 || echo "failed")
    if echo "$docker_version" | grep -q "Docker version"; then
        print_success "Docker installed: $docker_version"
    else
        print_error "Docker installation verification failed"
        return 1
    fi
}

install_docker_compose() {
    print_info "Installing Docker Compose..."

    run_ssh "sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose" "Download Docker Compose"
    run_ssh "sudo chmod +x /usr/local/bin/docker-compose" "Make Docker Compose executable"

    # Verify installation
    local compose_version
    compose_version=$(run_ssh "docker-compose --version" "Check Docker Compose version" 2>&1 || echo "failed")
    if echo "$compose_version" | grep -q "docker-compose version"; then
        print_success "Docker Compose installed: $compose_version"
    else
        print_error "Docker Compose installation verification failed"
        return 1
    fi
}

install_git() {
    local os_type
    os_type=$(detect_os)

    print_info "Installing Git..."

    case "$os_type" in
        amazon)
            run_ssh "sudo yum install git -y" "Install Git"
            ;;
        ubuntu)
            run_ssh "sudo apt-get install -y git" "Install Git"
            ;;
        *)
            run_ssh "sudo yum install git -y" "Install Git (trying Amazon Linux)"
            ;;
    esac

    # Verify installation
    local git_version
    git_version=$(run_ssh "git --version" "Check Git version" 2>&1 || echo "failed")
    if echo "$git_version" | grep -q "git version"; then
        print_success "Git installed: $git_version"
    else
        print_error "Git installation verification failed"
        return 1
    fi
}

configure_firewall() {
    print_info "Configuring firewall..."

    # Try firewalld (Amazon Linux)
    if run_ssh "sudo firewall-cmd --state" "Check firewalld status" 2>/dev/null; then
        run_ssh "sudo firewall-cmd --permanent --add-port=80/tcp" "Open port 80"
        run_ssh "sudo firewall-cmd --reload" "Reload firewall"
        print_success "Firewall configured (firewalld)"
    else
        print_warning "firewalld not found, skipping firewall configuration"
        print_info "Remember to configure AWS Security Group to allow:"
        print_info "  - SSH (port 22) from your IP"
        print_info "  - HTTP (port 80) from anywhere"
    fi
}

setup_application_directory() {
    print_info "Setting up application directory..."

    run_ssh "mkdir -p ~/smc-unlisted-stox" "Create application directory"
    run_ssh "mkdir -p ~/smc-unlisted-stox/logs/nginx" "Create logs directory"
    run_ssh "ls -la ~/smc-unlisted-stox" "Verify directory structure"
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
            --user)
                if [ -n "$2" ]; then
                    SSH_USER="$2"
                    shift 2
                else
                    print_error "--user requires a value"
                    exit 2
                fi
                ;;
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

    # Check EC2 IP
    if [ -z "$EC2_IP" ]; then
        print_error "EC2 IP address is required (--ip)"
        exit 2
    fi

    print_success "EC2 IP: $EC2_IP"
}

test_ssh_connection() {
    print_info "Testing SSH connection..."

    if [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: Testing SSH connection to $SSH_USER@$EC2_IP"
        return 0
    fi

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

main() {
    print_header
    echo "Setup started at: $(date)"
    echo "Log file: $SETUP_LOG"
    echo

    parse_arguments "$@"

    if [ "$DRY_RUN" = "true" ]; then
        print_warning "DRY RUN MODE - Commands will be shown but not executed"
        echo
    fi

    check_local_prerequisites
    echo

    test_ssh_connection
    echo

    install_docker
    echo

    install_docker_compose
    echo

    install_git
    echo

    configure_firewall
    echo

    setup_application_directory
    echo

    if [ "$DRY_RUN" = "true" ]; then
        print_success "Dry run completed - review commands above"
        exit 0
    fi

    print_success "EC2 setup completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Clone the repository on EC2:"
    echo "   ssh -i $SSH_KEY $SSH_USER@$EC2_IP"
    echo "   cd ~/smc-unlisted-stox"
    echo "   git clone <repository-url> ."
    echo
    echo "2. Copy .env.staging file to EC2:"
    echo "   scp -i $SSH_KEY .env.staging $SSH_USER@$EC2_IP:~/smc-unlisted-stox/"
    echo
    echo "3. Run database migrations:"
    echo "   ./scripts/migrate-staging.sh"
    echo
    echo "4. Deploy the application:"
    echo "   ./scripts/deploy-to-ec2.sh --ip $EC2_IP --key $SSH_KEY"
    echo
    echo "Setup log saved to: $SETUP_LOG"
}

# Run main function with all arguments
main "$@"