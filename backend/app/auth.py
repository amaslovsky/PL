"""Session-cookie auth: bcrypt-hashed passwords + signed cookie payload."""

import bcrypt
from fastapi import Request
from itsdangerous import BadSignature, URLSafeTimedSerializer

from .config import SECRET_KEY
from .db import create_user, find_user_by_email

SERIALIZER = URLSafeTimedSerializer(SECRET_KEY, salt="pl-session")
COOKIE_NAME = "pl_session"
MAX_AGE = 60 * 60 * 24 * 7  # 7 days

# Back-compat shim — `main.post_login` no longer calls this in PL-7, but the
# import is kept so tests that import the symbol keep working.
__all__ = [
    "COOKIE_NAME",
    "MAX_AGE",
    "authenticate",
    "create_account",
    "current_user_id",
    "make_cookie_value",
    "read_cookie_value",
]


def hash_password(password: str) -> str:
    """Return the bcrypt hash for `password` as a UTF-8 string."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Return True if `password` matches the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed stored hash (e.g. legacy fake-auth row) — treat as no match.
        return False


def create_account(email: str, password: str) -> int:
    """Insert a new user with a hashed password and return the row id."""
    return create_user(email, hash_password(password))


def authenticate(email: str, password: str) -> int | None:
    """Return the user id if `email`/`password` match, else None."""
    row = find_user_by_email(email)
    if row is None:
        return None
    if not verify_password(password, row["password_hash"]):
        return None
    return row["id"]


def make_cookie_value(user_id: int) -> str:
    return SERIALIZER.dumps({"uid": user_id})


def read_cookie_value(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        return SERIALIZER.loads(raw, max_age=MAX_AGE)
    except BadSignature:
        return None


def current_user_id(request: Request) -> int | None:
    data = read_cookie_value(request.cookies.get(COOKIE_NAME))
    return data["uid"] if data else None
