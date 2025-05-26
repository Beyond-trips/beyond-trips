# ───────────── Base Stage ─────────────
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ───────────── Dependencies Stage ─────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm install

# ───────────── Build Stage ─────────────
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build
RUN npm run build

# ───────────── Production Stage ─────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm install --production

# Copy built application
COPY --from=builder /app/.next ./.next

# Create directories that might be needed
RUN mkdir -p public media

# Copy package.json for scripts
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Start the application
CMD ["npm", "start"]