"""End-to-end tests for the /api/auth/* routes.

Each test builds a fresh SQLite DB before importing `main`, so every
SQLAlchemy class binding refers to the same module instance.
"""

import os

os.environ.setdefault("OPENROUTER_API_KEY", "test-key-not-used")

import sys
import tempfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    """Spin up a TestClient backed by a fresh SQLite DB.

    Pre-imports `database`, `services`, `routes`, then `main` — all with
    the new DB_PATH set in the environment, so SQLAlchemy class identity
    matches the engine for the duration of the test.
    """
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    os.unlink(path)
    monkeypatch.setenv("DB_PATH", path)

    # Drop any stale module bindings from a previous test so imports
    # below re-execute against the new DB_PATH.
    for name in list(sys.modules):
        if name in {"main", "database", "core", "core.security",
                    "core.dependencies", "services", "routes",
                    "routes.auth", "routes.chat", "routes.documents",
                    "models", "models.auth", "models.chat",
                    "models.documents"} or name.startswith("services."):
            del sys.modules[name]

    # Import order matters: database first so the engine binds to the
    # path the env var just set.
    import database  # noqa: F401
    from database import Base, engine

    Base.metadata.create_all(bind=engine)

    # Now import the rest in dependency order.
    import main  # noqa: F401

    from main import app as fastapi_app

    yield TestClient(fastapi_app)

    if os.path.exists(path):
        os.unlink(path)


def test_signup_creates_user_and_sets_cookie(client):
    r = client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["user_id"] >= 1
    assert "pl_session" in r.cookies
    cookie_value = r.cookies["pl_session"]
    # JWT cookie should look like three base64url segments separated by dots.
    assert cookie_value.count(".") == 2


def test_signup_duplicate_returns_409(client):
    client.post(
        "/api/auth/signup",
        json={"email": "dup@example.com", "password": "hunter2hunter2"},
    )
    r = client.post(
        "/api/auth/signup",
        json={"email": "dup@example.com", "password": "hunter2hunter2"},
    )
    assert r.status_code == 409


def test_signup_short_password_rejected(client):
    r = client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "short"},
    )
    assert r.status_code == 422


def test_login_wrong_password_returns_401(client):
    client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    r = client.post(
        "/api/auth/login",
        json={"email": "a@example.com", "password": "WRONGwrong9999"},
    )
    assert r.status_code == 401


def test_login_success_sets_cookie(client):
    client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    client.cookies.clear()
    r = client.post(
        "/api/auth/login",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    assert r.status_code == 200
    assert "pl_session" in r.cookies


def test_get_me_authenticated(client):
    client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json() == {"authenticated": True, "user_id": 1, "email": "a@example.com"}


def test_get_me_unauthenticated(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_logout_clears_cookie(client):
    client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    r = client.post("/api/auth/logout")
    assert r.status_code == 200
    set_cookie = r.headers.get("set-cookie", "")
    assert "pl_session=" in set_cookie