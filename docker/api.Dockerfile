# API Dockerfile — NestJS
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# ─────────────────────────────
# Development stage
# ─────────────────────────────
FROM base AS development
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN npm ci
COPY . .
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

# ─────────────────────────────
# Build stage
# ─────────────────────────────
FROM base AS builder
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN npm ci
COPY . .
RUN npm run build --workspace=apps/api

# ─────────────────────────────
# Production stage
# ─────────────────────────────
FROM base AS production
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main.js"]
