# syntax=docker/dockerfile:1.7
# ---------- Stage 1: build the Next.js static export ----------
FROM node:22-alpine AS builder
WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Stage 2: python runtime ----------
FROM python:3.13-slim AS runtime

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /usr/local/bin/

# Create a non-root user and give it ownership of the runtime dirs.
RUN groupadd -r plapp && useradd -r -g plapp -d /app -s /usr/sbin/nologin plapp \
    && mkdir -p /app/data \
    && chown -R plapp:plapp /app

WORKDIR /app

# Install backend deps first to leverage Docker layer cache. Run as
# root in a scratch dir so the resulting `.venv` doesn't pollute the
# runtime image; we'll let `uv` recreate it under plapp at startup.
WORKDIR /deps
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

# Reset WORKDIR to /app so the runtime's CMD finds `main` at the right
# path (uvicorn runs from WORKDIR by default).
WORKDIR /app

# The backend is laid out flat at the repo's backend/ root, so the entry
# module is `main` (not `app.main` as in PL-7/PL-8). Copy as root, then
# hand ownership to plapp so the runtime can write SQLite and rebuild
# `.venv` on first launch.
COPY --chown=plapp:plapp backend/ /app/

# Copy the project-root catalog the backend loads at import time.
COPY --chown=plapp:plapp catalog.json /app/catalog.json

# Copy the prebuilt static export under plapp ownership so the
# runtime image is uniform. main.py resolves STATIC_DIR at
# `/app/frontend/out`, which is `parent.parent` of `/app/main.py`.
COPY --chown=plapp:plapp --from=builder /build/frontend/out /app/frontend/out

ENV DB_PATH=/app/data/app.db \
    PYTHONUNBUFFERED=1 \
    STATIC_DIR=/app/frontend/out

USER plapp
EXPOSE 8000

# Drop the SQLite file so the schema is rebuilt from scratch on every
# container start, then launch uvicorn.
CMD ["sh", "-c", "rm -f /app/data/app.db && uv run uvicorn main:app --host 0.0.0.0 --port 8000"]</</content>