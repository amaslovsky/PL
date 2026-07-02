"""Unit tests for core.security: bcrypt wrappers + JWT encode/decode."""

import datetime
from typing import Optional

import pytest
from jose import jwt

from core.security import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)


def test_jwt_round_trip():
    token = create_access_token(user_id=42, email="a@b.com")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["email"] == "a@b.com"


def test_decode_returns_none_for_garbage():
    assert decode_access_token("not-a-jwt") is None
    assert decode_access_token("") is None
    assert decode_access_token("a.b.c") is None


def test_decode_rejects_tampered_payload():
    forged = jwt.encode(
        {"sub": "1", "exp": 9999999999}, "wrong-secret", algorithm=ALGORITHM
    )
    assert decode_access_token(forged) is None


def test_decode_rejects_expired():
    payload = {
        "sub": "1",
        "exp": datetime.datetime.now(tz=datetime.timezone.utc)
        - datetime.timedelta(seconds=10),
    }
    expired = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    assert decode_access_token(expired) is None


def test_decode_returns_payload_when_sub_missing():
    """decode_access_token returns the raw payload; sub enforcement is
    the dependency layer's job (get_current_user)."""
    token = jwt.encode({"exp": 9999999999}, SECRET_KEY, algorithm=ALGORITHM)
    payload = decode_access_token(token)
    assert payload is not None
    assert "sub" not in payload


def test_bcrypt_round_trip():
    h = get_password_hash("hunter2hunter2")
    assert verify_password("hunter2hunter2", h)
    assert not verify_password("wrong-password-here", h)


def test_bcrypt_hashes_are_unique_per_call():
    a = get_password_hash("hunter2hunter2")
    b = get_password_hash("hunter2hunter2")
    assert a != b
    assert verify_password("hunter2hunter2", a)
    assert verify_password("hunter2hunter2", b)