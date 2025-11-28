#!/bin/bash
#
# SSH Hardening Script
# ====================
# Hardens SSH configuration for production servers.
#
# Usage: sudo ./setup-ssh.sh
#
# Changes:
#   - Disable root login
#   - Disable password authentication
#   - Only allow key-based authentication
#   - Set secure defaults
#
# WARNING: Ensure you have SSH key access before running this script!
#
# This script is idempotent - safe to run multiple times.
#

set -euo pipefail

LOG_PREFIX="[setup-ssh]"
SSHD_CONFIG="/etc/ssh/sshd_config"
SSHD_CONFIG_BACKUP="/etc/ssh/sshd_config.backup.$(date +%Y%m%d%H%M%S)"

log() { echo "${LOG_PREFIX} $*"; }
warn() { echo "${LOG_PREFIX} WARNING: $*"; }
error() { echo "${LOG_PREFIX} ERROR: $*" >&2; }

backup_config() {
    if [[ -f "$SSHD_CONFIG" ]]; then
        cp "$SSHD_CONFIG" "$SSHD_CONFIG_BACKUP"
        log "Backed up sshd_config to $SSHD_CONFIG_BACKUP"
    fi
}

# Update or add a configuration option
set_sshd_option() {
    local option="$1"
    local value="$2"

    if grep -q "^${option}" "$SSHD_CONFIG"; then
        # Option exists, update it
        sed -i "s/^${option}.*/${option} ${value}/" "$SSHD_CONFIG"
    elif grep -q "^#${option}" "$SSHD_CONFIG"; then
        # Option is commented out, uncomment and update
        sed -i "s/^#${option}.*/${option} ${value}/" "$SSHD_CONFIG"
    else
        # Option doesn't exist, add it
        echo "${option} ${value}" >> "$SSHD_CONFIG"
    fi

    log "Set ${option} = ${value}"
}

configure_ssh() {
    log "Configuring SSH..."

    # Disable root login
    set_sshd_option "PermitRootLogin" "no"

    # Disable password authentication
    set_sshd_option "PasswordAuthentication" "no"

    # Disable empty passwords
    set_sshd_option "PermitEmptyPasswords" "no"

    # Enable public key authentication
    set_sshd_option "PubkeyAuthentication" "yes"

    # Disable challenge-response authentication
    set_sshd_option "ChallengeResponseAuthentication" "no"

    # Disable PAM (since we're using key-only auth)
    # Note: Keep PAM enabled if you need it for other purposes
    # set_sshd_option "UsePAM" "no"

    # Set max authentication attempts
    set_sshd_option "MaxAuthTries" "3"

    # Set login grace time
    set_sshd_option "LoginGraceTime" "60"

    # Disable X11 forwarding (not needed for servers)
    set_sshd_option "X11Forwarding" "no"

    # Disable TCP forwarding (uncomment if not needed)
    # set_sshd_option "AllowTcpForwarding" "no"

    # Use strong ciphers and MACs
    set_sshd_option "Ciphers" "chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr"
    set_sshd_option "MACs" "hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,hmac-sha2-512,hmac-sha2-256"

    # Set client alive interval (disconnect inactive sessions)
    set_sshd_option "ClientAliveInterval" "300"
    set_sshd_option "ClientAliveCountMax" "2"

    log "SSH configuration updated"
}

validate_config() {
    log "Validating SSH configuration..."

    if sshd -t; then
        log "SSH configuration is valid ✓"
        return 0
    else
        error "SSH configuration is invalid!"
        error "Restoring backup..."
        cp "$SSHD_CONFIG_BACKUP" "$SSHD_CONFIG"
        return 1
    fi
}

restart_ssh() {
    log "Restarting SSH service..."
    systemctl restart sshd
    log "SSH service restarted"
}

show_warning() {
    warn "============================================"
    warn "  SSH has been hardened!"
    warn "============================================"
    warn ""
    warn "IMPORTANT: Before closing this session:"
    warn "  1. Ensure your SSH public key is in ~/.ssh/authorized_keys"
    warn "  2. Test SSH access from another terminal"
    warn ""
    warn "If you get locked out, you'll need console access."
    warn "============================================"
}

main() {
    log "Starting SSH hardening..."

    backup_config
    configure_ssh

    if validate_config; then
        restart_ssh
        show_warning
        log "SSH hardening complete!"
    else
        error "SSH hardening failed! Original config restored."
        exit 1
    fi
}

main "$@"
