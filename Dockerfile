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

# Install backend deps first to leverage Docker layer cache.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/app ./app

# Copy the prebuilt static export.
COPY --from=builder /build/frontend/out /app/static

ENV DB_PATH=/app/data/app.db \
    STATIC_DIR=/app/static \
    PYTHONUNBUFFERED=1

USER plapp
EXPOSE 8000

# Drop the SQLite file so the schema is rebuilt from scratch on every
# container start, then launch uvicorn.
CMD ["sh", "-c", "rm -f /app/data/app.db && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]</</content>