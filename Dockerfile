# ───────────── Base Stage ─────────────
FROM node:18-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ───────────── Dependencies Stage ─────────────
FROM base AS deps
COPY package.json package-lock.json ./
# Use `npm install` since `npm ci` was mismatched on Render
RUN npm install

# ───────────── Build Stage ─────────────
FROM base AS builder
WORKDIR /app

# Copy installed dependencies from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build Next.js (which will also bundle Payload via @payloadcms/next)
RUN npm run build

# Debug: Check if standalone was created
RUN ls -la .next/

# ───────────── Runner (Production) Stage ─────────────
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create user first
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Try to copy standalone, but if it doesn't exist, fall back to regular build
# First, copy the entire app for non-standalone builds
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy .env files if they exist
COPY --from=builder /app/.env* ./

# If standalone exists, it will overwrite the above
# (This is a workaround since COPY --from=builder /app/.next/standalone ./ fails if it doesn't exist)
RUN if [ -d ".next/standalone" ]; then \
    cp -r .next/standalone/* . && \
    rm -rf node_modules && \
    rm -rf .next; \
  fi

# Set correct ownership
RUN chown -R nextjs:nodejs /app

# Expose port 3000
EXPOSE 3000

USER nextjs

# Use different start commands based on whether standalone exists
CMD if [ -f "server.js" ]; then \
    node server.js; \
  else \
    npm start; \
  fi