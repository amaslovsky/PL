"""Security primitives: JWT cookies + bcrypt password hashing."""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

# JWT secret. Defaults to a development-only string so a missing env var
# does not crash a fresh container — production must set this in .env.
JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-only-jwt-secret-replace-in-prod")
JWT_ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days, matching PL-7

COOKIE_NAME: str = "pl_session"
MAX_AGE: int = 60 * 60 * 24 * 7  # 7 days in seconds, for the Set-Cookie header


def hash_password(password: str) -> str:
    """Return the bcrypt hash for `password` as a UTF-8 string."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Return True if `password` matches the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed stored hash — treat as no match rather than 500.
        return False


def create_access_token(user_id: int) -> str:
    """Mint a signed JWT containing the user id and an expiry."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Return the user id encoded in `token`, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            return None
        return int(sub)
    except (JWTError, ValueError):
        return None