# App image for the lexicon pipeline. Same Node image as .gitlab-ci.yml.
# Defaults to offline mock mode with an embedded PGlite database: no secrets needed.

# Stage 1: the SIRS Python environment for the Aura pages. It has a compiler because
# dtaidistance has no prebuilt wheel for every CPU and fails at runtime without its C library.
# uv fetches Python 3.12 (Debian bookworm only ships 3.11); scripts/sirs-setup.mjs makes the venv.
FROM node:24.18.0-slim AS sirs
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.9.0 /uv /usr/local/bin/uv
ENV UV_NO_CACHE=1 UV_PYTHON_INSTALL_DIR=/opt/uv-python
WORKDIR /app
COPY package.json ./
COPY scripts/sirs-setup.mjs scripts/sirs-setup.mjs
COPY sirs/requirements.txt sirs/requirements.txt
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN pnpm sirs:setup

# Stage 2: the app.
FROM node:24.18.0-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
ENV MOCK_LLM=true
RUN corepack enable
WORKDIR /app
RUN chown node:node /app

USER node
# Dependency layer first so source edits do not reinstall packages.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

COPY --chown=node:node . .
RUN mkdir .data
# The Aura pages spawn sirs/.venv/bin/python, which links to the uv-managed Python.
COPY --from=sirs /opt/uv-python /opt/uv-python
COPY --from=sirs --chown=node:node /app/sirs/.venv /app/sirs/.venv
RUN pnpm build

EXPOSE 3000
# PGlite writes to /app/.data; mount a volume there to keep data between runs.
CMD ["pnpm", "start"]
