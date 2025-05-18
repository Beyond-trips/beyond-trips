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

# ───────────── Runner (Production) Stage ─────────────
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy Next.js standalone output (includes Payload API and its own node_modules)
COPY --from=builder /app/.next/standalone ./

# Copy Next’s static assets
COPY --from=builder /app/.next/static ./.next/static

# (Optional) Copy your public folder if you have one
# If you don’t have a `public/` directory, you can delete this line.
COPY --from=builder /app/public ./public

# Expose port 3000 (the port Next standalone’s server.js listens on)
EXPOSE 3000

# Use a non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

USER nextjs

# Start the standalone server
CMD ["node", "server.js"]
