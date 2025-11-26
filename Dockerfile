# Multi-stage Dockerfile for Opareta services
# Usage: docker build --build-arg APP=argus -t opareta/argus .
#        docker build --build-arg APP=hermes -t opareta/hermes .

ARG APP=argus

# =============================================================================
# Build stage
# =============================================================================
FROM node:22-alpine AS builder

ARG APP

WORKDIR /app

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Copy all package.json files first for workspace setup
COPY package.json package-lock.json ./
COPY libs/common/package.json ./libs/common/
COPY libs/dummy-provider/package.json ./libs/dummy-provider/
COPY apps/argus/package.json ./apps/argus/
COPY apps/hermes/package.json ./apps/hermes/

# Install all dependencies (npm workspaces need package.json files present)
RUN npm ci

# Copy source files for the build
COPY nx.json tsconfig.base.json eslint.config.mjs ./
COPY libs/ ./libs/
COPY apps/ ./apps/

# Clean any existing dist, tsbuildinfo, tmp, and build fresh
# NX_DAEMON=false prevents nx daemon issues in Docker
# Build all libs with NX first (creates proper package.json and structure)
# Then build the app (uses SWC compiler to avoid project reference issues)
ENV NX_DAEMON=false
RUN rm -rf dist tmp .nx && \
    rm -rf libs/common/dist libs/dummy-provider/dist apps/*/dist && \
    find . -name "*.tsbuildinfo" -delete && \
    npx nx build common --skip-nx-cache && \
    npx nx build dummy-provider --skip-nx-cache && \
    npx nx build @opareta/${APP} --skip-nx-cache

# =============================================================================
# Production stage
# =============================================================================
FROM node:22-alpine AS runner

ARG APP
ENV APP_NAME=${APP}

WORKDIR /app

# Install runtime dependencies for native modules and openssl for key generation
RUN apk add --no-cache openssl

# Copy the built application (main.js, package.json, package-lock.json, assets/)
COPY --from=builder /app/apps/${APP}/dist/ ./

# Install production dependencies
# Note: bcrypt needs to be rebuilt for the target platform
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++

# Copy built workspace libraries (@opareta/*) AFTER npm ci (to not be overwritten by npm)
# NX now outputs to libs/<lib>/dist/ to match tsconfig project references
COPY --from=builder /app/libs/common/dist/ ./node_modules/@opareta/common/
COPY --from=builder /app/libs/dummy-provider/dist/ ./node_modules/@opareta/dummy-provider/

# Copy entrypoint script with proper permissions for non-root user
COPY bin/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Create keys and logs directories with proper permissions
RUN mkdir -p /app/keys /app/logs && chown -R nestjs:nodejs /app/keys /app/logs

USER nestjs

# Default port (can be overridden)
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "main.js"]
