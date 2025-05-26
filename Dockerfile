# ───────────── Runner (Production) Stage ─────────────
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 1) Copy Next.js standalone output (which already includes Payload)
COPY --from=builder /app/.next/standalone ./

# 2) Copy Next’s static assets
COPY --from=builder /app/.next/static ./.next/static


# Expose port 3000
EXPOSE 3000

# Create a non-root user (optional)
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

USER nextjs

# Launch the standalone server
CMD ["node", "server.js"]
