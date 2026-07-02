"""Unit tests for core.security: JWT encode/decode and bcrypt wrappers."""

import pytest
from jose import jwt

from core.security import (
    JWT_ALGORITHM,
    JWT_SECRET,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_jwt_round_trip():
    token = create_access_token(user_id=42)
    assert decode_access_token(token) == 42


def test_decode_access_token_returns_none_for_garbage():
    assert decode_access_token("not-a-jwt") is None
    assert decode_access_token("") is None
    assert decode_access_token("a.b.c") is None


def test_decode_access_token_rejects_tampered_payload():
    # A token signed with a different secret should fail verification.
    forged = jwt.encode({"sub": "1", "exp": 9999999999}, "wrong-secret", algorithm=JWT_ALGORITHM)
    assert decode_access_token(forged) is None


def test_decode_access_token_rejects_expired():
    # Mint a token that's already expired by back-dating exp directly.
    import datetime

    payload = {
        "sub": "1",
        "exp": datetime.datetime.now(tz=datetime.timezone.utc) - datetime.timedelta(seconds=10),
    }
    expired = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    assert decode_access_token(expired) is None


def test_decode_access_token_returns_none_when_sub_missing():
    token = jwt.encode({"exp": 9999999999}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    assert decode_access_token(token) is None


def test_decode_access_token_returns_none_for_non_numeric_sub():
    token = jwt.encode({"sub": "abc", "exp": 9999999999}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    assert decode_access_token(token) is None


def test_bcrypt_round_trip():
    h = hash_password("hunter2hunter2")
    assert verify_password("hunter2hunter2", h)
    assert not verify_password("wrong-password-here", h)


def test_verify_password_treats_malformed_hash_as_false():
    # Some legacy rows may hold a non-bcrypt string. Must not raise.
    assert verify_password("anything", "not-a-real-bcrypt-hash") is False


def test_bcrypt_hashes_are_unique_per_call():
    # Two calls with the same plaintext produce different hashes (salt).
    a = hash_password("hunter2hunter2")
    b = hash_password("hunter2hunter2")
    assert a != b
    assert verify_password("hunter2hunter2", a)
    assert verify_password("hunter2hunter2", b)