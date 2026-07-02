"""HTTP routes for /api/auth/* — signup, signin, me, signout."""

import os

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db
from database import User
from models.auth import AuthResponse, SigninRequest, SignupRequest, UserResponse
from services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0") == "1"


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
    )


@router.post("/signup", response_model=AuthResponse)
async def signup(
    request: SignupRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Register a new user and set the JWT cookie."""
    user, token = AuthService(db).signup(request.email, request.password)
    _set_auth_cookie(response, token)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        message="Account created successfully",
    )


@router.post("/signin", response_model=AuthResponse)
async def signin(
    request: SigninRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    """Sign in an existing user and set the JWT cookie."""
    user, token = AuthService(db).signin(request.email, request.password)
    _set_auth_cookie(response, token)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        message="Signed in successfully",
    )


@router.post("/signout")
async def signout(response: Response) -> dict:
    """Sign out by clearing the auth cookie."""
    response.delete_cookie(key="access_token")
    return {"message": "Signed out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return the signed-in user's id and email."""
    return UserResponse.model_validate(current_user)