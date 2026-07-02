"""FastAPI dependencies: DB session per request, current user from JWT cookie."""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from core.security import COOKIE_NAME, decode_access_token
from database import SessionLocal, User


def get_db():
    """Yield a SQLAlchemy session and close it when the request finishes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def user_id_from_cookie(request: Request) -> int | None:
    """Return the user id encoded in the cookie, or None.

    Does not raise — callers decide how to react to a missing/invalid
    cookie (e.g. /api/auth/me returns 401; the SPA root redirects to
    /login without raising).
    """
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return decode_access_token(token)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Resolve the signed-in user from the `pl_session` JWT cookie.

    Raises 401 if the cookie is missing, malformed, expired, or refers to
    a user that no longer exists (e.g. after the DB was reset).
    """
    user_id = user_id_from_cookie(request)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="not authenticated")
    return user