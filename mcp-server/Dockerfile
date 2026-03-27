FROM node:24-alpine AS base
WORKDIR /app
COPY package.json ./
COPY packages/db/package.json ./packages/db/
COPY mcp-server/package.json ./mcp-server/
RUN npm install --workspace=mcp-server --workspace=@vigil/db

FROM base AS dev
COPY packages/db/src ./packages/db/src
COPY mcp-server/tsconfig.json ./mcp-server/
# mcp-server/src is mounted as volume for hot reload
WORKDIR /app/mcp-server
CMD ["npx", "tsx", "watch", "src/index.ts"]
