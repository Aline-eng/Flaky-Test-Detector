FROM node:22-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY dashboard/package.json dashboard/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run prisma:generate --workspace server
RUN npm run build --workspace server

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/server/node_modules ./server/node_modules
COPY --from=build /repo/server/dist ./server/dist
COPY --from=build /repo/server/prisma ./server/prisma
COPY --from=build /repo/server/package.json ./server/package.json

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
