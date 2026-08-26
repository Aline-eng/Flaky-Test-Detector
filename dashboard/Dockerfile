FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY dashboard/package.json dashboard/package.json
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace dashboard

FROM node:22-alpine
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/dashboard ./dashboard
WORKDIR /repo/dashboard

EXPOSE 4173
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "4173"]
