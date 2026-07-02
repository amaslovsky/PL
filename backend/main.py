"""FastAPI app — thin shell.

Auth, chat, and document storage live in `routes/`. Business logic in
`services/`. This module wires lifespan, CORS, the static-asset mount,
and the SPA fallback, then includes the routers.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
from routes.auth import router as auth_router
from routes.chat import router as chat_router
from routes.documents import router as documents_router

load_dotenv()

# Static export location.
#
# In dev: defaults to `<repo-root>/frontend/out` (two directories up from
# `backend/main.py`).
# In Docker: the Dockerfile sets `STATIC_DIR=/app/frontend/out` explicitly,
# which is the same parent of `main.py` (since WORKDIR is `/app`).
import os

STATIC_DIR = Path(
    os.environ.get("STATIC_DIR") or Path(__file__).resolve().parent.parent / "frontend" / "out"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_db()
    yield


app = FastAPI(
    title="Prelegal API",
    description="Backend API for Prelegal legal document SaaS",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(documents_router)


@app.get("/api/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy"}


if STATIC_DIR.exists():
    app.mount("/_next", StaticFiles(directory=STATIC_DIR / "_next"), name="next_static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve static files or fall back to index.html for SPA routing."""
        if full_path:
            file_path = STATIC_DIR / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)

        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)

        return {"error": "Frontend not built. Run 'npm run build' in frontend/"}
else:
    @app.get("/{full_path:path}")
    async def serve_spa_unbuilt(full_path: str):
        """No static export built yet — return a placeholder."""
        return {"error": "Frontend not built. Run 'npm run build' in frontend/"}