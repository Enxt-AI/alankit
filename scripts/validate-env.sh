#!/bin/bash

# Environment Validation Script for SMC Unlisted Stox Staging
# This script validates that all required environment variables are set in .env.staging
# Run this before deployment to catch configuration issues early

set -e

ENV_FILE=".env.staging"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "[VALIDATE] Validating environment configuration..."
echo "[INFO] Looking for: $REPO_ROOT/$ENV_FILE"

# Check if .env.staging exists
if [ ! -f "$REPO_ROOT/$ENV_FILE" ]; then
    echo "[ERROR] Error: $ENV_FILE not found in repository root"
    echo "[TIP] Copy .env.staging.example to .env.staging and fill in your values"
    exit 1
fi

echo "[SUCCESS] Found $ENV_FILE"

# Required variables to check
REQUIRED_VARS=(
    "NODE_ENV"
    "JWT_SECRET"
    "COOKIE_SECRET"
    "COOKIE_ENCRYPTION_KEY"
    "DATABASE_URL"
    "ADMIN_DATABASE_URL"
    "TICKETING_DATABASE_URL"
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "EMAIL_PROVIDER"
    "SENDGRID_API_KEY"
    "FRONTEND_URL"
)

# Optional but recommended variables
OPTIONAL_VARS=(
    "REDIS_URL"
    "REDIS_HOST"
    "REDIS_PORT"
    "REDIS_PASSWORD"
    "REDIS_TLS"
    "EMAIL_MOCK_MODE"
    "RAZORPAY_KEY_ID"
    "RAZORPAY_KEY_SECRET"
    "SLA_URGENT_HOURS"
    "SLA_HIGH_HOURS"
    "SLA_MEDIUM_HOURS"
    "SLA_LOW_HOURS"
    "TICKET_ASSIGNMENT_STRATEGY"
)

# Redis configuration: require either REDIS_URL (preferred) or (REDIS_HOST + REDIS_PASSWORD).
echo ""
echo "[VALIDATE] Checking Redis configuration..."

set -a
source "$REPO_ROOT/$ENV_FILE"
set +a

if [ -n "${REDIS_URL:-}" ]; then
    echo "[SUCCESS] REDIS_URL (set)"
    if [[ ! "${REDIS_URL}" =~ ^rediss?:// ]]; then
        INVALID_VALUES+=("REDIS_URL: Must start with redis:// or rediss://")
    fi
elif [ -n "${REDIS_HOST:-}" ] && [ -n "${REDIS_PASSWORD:-}" ]; then
    echo "[SUCCESS] REDIS_HOST + REDIS_PASSWORD (set)"
    if [[ ! "${REDIS_HOST}" =~ \.upstash\.io$ ]]; then
        INVALID_VALUES+=("REDIS_HOST: Should end with .upstash.io")
    fi
else
    MISSING_REQUIRED+=("REDIS_URL (or REDIS_HOST+REDIS_PASSWORD)")
    echo "[ERROR] REDIS_URL (or REDIS_HOST+REDIS_PASSWORD) (missing)"
fi

MISSING_REQUIRED=()
INVALID_VALUES=()
PLACEHOLDER_VALUES=()

# Function to check if variable is set
check_var() {
    local var_name="$1"
    local var_value=""

    # Source the env file to get variable values
    set -a
    source "$REPO_ROOT/$ENV_FILE"
    set +a

    eval "var_value=\$$var_name"

    if [ -z "$var_value" ]; then
        MISSING_REQUIRED+=("$var_name")
        return 1
    fi

    # Check for placeholder values
    if [[ "$var_value" =~ ^(your-|CHANGE_ME|placeholder|example) ]]; then
        PLACEHOLDER_VALUES+=("$var_name")
    fi

    # Validate specific formats
    case "$var_name" in
        "DATABASE_URL")
            if [[ ! "$var_value" =~ ^postgresql:// ]]; then
                INVALID_VALUES+=("$var_name: Must start with postgresql://")
            fi
            ;;
        "REDIS_HOST")
            if [ -n "$var_value" ] && [[ ! "$var_value" =~ \.upstash\.io$ ]]; then
                INVALID_VALUES+=("$var_name: Should end with .upstash.io")
            fi
            ;;
        "GOOGLE_CLIENT_ID")
            if [[ ! "$var_value" =~ \.apps\.googleusercontent\.com$ ]]; then
                INVALID_VALUES+=("$var_name: Should end with .apps.googleusercontent.com")
            fi
            ;;
        "JWT_SECRET")
            if [ ${#var_value} -lt 32 ]; then
                INVALID_VALUES+=("$var_name: Should be at least 32 characters")
            fi
            ;;
        "COOKIE_SECRET")
            if [ ${#var_value} -lt 16 ]; then
                INVALID_VALUES+=("$var_name: Should be at least 16 characters")
            fi
            ;;
        "COOKIE_ENCRYPTION_KEY")
            if [ ${#var_value} -ne 64 ]; then
                INVALID_VALUES+=("$var_name: Must be exactly 64 hex characters (32 bytes for AES-256)")
            elif [[ ! "$var_value" =~ ^[0-9a-fA-F]+$ ]]; then
                INVALID_VALUES+=("$var_name: Must contain only hexadecimal characters (0-9, a-f, A-F)")
            fi
            ;;
    esac
}

# Check required variables
echo ""
echo "[VALIDATE] Checking required variables..."
for var in "${REQUIRED_VARS[@]}"; do
    if check_var "$var"; then
        echo "[SUCCESS] $var"
    else
        echo "[ERROR] $var (missing)"
    fi
done

# Check optional variables
echo ""
echo "[VALIDATE] Checking optional variables..."
for var in "${OPTIONAL_VARS[@]}"; do
    if check_var "$var" 2>/dev/null; then
        echo "[SUCCESS] $var (set)"
    else
        echo "[WARNING] $var (not set)"
    fi
done

# Report issues
echo ""
echo "[RESULTS] Validation Results:"

if [ ${#MISSING_REQUIRED[@]} -gt 0 ]; then
    echo ""
    echo "[ERROR] Missing required variables:"
    for var in "${MISSING_REQUIRED[@]}"; do
        echo "   - $var"
    done
fi

if [ ${#INVALID_VALUES[@]} -gt 0 ]; then
    echo ""
    echo "[ERROR] Invalid variable values:"
    for issue in "${INVALID_VALUES[@]}"; do
        echo "   - $issue"
    done
fi

if [ ${#PLACEHOLDER_VALUES[@]} -gt 0 ]; then
    echo ""
    echo "[WARNING] Placeholder values detected (need to be replaced):"
    for var in "${PLACEHOLDER_VALUES[@]}"; do
        echo "   - $var"
    done
fi

# Final status
if [ ${#MISSING_REQUIRED[@]} -eq 0 ] && [ ${#INVALID_VALUES[@]} -eq 0 ] && [ ${#PLACEHOLDER_VALUES[@]} -eq 0 ]; then
    echo ""
    echo "[SUCCESS] Environment validation passed!"
    echo "[READY] Ready for deployment"
    exit 0
else
    echo ""
    echo "[ERROR] Environment validation failed!"
    echo "[TIP] Fix the issues above before deploying"
    echo "[DOCS] See docs/ENVIRONMENT_SETUP.md for help"
    exit 1
fi