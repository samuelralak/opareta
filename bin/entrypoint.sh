#!/bin/sh
set -e

KEYS_DIR="/app/keys"
PRIVATE_KEY_FILE="$KEYS_DIR/private.pem"
PUBLIC_KEY_FILE="$KEYS_DIR/public.pem"
ENV_FILE="$KEYS_DIR/.env.keys"

# Generate JWT keys if they don't exist (only for argus service)
if [ "$APP_NAME" = "argus" ]; then
    if [ ! -f "$PRIVATE_KEY_FILE" ] || [ ! -f "$PUBLIC_KEY_FILE" ]; then
        echo "Generating new RSA key pair for JWT signing..."

        # Generate private key
        openssl genrsa -out "$PRIVATE_KEY_FILE" 2048 2>/dev/null

        # Extract public key
        openssl rsa -in "$PRIVATE_KEY_FILE" -pubout -out "$PUBLIC_KEY_FILE" 2>/dev/null

        # Generate base64 encoded versions for environment variables
        PRIVATE_KEY_BASE64=$(cat "$PRIVATE_KEY_FILE" | base64 | tr -d '\n')
        PUBLIC_KEY_BASE64=$(cat "$PUBLIC_KEY_FILE" | base64 | tr -d '\n')

        # Save to env file for reference
        echo "JWT_PRIVATE_KEY=$PRIVATE_KEY_BASE64" > "$ENV_FILE"
        echo "JWT_PUBLIC_KEY=$PUBLIC_KEY_BASE64" >> "$ENV_FILE"
        echo "JWT_KEY_ID=argus-key-$(date +%s)" >> "$ENV_FILE"

        echo "JWT keys generated and saved to $KEYS_DIR"
    else
        echo "Using existing JWT keys from $KEYS_DIR"
    fi

    # Export keys as environment variables if not already set
    if [ -z "$JWT_PRIVATE_KEY" ] && [ -f "$PRIVATE_KEY_FILE" ]; then
        export JWT_PRIVATE_KEY=$(cat "$PRIVATE_KEY_FILE" | base64 | tr -d '\n')
    fi
    if [ -z "$JWT_PUBLIC_KEY" ] && [ -f "$PUBLIC_KEY_FILE" ]; then
        export JWT_PUBLIC_KEY=$(cat "$PUBLIC_KEY_FILE" | base64 | tr -d '\n')
    fi
    if [ -z "$JWT_KEY_ID" ]; then
        export JWT_KEY_ID="argus-key-1"
    fi
fi

# Execute the main command
exec "$@"
