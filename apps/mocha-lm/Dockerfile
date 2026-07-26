# syntax=docker/dockerfile:1

# Multi-stage build for the `mocha-lm` Next.js app in a pnpm + Turborepo monorepo.
# Build from the MONOREPO ROOT so the build context can see workspace packages:
#   docker build -f apps/mocha-lm/Dockerfile -t mocha-lm .

# ---- base -------------------------------------------------------------------
FROM node:24-alpine AS base
# libc6-compat helps some native/prebuilt binaries run on Alpine's musl.
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---- pruner -----------------------------------------------------------------
# Produce a minimal, cache-friendly slice of the monorepo for `mocha-lm`.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@^2 prune mocha-lm --docker

# ---- builder ----------------------------------------------------------------
FROM base AS builder

# 1) Install deps first (this layer is cached until package.json/lockfile change).
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# 2) Add the pruned source, generate the Prisma client, then build.
COPY --from=pruner /app/out/full/ .

# NEXT_PUBLIC_* values are inlined at build time, so they must be present now.
# Server-only secrets (CLERK_SECRET_KEY, OPENROUTER_API_KEY, DATABASE_URL, ...)
# are intentionally NOT baked in — they are provided at runtime.
# The sign-in URLs have safe defaults; the publishable key is optional but, if
# passed, must be non-empty (env.ts validates it with `.min(1).optional()`), so
# we only export it when a value is actually provided.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
ARG NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/notebooks"
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL

RUN pnpm --filter mocha-lm exec prisma generate
RUN if [ -n "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then \
      export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"; \
    else \
      unset NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || true; \
    fi; \
    pnpm --filter mocha-lm build

# ---- runner -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3002 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Next.js standalone output already contains a pruned node_modules and mirrors
# the monorepo layout, so `server.js` lives under apps/mocha-lm/.
COPY --from=builder --chown=nextjs:nodejs /app/apps/mocha-lm/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/mocha-lm/.next/static ./apps/mocha-lm/.next/static

# Local-disk storage for uploads/extracted text (see src/lib/storage.ts). Mount
# a volume here to persist source files across container restarts.
RUN mkdir -p /app/apps/mocha-lm/.data/uploads \
             /app/apps/mocha-lm/.data/extracted \
             /app/apps/mocha-lm/.data/web-snapshots \
    && chown -R nextjs:nodejs /app/apps/mocha-lm/.data
VOLUME ["/app/apps/mocha-lm/.data"]

USER nextjs
WORKDIR /app/apps/mocha-lm

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3002/api/health || exit 1

# The ingestion worker starts automatically via instrumentation.ts.
CMD ["node", "server.js"]
