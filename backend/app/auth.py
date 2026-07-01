"""Fake auth: signed cookie holding the user id."""

from fastapi import Request
from itsdangerous import BadSignature, URLSafeTimedSerializer

from .config import SECRET_KEY
from .db import upsert_user

SERIALIZER = URLSafeTimedSerializer(SECRET_KEY, salt="pl-session")
COOKIE_NAME = "pl_session"
MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def make_cookie_value(user_id: int) -> str:
    return SERIALIZER.dumps({"uid": user_id})


def read_cookie_value(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        return SERIALIZER.loads(raw, max_age=MAX_AGE)
    except BadSignature:
        return None


def login(email: str) -> int:
    """Upsert a user by email and return the row id."""
    return upsert_user(email)


def current_user_id(request: Request) -> int | None:
    data = read_cookie_value(request.cookies.get(COOKIE_NAME))
    return data["uid"] if data else None
