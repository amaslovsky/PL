"""FastAPI app: fake login, auth API, AI chat, and static SPA serving."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    RedirectResponse,
)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .ai import chat as ai_chat
from .auth import COOKIE_NAME, MAX_AGE, current_user_id, login, make_cookie_value
from .config import STATIC_DIR
from .db import init_db
from .login_page import LOGIN_HTML


class ChatRequest(BaseModel):
    messages: list[dict]


STATIC = Path(STATIC_DIR)

# `secure=True` only takes effect over HTTPS. Default off so dev works over HTTP.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0") == "1"

if not os.getenv("OPENROUTER_API_KEY"):
    # Fail fast at import time. The chat route would otherwise 500 on every
    # request when the operator forgets to configure `.env`.
    raise RuntimeError("OPENROUTER_API_KEY is not set. Add it to the project-root .env.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/api/auth/login")
async def post_login(email: str = Form(...), password: str = Form(...)) -> RedirectResponse:
    """Accept any email/password, upsert the user, and set a signed cookie."""
    del password  # Fake auth: the password is not validated.
    uid = login(email)
    response = RedirectResponse(url="/", status_code=303)
    response.set_cookie(
        key=COOKIE_NAME,
        value=make_cookie_value(uid),
        max_age=MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
        secure=COOKIE_SECURE,
    )
    return response


@app.get("/api/auth/me")
async def get_me(request: Request) -> JSONResponse:
    uid = current_user_id(request)
    if uid is None:
        return JSONResponse({"authenticated": False}, status_code=401)
    return JSONResponse({"authenticated": True, "user_id": uid})


@app.post("/api/auth/logout")
async def post_logout() -> RedirectResponse:
    response = RedirectResponse(url="/login", status_code=303)
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


@app.post("/api/chat")
async def post_chat(request: Request, body: ChatRequest) -> JSONResponse:
    """Run one chat turn against the MNDA-drafting LLM and return the
    current best-guess fields plus the assistant's reply."""
    if current_user_id(request) is None:
        raise HTTPException(status_code=401, detail="not authenticated")
    turn = ai_chat(body.messages)
    return JSONResponse(turn.model_dump())


@app.get("/login", response_class=HTMLResponse)
async def get_login() -> str:
    return LOGIN_HTML


def _serve_static_file(path: str) -> FileResponse | None:
    """Try path as file, then as path.html, then as path/index.html."""
    for candidate in (STATIC / path, STATIC / f"{path}.html", STATIC / path / "index.html"):
        if candidate.is_file():
            return FileResponse(candidate)
    return None


@app.get("/", response_model=None)
async def get_index(request: Request):
    if current_user_id(request) is None:
        return RedirectResponse(url="/login", status_code=303)
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