# Docs site image. Build context is the repo root (the site reads ../docs and ../openapi):
#   docker build -f website/Dockerfile -t alpha-date-docs .
FROM node:24.18.0-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /site/website
COPY website/package.json website/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-workspace
COPY website ./
COPY docs /site/docs
COPY openapi /site/openapi
# Docusaurus fails the build on broken links, so this also checks every docs link.
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /site/website/build /usr/share/nginx/html
EXPOSE 8080
