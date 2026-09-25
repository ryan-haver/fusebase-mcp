# ==============================================================================
# 1. Builder Stage: Compile TypeScript
# ==============================================================================
FROM node:22-alpine AS builder

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

# FuseBase guides for search_guides / get_guide (not committed; downloaded at build).
# A failed download leaves an empty folder; the guide tools then say how to fetch them.
COPY scripts/scrape-guides.ts ./scripts/scrape-guides.ts
RUN mkdir -p .cache/guides && (npx tsx scripts/scrape-guides.ts || echo "guides download failed; continuing without them")

# ==============================================================================
# 2. Production Runtime Stage: production dependencies and the compiled server only
# ==============================================================================
FROM node:22-alpine AS runtime

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
COPY --from=builder /app/.cache/guides ./.cache/guides
COPY README.md AGENTS.md ./

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
# For a network service pass MCP_TRANSPORT=http, MCP_HOST=0.0.0.0 and MCP_AUTH_TOKEN (required when
# listening on a non-loopback address). See docker-compose.yml.
ENTRYPOINT ["node", "dist/index.js"]
