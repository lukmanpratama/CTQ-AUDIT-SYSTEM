# Web Dockerfile — Next.js
# Same Node major as local development (Node 20 is end-of-life)
FROM node:26-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─────────────────────────────
# Development stage
# ─────────────────────────────
FROM base AS development
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN npm ci
COPY . .
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─────────────────────────────
# Build stage
# ─────────────────────────────
FROM base AS builder
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# next.config.mjs reads this inside rewrites(), which Next evaluates at build time:
# the /api proxy target is baked into the build, so it must be the API's address
# as seen from the web container, not the 127.0.0.1 default
ARG API_INTERNAL_URL=http://api:3001
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build --workspace=apps/web

# ─────────────────────────────
# Production stage
# ─────────────────────────────
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
# In a monorepo the standalone output keeps the workspace layout: server.js lands in
# standalone/apps/web/, and it serves static/ and public/ relative to that folder
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000
# Docker sets HOSTNAME to the container id; the standalone server binds to it
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
