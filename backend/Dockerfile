FROM node:24-alpine AS base
WORKDIR /app
# Copy workspace root and all package manifests first for layer caching
COPY package.json ./
COPY packages/db/package.json ./packages/db/
COPY backend/package.json ./backend/
RUN npm install --workspace=backend --workspace=@vigil/db

FROM base AS dev
COPY packages/db/drizzle.config.ts ./packages/db/
COPY packages/db/src ./packages/db/src
COPY backend/tsconfig.json ./backend/
# backend/src is mounted as volume for hot reload
WORKDIR /app/backend
CMD ["npx", "tsx", "watch", "src/index.ts"]

FROM base AS builder
COPY packages/db ./packages/db
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
WORKDIR /app/backend
RUN npx tsc

FROM node:24-alpine AS prod
WORKDIR /app
COPY package.json ./
COPY packages/db/package.json ./packages/db/
COPY backend/package.json ./backend/
RUN npm install --workspace=backend --workspace=@vigil/db --omit=dev
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/packages/db/src/migrations ./packages/db/src/migrations
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
