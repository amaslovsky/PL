"""FastAPI dependencies: DB session per request, current user from JWT cookie."""

from typing import Optional

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session

from core.security import decode_access_token
from database import SessionLocal, User
from services.auth_service import AuthService


def get_db():
    """Yield a SQLAlchemy session and close it when the request finishes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the signed-in user from the `access_token` JWT cookie.

    Raises 401 if the cookie is missing, malformed, expired, or refers to
    a user that no longer exists.
    """
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    return AuthService(db).get_user_by_id(int(user_id))


async def get_current_user_optional(
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like `get_current_user` but returns None instead of raising 401.

    Use this on routes that render different content for signed-in vs
    anonymous users but don't require auth (e.g. the SPA root).
    """
    if not access_token:
        return None

    payload = decode_access_token(access_token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    try:
        return AuthService(db).get_user_by_id(int(user_id))
    except HTTPException:
        return None