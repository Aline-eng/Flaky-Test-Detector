# Built from the REPO ROOT as build context (see .github/workflows/publish-action-image.yml),
# not by GitHub's automatic docker-action build -- this action needs the whole monorepo
# (server/, root package.json/lockfile), which a same-directory build context can't reach.
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY dashboard/package.json dashboard/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run prisma:generate --workspace server
RUN npm run build --workspace server

FROM node:22-alpine
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/server/node_modules ./server/node_modules
COPY --from=build /repo/server/dist ./server/dist
COPY --from=build /repo/server/prisma ./server/prisma
COPY --from=build /repo/server/package.json ./server/package.json

ENTRYPOINT ["node", "server/dist/cli/action-entrypoint.js"]
