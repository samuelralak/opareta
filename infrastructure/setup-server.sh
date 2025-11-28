#!/bin/bash
#
# Opareta Server Setup Script
# ============================
# Interactive script to set up a new server for Opareta deployment.
#
# This script will:
#   1. Prompt for server IP and configuration
#   2. Generate JWT keys if needed
#   3. Copy infrastructure files to the server
#   4. Run provisioning scripts
#   5. Configure environment variables
#   6. Start the services
#
# Usage:
#   ./setup-server.sh
#   ./setup-server.sh --ip 123.45.67.89
#
# Requirements:
#   - SSH access to the target server (key-based)
#   - Local: openssl, ssh, scp, rsync
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Configuration
REMOTE_USER="root"
REMOTE_PATH="/opt/opareta"
SSH_OPTIONS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

log() { echo -e "${GREEN}[setup]${NC} $*"; }
info() { echo -e "${BLUE}[info]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }
header() { echo -e "\n${BOLD}${CYAN}=== $* ===${NC}\n"; }

# Prompt for input with default value
prompt() {
    local message="$1"
    local default="${2:-}"
    local var_name="$3"
    local is_secret="${4:-false}"

    if [[ -n "$default" ]]; then
        message="${message} [${default}]"
    fi

    if [[ "$is_secret" == "true" ]]; then
        read -s -p "$message: " value
        echo ""
    else
        read -p "$message: " value
    fi

    value="${value:-$default}"
    eval "$var_name='$value'"
}

# Prompt for yes/no
confirm() {
    local message="$1"
    local default="${2:-y}"

    read -p "$message [${default}]: " response
    response="${response:-$default}"
    [[ "$response" =~ ^[Yy] ]]
}

# Check if command exists
check_command() {
    if ! command -v "$1" &>/dev/null; then
        error "Required command not found: $1"
        exit 1
    fi
}

# Test SSH connection
test_ssh() {
    local host="$1"
    log "Testing SSH connection to ${host}..."

    if ssh $SSH_OPTIONS "${REMOTE_USER}@${host}" "echo 'SSH connection successful'" &>/dev/null; then
        log "SSH connection successful ✓"
        return 0
    else
        error "Cannot connect to ${host} via SSH"
        error "Make sure:"
        error "  1. The server is running"
        error "  2. Your SSH key is added to the server"
        error "  3. Port 22 is open"
        return 1
    fi
}

# Generate JWT keys
generate_jwt_keys() {
    local key_dir="$1"

    log "Generating JWT RSA key pair..."

    mkdir -p "$key_dir"

    openssl genpkey -algorithm RSA \
        -out "${key_dir}/jwt-private.pem" \
        -pkeyopt rsa_keygen_bits:2048 2>/dev/null

    openssl rsa -pubout \
        -in "${key_dir}/jwt-private.pem" \
        -out "${key_dir}/jwt-public.pem" 2>/dev/null

    # Convert to single-line format
    JWT_PRIVATE_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "${key_dir}/jwt-private.pem")
    JWT_PUBLIC_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "${key_dir}/jwt-public.pem")

    log "JWT keys generated ✓"
}

# Generate random password
generate_password() {
    openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24
}

# Copy files to server
copy_files() {
    local host="$1"

    log "Copying infrastructure files to server..."

    # Create remote directory
    ssh $SSH_OPTIONS "${REMOTE_USER}@${host}" "mkdir -p ${REMOTE_PATH}"

    # Copy infrastructure directory
    rsync -avz --progress \
        -e "ssh $SSH_OPTIONS" \
        --exclude '.env' \
        --exclude '*.pem' \
        --exclude '.git' \
        "${SCRIPT_DIR}/" \
        "${REMOTE_USER}@${host}:${REMOTE_PATH}/infrastructure/"

    # Copy Dockerfile and docker-compose files from project root
    scp $SSH_OPTIONS \
        "${PROJECT_ROOT}/Dockerfile" \
        "${REMOTE_USER}@${host}:${REMOTE_PATH}/" 2>/dev/null || true

    log "Files copied ✓"
}

# Create .env file on server
create_env_file() {
    local host="$1"

    log "Creating .env file on server..."

    ssh $SSH_OPTIONS "${REMOTE_USER}@${host}" "cat > ${REMOTE_PATH}/infrastructure/.env" <<EOF
# Opareta Production Environment
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Docker Registry (GitHub Container Registry)
DOCKER_REGISTRY=${DOCKER_REGISTRY}
IMAGE_TAG=${IMAGE_TAG}

# GitHub Container Registry Token (for pulling images)
GHCR_TOKEN=${GHCR_TOKEN}

# Argus Database
ARGUS_DB_HOST=postgres-argus
ARGUS_DB_PORT=5432
ARGUS_DB_USER=argus
ARGUS_DB_PASSWORD=${ARGUS_DB_PASSWORD}
ARGUS_DB_NAME=argus_db

# Hermes Database
HERMES_DB_HOST=postgres-hermes
HERMES_DB_PORT=5432
HERMES_DB_USER=hermes
HERMES_DB_PASSWORD=${HERMES_DB_PASSWORD}
HERMES_DB_NAME=hermes_db

# JWT Configuration
JWT_EXPIRATION_SECONDS=7200
JWT_PRIVATE_KEY="${JWT_PRIVATE_KEY}"
JWT_PUBLIC_KEY="${JWT_PUBLIC_KEY}"

# Monitoring
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
GRAFANA_ROOT_URL=http://${SERVER_IP}:3100

# Backup
BACKUP_DIR=/var/backups/opareta
BACKUP_RETENTION_DAYS=7

# Deployment
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=2
EOF

    log ".env file created ✓"
}

# Run provisioning on server
run_provisioning() {
    local host="$1"

    log "Running server provisioning..."

    ssh $SSH_OPTIONS "${REMOTE_USER}@${host}" bash <<'EOF'
set -e
cd /opt/opareta/infrastructure/scripts
chmod +x *.sh

echo "Running provision.sh..."
./provision.sh
EOF

    log "Server provisioning complete ✓"
}

# Login to GHCR on server
setup_ghcr_auth() {
    local host="$1"

    log "Setting up GitHub Container Registry authentication..."

    ssh $SSH_OPTIONS "${REMOTE_USER}@${host}" bash <<EOF
set -e
echo "${GHCR_TOKEN}" | docker login ghcr.io -u ${GITHUB_USERNAME} --password-stdin
EOF

    log "GHCR authentication configured ✓"
}

# Start services
start_services() {
    local host="$1"

    log "Starting Opareta services..."

    ssh $SSH_OPTIONS "${REMOTE_USER}@${host}" bash <<'EOF'
set -e
cd /opt/opareta/infrastructure

# Source environment
set -a
source .env
set +a

# Pull images
docker compose -f docker/docker-compose.prod.yml pull

# Start services
docker compose -f docker/docker-compose.prod.yml up -d

# Wait for services to start
echo "Waiting for services to initialize..."
sleep 30

# Show status
docker compose -f docker/docker-compose.prod.yml ps
EOF

    log "Services started ✓"
}

# Setup Nginx
setup_nginx() {
    local host="$1"

    log "Setting up Nginx..."

    ssh $SSH_OPTIONS "${REMOTE_USER}@${host}" bash <<'EOF'
set -e

# Install Nginx if not present
if ! command -v nginx &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq nginx
fi

# Create SSL directory and generate self-signed cert
mkdir -p /etc/nginx/ssl
if [[ ! -f /etc/nginx/ssl/opareta.crt ]]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/opareta.key \
        -out /etc/nginx/ssl/opareta.crt \
        -subj "/C=US/ST=State/L=City/O=Opareta/CN=opareta.local"
fi

# Copy nginx config
cp /opt/opareta/infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
cp /opt/opareta/infrastructure/nginx/sites/opareta.conf /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/opareta.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl enable nginx
systemctl reload nginx
EOF

    log "Nginx configured ✓"
}

# Setup backup cron
setup_backups() {
    local host="$1"

    log "Setting up backup cron job..."

    ssh $SSH_OPTIONS "${REMOTE_USER}@${host}" bash <<'EOF'
set -e
mkdir -p /var/backups/opareta
cp /opt/opareta/infrastructure/backup/backup.cron /etc/cron.d/opareta-backup
chmod 644 /etc/cron.d/opareta-backup

# Update path in cron file
sed -i 's|/opt/opareta/infrastructure|/opt/opareta/infrastructure|g' /etc/cron.d/opareta-backup
EOF

    log "Backup cron configured ✓"
}

# Print summary
print_summary() {
    local host="$1"

    header "Setup Complete!"

    echo -e "${GREEN}Your Opareta instance is now running!${NC}\n"

    echo "Access Points:"
    echo "  • API (HTTPS):     https://${host}"
    echo "  • API (HTTP):      http://${host}"
    echo "  • Grafana:         http://${host}:3100"
    echo "  • Prometheus:      http://${host}:9090"
    echo ""
    echo "Credentials:"
    echo "  • Grafana User:    admin"
    echo "  • Grafana Pass:    ${GRAFANA_ADMIN_PASSWORD}"
    echo ""
    echo "Useful Commands (on server):"
    echo "  • View logs:       docker compose -f ${REMOTE_PATH}/infrastructure/docker/docker-compose.prod.yml logs -f"
    echo "  • Service status:  docker compose -f ${REMOTE_PATH}/infrastructure/docker/docker-compose.prod.yml ps"
    echo "  • Deploy update:   ${REMOTE_PATH}/infrastructure/deploy/deploy.sh"
    echo ""
    echo "GitHub Actions:"
    echo "  • Add these secrets to your repository:"
    echo "    - SERVER_HOST: ${host}"
    echo "    - SERVER_USER: ${REMOTE_USER}"
    echo "    - SERVER_SSH_KEY: (your private SSH key)"
    echo "    - GHCR_TOKEN: ${GHCR_TOKEN:0:10}..."
    echo ""

    warn "Security Reminders:"
    echo "  1. Set up a domain name and configure Let's Encrypt SSL"
    echo "  2. Change default passwords in production"
    echo "  3. Review firewall rules: sudo ufw status"
    echo "  4. Set up monitoring alerts in Grafana"
}

# Save configuration locally
save_local_config() {
    local config_file="${SCRIPT_DIR}/.server-config"

    cat > "$config_file" <<EOF
# Opareta Server Configuration
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
SERVER_IP=${SERVER_IP}
GITHUB_USERNAME=${GITHUB_USERNAME}
GITHUB_REPO=${GITHUB_REPO}
DOCKER_REGISTRY=${DOCKER_REGISTRY}
EOF

    log "Configuration saved to ${config_file}"
}

main() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           Opareta Server Setup Wizard                     ║"
    echo "║                                                           ║"
    echo "║   This will set up a production server on DigitalOcean    ║"
    echo "║   or any Ubuntu 22.04 server with SSH access.             ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"

    # Check requirements
    header "Checking Requirements"
    check_command ssh
    check_command scp
    check_command rsync
    check_command openssl
    log "All requirements met ✓"

    # Get server information
    header "Server Configuration"

    # Check for command line args
    while [[ $# -gt 0 ]]; do
        case $1 in
            --ip)
                SERVER_IP="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    prompt "Server IP address" "${SERVER_IP:-}" SERVER_IP
    prompt "SSH user" "root" REMOTE_USER

    if ! test_ssh "$SERVER_IP"; then
        exit 1
    fi

    # GitHub configuration
    header "GitHub Container Registry Configuration"

    info "Images will be stored in GitHub Container Registry (ghcr.io)"
    echo ""

    prompt "GitHub username" "" GITHUB_USERNAME
    prompt "GitHub repository name" "opareta" GITHUB_REPO

    DOCKER_REGISTRY="ghcr.io/${GITHUB_USERNAME}/"

    echo ""
    info "To create a GitHub Personal Access Token (PAT):"
    echo "  1. Go to: https://github.com/settings/tokens"
    echo "  2. Generate new token (classic)"
    echo "  3. Select scopes: read:packages, write:packages, delete:packages"
    echo ""

    prompt "GitHub PAT (for GHCR access)" "" GHCR_TOKEN true

    # Generate or use existing JWT keys
    header "JWT Key Configuration"

    JWT_KEY_DIR="/tmp/opareta-jwt-keys-$$"

    if confirm "Generate new JWT keys?" "y"; then
        generate_jwt_keys "$JWT_KEY_DIR"
    else
        prompt "Path to JWT private key" "" JWT_PRIVATE_KEY_FILE
        prompt "Path to JWT public key" "" JWT_PUBLIC_KEY_FILE

        JWT_PRIVATE_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "$JWT_PRIVATE_KEY_FILE")
        JWT_PUBLIC_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' "$JWT_PUBLIC_KEY_FILE")
    fi

    # Generate passwords
    header "Database & Service Passwords"

    if confirm "Generate random passwords?" "y"; then
        ARGUS_DB_PASSWORD=$(generate_password)
        HERMES_DB_PASSWORD=$(generate_password)
        GRAFANA_ADMIN_PASSWORD=$(generate_password)
        log "Passwords generated ✓"
    else
        prompt "Argus DB password" "" ARGUS_DB_PASSWORD true
        prompt "Hermes DB password" "" HERMES_DB_PASSWORD true
        prompt "Grafana admin password" "" GRAFANA_ADMIN_PASSWORD true
    fi

    # Image tag
    prompt "Initial image tag" "latest" IMAGE_TAG

    # Confirmation
    header "Configuration Summary"

    echo "Server:           ${SERVER_IP}"
    echo "SSH User:         ${REMOTE_USER}"
    echo "GitHub User:      ${GITHUB_USERNAME}"
    echo "Registry:         ${DOCKER_REGISTRY}"
    echo "Image Tag:        ${IMAGE_TAG}"
    echo ""

    if ! confirm "Proceed with setup?" "y"; then
        warn "Setup cancelled"
        exit 0
    fi

    # Execute setup
    header "Setting Up Server"

    copy_files "$SERVER_IP"
    create_env_file "$SERVER_IP"
    run_provisioning "$SERVER_IP"
    setup_ghcr_auth "$SERVER_IP"
    setup_nginx "$SERVER_IP"
    setup_backups "$SERVER_IP"
    start_services "$SERVER_IP"

    # Save config and print summary
    save_local_config
    print_summary "$SERVER_IP"

    # Cleanup
    rm -rf "$JWT_KEY_DIR" 2>/dev/null || true
}

main "$@"
