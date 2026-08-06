# Multi-stage. The previous single-stage build shipped ~2.4GB because it
# installed devDependencies into the runtime image and then ran
# `chown -R nodejs:nodejs /app`, which rewrote every file - node_modules
# included - into a second 496MB layer. Ownership is now set by COPY --chown,
# which costs nothing, and only production dependencies reach the final stage.

# ---- production dependencies only ----
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# ---- build (needs devDependencies for the Nest CLI and TypeScript) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

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
