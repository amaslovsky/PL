"""Tests for the auth surface in `app/auth.py` and the /api/auth/* routes."""

import os

os.environ.setdefault("OPENROUTER_API_KEY", "test")  # module-scope fail-fast bypass

from fastapi.testclient import TestClient


def _new_client(monkeypatch_tmp_db):
    """Build a TestClient using a temp DB file per test."""
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    # Ensure schema exists.
    dbmod.init_db()
    from app.main import app

    return TestClient(app)


def test_signup_creates_user_and_sets_cookie(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = TestClient(app)
    r = client.post(
        "/api/auth/signup",
        json={"email": "a@example.com", "password": "hunter2hunter2"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["user_id"] >= 1
    assert "pl_session" in r.cookies


def test_signup_duplicate_returns_409(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = TestClient(app)
    client.post(
        "/api/auth/signup", json={"email": "dup@example.com", "password": "hunter2hunter2"}
    )
    r = client.post(
        "/api/auth/signup", json={"email": "dup@example.com", "password": "hunter2hunter2"}
    )
    assert r.status_code == 409


def test_signup_short_password_rejected(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = TestClient(app)
    r = client.post(
        "/api/auth/signup", json={"email": "a@example.com", "password": "short"}
    )
    assert r.status_code == 422


def test_login_wrong_password_returns_401(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = TestClient(app)
    client.post(
        "/api/auth/signup", json={"email": "a@example.com", "password": "hunter2hunter2"}
    )
    r = client.post(
        "/api/auth/login", json={"email": "a@example.com", "password": "WRONGwrong9999"}
    )
    assert r.status_code == 401


def test_login_success_sets_cookie(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = TestClient(app)
    client.post(
        "/api/auth/signup", json={"email": "a@example.com", "password": "hunter2hunter2"}
    )
    client.cookies.clear()
    r = client.post(
        "/api/auth/login", json={"email": "a@example.com", "password": "hunter2hunter2"}
    )
    assert r.status_code == 200
    assert "pl_session" in r.cookies


def test_get_me_authenticated(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = TestClient(app)
    client.post(
        "/api/auth/signup", json={"email": "a@example.com", "password": "hunter2hunter2"}
    )
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json() == {"authenticated": True, "user_id": 1, "email": "a@example.com"}


def test_get_me_unauthenticated(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = TestClient(app)
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_logout_clears_cookie(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = TestClient(app)
    client.post(
        "/api/auth/signup", json={"email": "a@example.com", "password": "hunter2hunter2"}
    )
    r = client.post("/api/auth/logout")
    assert r.status_code == 200
    # Cookie should be cleared (max-age=0 / empty value).
    set_cookie = r.headers.get("set-cookie", "")
    assert "pl_session=" in set_cookie
