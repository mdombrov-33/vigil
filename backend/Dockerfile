FROM node:24-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

FROM base AS dev
COPY tsconfig.json ./
# src is mounted as volume for hot reload
CMD ["npx", "tsx", "watch", "src/index.ts"]

FROM base AS prod
COPY tsconfig.json ./
COPY src ./src
CMD ["npx", "tsx", "src/index.ts"]
