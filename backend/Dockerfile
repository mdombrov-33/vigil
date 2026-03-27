FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
RUN npm ci

FROM base AS dev
# src is mounted as a volume in compose for hot reload
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY src ./src
RUN npm run build

FROM node:24-alpine AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["npm", "run", "start"]
