# Stage 1: Builder
FROM node:25-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Stage 2: Hardened Runtime
FROM node:25-alpine

# Strip build tools and package managers from runtime image to minimize attack surface and eliminate CVEs
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn*

# Enforce non-root execution with numeric UID/GID for Kyverno compliance
RUN addgroup -g 10001 -S app && adduser -u 10001 -S app -G app

WORKDIR /app

# Copy production artifacts with non-root ownership
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/package.json ./package.json
COPY --from=build --chown=10001:10001 /app/src ./src

ENV NODE_ENV=production \
    PORT=3000

USER 10001
EXPOSE 3000

CMD ["node", "src/server.js"]
