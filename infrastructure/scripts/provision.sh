#!/bin/bash
#
# Main Server Provisioning Script
# ================================
# This script orchestrates the complete server setup for Opareta.
# It calls modular setup scripts in the correct order.
#
# Usage: sudo ./provision.sh
#
# Requirements:
#   - Ubuntu 22.04 LTS
#   - Root or sudo access
#   - Internet connectivity
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/opareta-provision.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

info() { log "INFO" "${GREEN}$*${NC}"; }
warn() { log "WARN" "${YELLOW}$*${NC}"; }
error() { log "ERROR" "${RED}$*${NC}"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
        exit 1
    fi
}

check_ubuntu() {
    if ! grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
        error "This script is designed for Ubuntu. Detected OS may not be compatible."
        exit 1
    fi
    info "Ubuntu detected ✓"
}

run_script() {
    local script="$1"
    local script_path="${SCRIPT_DIR}/${script}"

    if [[ ! -f "$script_path" ]]; then
        error "Script not found: $script_path"
        return 1
    fi

    info "Running ${script}..."
    chmod +x "$script_path"
    if bash "$script_path"; then
        info "${script} completed successfully ✓"
    else
        error "${script} failed!"
        return 1
    fi
}

main() {
    info "=========================================="
    info "  Opareta Server Provisioning"
    info "=========================================="

    check_root
    check_ubuntu

    # Create log directory if needed
    mkdir -p "$(dirname "$LOG_FILE")"

    # Update system packages
    info "Updating system packages..."
    apt-get update -qq
    apt-get upgrade -y -qq

    # Run setup scripts in order
    run_script "setup-ssh.sh"
    run_script "setup-firewall.sh"
    run_script "setup-docker.sh"
    run_script "setup-monitoring-agents.sh"

    info "=========================================="
    info "  Provisioning Complete!"
    info "=========================================="
    info "Log file: $LOG_FILE"
    info ""
    info "Next steps:"
    info "  1. Copy your SSH public key to ~/.ssh/authorized_keys"
    info "  2. Configure environment variables in /opt/opareta/.env"
    info "  3. Run the deployment script: ./deploy/deploy.sh"
}

main "$@"
