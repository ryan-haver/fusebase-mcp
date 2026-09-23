# ==============================================================================
# 1. Builder Stage: Compile TypeScript
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and TypeScript configuration
COPY package.json package-lock.json tsconfig.json ./

# Install all dependencies including devDependencies (ignore prepare/postinstall scripts)
RUN npm ci --ignore-scripts

# Copy source code and documentation
COPY src ./src
COPY docs ./docs

# Compile TypeScript to dist/
RUN npm run build

# ==============================================================================
# 2. Production Runtime Stage: Lightweight Node.js image (~150MB)
# ==============================================================================
FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="FuseBase MCP Server" \
      org.opencontainers.image.description="Model Context Protocol (MCP) server for FuseBase workspaces, databases, and automations" \
      org.opencontainers.image.source="https://github.com/ryan-haver/fusebase-mcp" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

ENV NODE_ENV=production

# Install curl for container healthchecks
RUN apk add --no-cache curl

# Copy package manifests
COPY package.json package-lock.json ./

# Install production dependencies only (skip dev dependencies and Playwright browser binaries)
RUN npm ci --omit=dev --ignore-scripts

# Copy built distribution files and documentation from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/docs ./docs
COPY README.md AGENTS.md ENDPOINT_REFERENCE.md ./

# Create data directory for volume mounting (encrypted credentials, downloads)
RUN mkdir -p /app/data && chown -R node:node /app

# Persistent volume for credentials and downloads
VOLUME ["/app/data"]

# Default exposed port for SSE / HTTP streaming mode
EXPOSE 3000

# Switch to non-root user for container security
USER node

# Default entrypoint runs the MCP server.
# By default, runs stdio mode (pipe with docker run -i).
# Pass --transport sse --port 3000 or MCP_TRANSPORT=sse to run as a network service.
ENTRYPOINT ["node", "dist/index.js"]
