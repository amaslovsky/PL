"""FastAPI app — thin shell.

Auth, chat, and document storage live in routes/; business logic in
services/. This module wires lifespan, CORS, the static-asset mount, the
SPA fallback, and includes the routers.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi import Request

from core.dependencies import get_db, user_id_from_cookie
from database import SessionLocal, init_db
from routes import auth as auth_routes
from routes import chat as chat_routes
from routes import documents as doc_routes

STATIC_DIR = os.getenv("STATIC_DIR", "/app/static")
STATIC = Path(STATIC_DIR)

if not os.getenv("OPENROUTER_API_KEY"):
    # Fail fast at import time. The chat route would otherwise 500 on
    # every request when the operator forgets to configure `.env`.
    raise RuntimeError("OPENROUTER_API_KEY is not set. Add it to the project-root .env.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(chat_routes.router)
app.include_router(doc_routes.router)


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}


def _serve_static_file(path: str) -> FileResponse | None:
    """Try path as file, then as path.html, then as path/index.html."""
    for candidate in (STATIC / path, STATIC / f"{path}.html", STATIC / path / "index.html"):
        if candidate.is_file():
            return FileResponse(candidate)
    return None


@app.get("/", response_model=None)
async def get_index(request: Request):
    """Serve the chat workspace HTML or redirect unauthenticated users to /login."""
    user_id = user_id_from_cookie(request)
    if user_id is None:
        return RedirectResponse(url="/login", status_code=303)
    # Verify the user still exists; a stale cookie must redirect too.
    db = SessionLocal()
    try:
        from database import User
        if db.get(User, user_id) is None:
            return RedirectResponse(url="/login", status_code=303)
    finally:
        db.close()
    return FileResponse(STATIC / "index.html")


# _next mount must come before the catch-all so it wins over the path
# parameter for /_next/* asset requests.
if (STATIC / "_next").is_dir():
    app.mount("/_next", StaticFiles(directory=STATIC / "_next"), name="next-assets")


@app.get("/{full_path:path}")
async def get_spa(full_path: str) -> FileResponse:
    """Serve matching static file, else fall back to the SPA index."""
    served = _serve_static_file(full_path)
    if served is not None:
        return served
    return FileResponse(STATIC / "index.html")