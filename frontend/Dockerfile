# World Arena web. Build from the repository root:
#   docker build -f frontend/Dockerfile -t arena-web .
# Stage 1 compiles the SPA, stage 2 serves it and proxies /api to the API container.
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app/frontend

# Dependencies first: cached until the lock file changes.
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
# No ARENA_API_URL here: nginx serves the SPA and /api from one origin, so the
# relative paths in api/client.ts resolve by themselves and the cookie stays first-party.
RUN pnpm build


FROM nginx:1.29-alpine AS runtime

COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY deploy/compose/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
