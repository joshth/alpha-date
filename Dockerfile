# App image for the lexicon pipeline. Same Node image as .gitlab-ci.yml.
# Defaults to offline mock mode with an embedded PGlite database: no secrets needed.
FROM node:24.18.0-slim
# uv fetches Python 3.12 for the SIRS plotter (Aura charts); Debian bookworm only ships 3.11.
COPY --from=ghcr.io/astral-sh/uv:0.9.0 /uv /usr/local/bin/uv
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ENV MOCK_LLM=true UV_NO_CACHE=1
RUN corepack enable
WORKDIR /app
RUN chown node:node /app

USER node
# Dependency layer first so source edits do not reinstall packages.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY --chown=node:node . .
RUN mkdir .data
# Creates sirs/.venv (Python 3.12 + sirs/requirements.txt); the Aura pages spawn it.
RUN pnpm sirs:setup
RUN pnpm build

EXPOSE 3000
# PGlite writes to /app/.data; mount a volume there to keep data between runs.
CMD ["pnpm", "start"]
