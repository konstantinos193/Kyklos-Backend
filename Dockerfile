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
# The two settings below are ENV, not CLI flags, on purpose. pnpm records the
# config an install ran under, and pnpm 11 defaults verify-deps-before-run to
# "install" - so `pnpm build` re-checks that state and silently reruns a full
# install if it disagrees. Passing --config.node-linker=hoisted to `pnpm
# install` alone did exactly that: the build step saw the default linker,
# declared node_modules stale, and reinstalled all 802 packages over the
# network. ENV applies to every pnpm invocation in the stage, so they agree.
#
# node-linker=hoisted because node_modules is copied between stages below:
# pnpm's default symlink farm survives COPY --from, but a flat tree removes
# any doubt and costs nothing in a throwaway image.
#
# verify-deps-before-run=false because the install is the line above - there is
# nothing to drift, and the check only adds a network round trip that can fail.
# (Set as ENV in each stage below - only ARG may precede the first FROM.)

# ---- production dependencies only ----
FROM node:22-alpine AS prod-deps
ENV PNPM_CONFIG_NODE_LINKER=hoisted \
    PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# ---- build (needs devDependencies for TypeScript) ----
FROM node:22-alpine AS build
ENV PNPM_CONFIG_NODE_LINKER=hoisted \
    PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
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
