# Stage 1: Builder
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Stage 2: Hardened Runtime
FROM node:22-alpine

# Enforce non-root execution with numeric UID/GID for Kyverno compliance
RUN addgroup -g 10001 -S app && adduser -u 10001 -S app -G app

WORKDIR /app

# Copy production artifacts with non-root ownership
COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/package.json ./package.json
COPY --from=build --chown=10001:10001 /app/src ./src

ENV NODE_ENV=production \
    PORT=8080

USER 10001
EXPOSE 8080

CMD ["node", "src/index.js"]
