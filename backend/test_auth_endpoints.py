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
    """Spin up a TestClient backed by a fresh SQLite DB."""
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    os.unlink(path)
    monkeypatch.setenv("DB_PATH", path)

    for name in list(sys.modules):
        if name in {"main", "database", "core", "core.security",
                    "core.dependencies", "services", "routes",
                    "routes.auth", "routes.chat", "routes.documents",
                    "models", "models.auth", "models.chat",
                    "models.documents"} or name.startswith("services."):
            del sys.modules[name]

    import database  # noqa: F401
    from database import Base, engine

    Base.metadata.create_all(bind=engine)

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
    body = r.json()
    assert body["user"]["email"] == "a@example.com"
    assert "access_token" in r.cookies
    cookie_value = r.cookies["access_token"]
    assert cookie_value.count(".") == 2


def test_signup_duplicate_returns_400(client):
    client.post(
        "/api/auth/signup",
        json={"email": "dup@example.com", "password": "hunter2hunter2"},
    )
    r = client.post(
        "/api/auth/signup",
        json={"email": "dup@example.com", "password": "hunter2hunter2"},
    )
    assert r.status_code == 400


def test_login_wrong_password_returns_401(client):
    client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    r = client.post(
        "/api/auth/signin",
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
        "/api/auth/signin",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    assert r.status_code == 200
    assert "access_token" in r.cookies


def test_get_me_authenticated(client):
    client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body == {"id": 1, "email": "a@example.com"}


def test_get_me_unauthenticated(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_signout_clears_cookie(client):
    client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    r = client.post("/api/auth/signout")
    assert r.status_code == 200
    set_cookie = r.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie