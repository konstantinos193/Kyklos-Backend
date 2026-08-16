# Multi-stage. The previous single-stage build shipped ~2.4GB because it
# installed devDependencies into the runtime image and then ran
# `chown -R nodejs:nodejs /app`, which rewrote every file - node_modules
# included - into a second 496MB layer. Ownership is now set by COPY --chown,
# which costs nothing, and only production dependencies reach the final stage.

# pnpm, not yarn: both `typescript` (20 Go binaries since 7.0) and `sharp`
# publish one optionalDependency per OS/arch, and yarn 1 ignores their os/cpu
# fields when *fetching* - it downloads all 45, links the 2 it needs, and
# discards the rest. Twice, once per install stage. That is what filled the
# deploy host's disk (ENOSPC). pnpm honours os/cpu and fetches only linux-x64.
#
# node-linker=hoisted because node_modules is copied between stages below:
# pnpm's default symlink farm survives COPY --from, but a flat tree removes
# any doubt and costs nothing in a throwaway image.
ARG PNPM_FLAGS="--frozen-lockfile --config.node-linker=hoisted"

# ---- production dependencies only ----
FROM node:22-alpine AS prod-deps
ARG PNPM_FLAGS
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod $PNPM_FLAGS && pnpm store prune

# ---- build (needs devDependencies for TypeScript) ----
FROM node:22-alpine AS build
ARG PNPM_FLAGS
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install $PNPM_FLAGS
COPY . .
RUN pnpm build

# ---- runtime ----
FROM node:22-alpine AS runtime

RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package.json ./
# Served by useStaticAssets at /public, and seeds the named volume on first run.
COPY --chown=nodejs:nodejs public ./public
# Operational one-offs such as create-admin.
COPY --chown=nodejs:nodejs scripts ./scripts

USER nodejs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health/fast', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
