"""FastAPI app: real auth, AI chat, document storage, and static SPA serving."""

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field, ValidationError
from sqlite3 import IntegrityError

from .ai import chat as ai_chat
from .auth import (
    COOKIE_NAME,
    MAX_AGE,
    authenticate,
    create_account,
    current_user_id,
    make_cookie_value,
)
from .ai import NdaFields
from .config import STATIC_DIR
from .db import (
    create_document,
    delete_document as db_delete_document,
    find_user_by_email,
    find_user_by_id,
    get_document as db_get_document,
    init_db,
    list_documents as db_list_documents,
    update_document as db_update_document,
)
from .documents import fallback_message, is_supported


class ChatRequest(BaseModel):
    messages: list[dict]
    # Defaults to "mnda" so existing callers stay compatible. Only "mnda"
    # invokes the LLM today; other ids trigger the static fallback path
    # in `post_chat` (see `app/documents.py`).
    document_type: str = "mnda"


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class CreateDocumentRequest(BaseModel):
    document_type: str
    data: dict


STATIC = Path(STATIC_DIR)

# `secure=True` only takes effect over HTTPS. Default off so dev works over HTTP.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0") == "1"

if not os.getenv("OPENROUTER_API_KEY"):
    # Fail fast at import time. The chat route would otherwise 500 on every
    # request when the operator forgets to configure `.env`.
    raise RuntimeError("OPENROUTER_API_KEY is not set. Add it to the project-root .env.")


def _user_or_401(request: Request) -> int:
    """Return the signed-in user id, or raise 401."""
    uid = current_user_id(request)
    if uid is None:
        raise HTTPException(status_code=401, detail="not authenticated")
    return uid


def _set_session_cookie(response: JSONResponse, user_id: int) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=make_cookie_value(user_id),
        max_age=MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
        secure=COOKIE_SECURE,
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/api/auth/signup")
async def post_signup(creds: Credentials) -> JSONResponse:
    """Register a new account and set the session cookie."""
    if find_user_by_email(creds.email) is not None:
        raise HTTPException(status_code=409, detail="email already registered")
    try:
        user_id = create_account(creds.email, creds.password)
    except IntegrityError:
        raise HTTPException(status_code=409, detail="email already registered")
    response = JSONResponse({"user_id": user_id})
    _set_session_cookie(response, user_id)
    return response


@app.post("/api/auth/login")
async def post_login(creds: Credentials) -> JSONResponse:
    """Verify credentials and set the session cookie."""
    user_id = authenticate(creds.email, creds.password)
    if user_id is None:
        raise HTTPException(status_code=401, detail="invalid email or password")
    response = JSONResponse({"user_id": user_id})
    _set_session_cookie(response, user_id)
    return response


@app.get("/api/auth/me")
async def get_me(request: Request) -> JSONResponse:
    uid = current_user_id(request)
    if uid is None:
        return JSONResponse({"authenticated": False}, status_code=401)
    row = find_user_by_id(uid)
    if row is None:
        # Cookie signed for a row that no longer exists (DB was reset).
        return JSONResponse({"authenticated": False}, status_code=401)
    return JSONResponse(
        {"authenticated": True, "user_id": row["id"], "email": row["email"]}
    )


@app.post("/api/auth/logout")
async def post_logout() -> JSONResponse:
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


@app.post("/api/chat")
async def post_chat(request: Request, body: ChatRequest) -> JSONResponse:
    """Run one chat turn. For "mnda" the LLM drafts fields; for any other
    document type we return a static fallback message explaining the
    closest supported document."""
    _user_or_401(request)
    if not is_supported(body.document_type):
        return JSONResponse(
            {"fields": None, "assistant_message": fallback_message(body.document_type)}
        )
    turn = ai_chat(body.messages)
    return JSONResponse(turn.model_dump())


@app.get("/api/documents")
async def get_documents(request: Request) -> JSONResponse:
    uid = _user_or_401(request)
    rows = db_list_documents(uid)
    return JSONResponse(
        [
            {
                "id": r["id"],
                "document_type": r["document_type"],
                "data": json.loads(r["data_json"]),
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in rows
        ]
    )


@app.post("/api/documents")
async def post_document(request: Request, body: CreateDocumentRequest) -> JSONResponse:
    uid = _user_or_401(request)
    if not is_supported(body.document_type):
        raise HTTPException(status_code=400, detail="unsupported document type")
    # Validate data against the per-doc schema. Today only MNDA is wired
    # so NdaFields is the one validator. Other types will land in PL-7+.
    try:
        NdaFields.model_validate(body.data)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=json.loads(e.json()))
    data_json = json.dumps(body.data)
    doc_id = create_document(uid, body.document_type, data_json)
    return JSONResponse({"id": doc_id, "document_type": body.document_type})


@app.get("/api/documents/{doc_id}")
async def get_one_document(doc_id: int, request: Request) -> JSONResponse:
    uid = _user_or_401(request)
    row = db_get_document(doc_id, uid)
    if row is None:
        raise HTTPException(status_code=404, detail="document not found")
    return JSONResponse(
        {
            "id": row["id"],
            "document_type": row["document_type"],
            "data": json.loads(row["data_json"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
    )


@app.put("/api/documents/{doc_id}")
async def put_document(
    doc_id: int, request: Request, body: CreateDocumentRequest
) -> JSONResponse:
    uid = _user_or_401(request)
    if not is_supported(body.document_type):
        raise HTTPException(status_code=400, detail="unsupported document type")
    try:
        NdaFields.model_validate(body.data)
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=json.loads(e.json()))
    data_json = json.dumps(body.data)
    if not db_update_document(doc_id, uid, data_json):
        raise HTTPException(status_code=404, detail="document not found")
    return JSONResponse({"id": doc_id, "document_type": body.document_type})


@app.delete("/api/documents/{doc_id}")
async def delete_one_document(doc_id: int, request: Request) -> JSONResponse:
    uid = _user_or_401(request)
    if not db_delete_document(doc_id, uid):
        raise HTTPException(status_code=404, detail="document not found")
    return JSONResponse({"ok": True})


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