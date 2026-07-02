"""HTTP routes for /api/auth/* — signup, login, me, logout."""

import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from core.security import (
    COOKIE_NAME,
    MAX_AGE,
    create_access_token,
)
from database import User
from models.auth import SigninRequest, SignupRequest
from services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

# `secure=True` only takes effect over HTTPS. Default off so dev works over HTTP.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0") == "1"


def _set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=create_access_token(user_id),
        max_age=MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
        secure=COOKIE_SECURE,
    )


@router.post("/signup")
async def post_signup(
    body: SignupRequest, db: Session = Depends(get_db)
) -> JSONResponse:
    """Register a new account and set the JWT session cookie."""
    try:
        user = AuthService.signup(db, body.email, body.password)
    except IntegrityError:
        # Either the unique-email constraint, or a concurrent insert race.
        raise HTTPException(status_code=409, detail="email already registered")
    response = JSONResponse({"user_id": user.id})
    _set_session_cookie(response, user.id)
    return response


@router.post("/login")
async def post_login(
    body: SigninRequest, db: Session = Depends(get_db)
) -> JSONResponse:
    """Verify credentials and set the JWT session cookie."""
    user = AuthService.signin(db, body.email, body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="invalid email or password")
    response = JSONResponse({"user_id": user.id})
    _set_session_cookie(response, user.id)
    return response


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
) -> dict:
    """Return the signed-in user's id and email."""
    return {"authenticated": True, "user_id": user.id, "email": user.email}


@router.post("/logout")
async def post_logout() -> JSONResponse:
    """Clear the session cookie."""
    response = JSONResponse({"ok": True})
    response.delete_cookie(COOKIE_NAME, path="/")
    return response