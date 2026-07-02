"""Tests for the /api/documents* CRUD routes."""

import os

os.environ.setdefault("OPENROUTER_API_KEY", "test")  # module-scope fail-fast bypass


def _signup(client, email="a@example.com", password="hunter2hunter2"):
    return client.post("/api/auth/signup", json={"email": email, "password": password})


def _sample_mnda() -> dict:
    return {
        "party1": {"name": "Acme Inc.", "address": "1 Acme Way"},
        "party2": {"name": "BetaCo", "address": "2 Beta St"},
        "purpose": "Evaluating a partnership.",
        "effectiveDate": "2026-06-30",
        "effectiveDateDisplay": "June 30, 2026",
        "ndaTerm": {"mode": "expires", "years": 2},
        "confidentialityTerm": {"mode": "years", "years": 3},
        "governingLaw": "Delaware",
        "jurisdiction": "New Castle County, Delaware",
    }


def test_post_document_requires_auth(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app)
    r = client.post(
        "/api/documents",
        json={"document_type": "mnda", "data": _sample_mnda()},
    )
    assert r.status_code == 401


def test_post_and_list_document(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app)
    _signup(client)
    r = client.post(
        "/api/documents",
        json={"document_type": "mnda", "data": _sample_mnda()},
    )
    assert r.status_code == 200, r.text
    doc_id = r.json()["id"]

    listed = client.get("/api/documents")
    assert listed.status_code == 200
    rows = listed.json()
    assert len(rows) == 1
    assert rows[0]["id"] == doc_id
    assert rows[0]["data"]["party1"]["name"] == "Acme Inc."


def test_get_document_returns_owned(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app)
    _signup(client)
    r = client.post(
        "/api/documents",
        json={"document_type": "mnda", "data": _sample_mnda()},
    )
    doc_id = r.json()["id"]
    fetched = client.get(f"/api/documents/{doc_id}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["purpose"] == "Evaluating a partnership."


def test_get_document_404_for_other_user(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app)
    _signup(client, email="a@example.com")
    r = client.post(
        "/api/documents",
        json={"document_type": "mnda", "data": _sample_mnda()},
    )
    doc_id = r.json()["id"]

    # New user; same DB; should not see the first user's doc.
    client.cookies.clear()
    _signup(client, email="b@example.com")
    fetched = client.get(f"/api/documents/{doc_id}")
    assert fetched.status_code == 404


def test_delete_document(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app)
    _signup(client)
    r = client.post(
        "/api/documents",
        json={"document_type": "mnda", "data": _sample_mnda()},
    )
    doc_id = r.json()["id"]
    deleted = client.delete(f"/api/documents/{doc_id}")
    assert deleted.status_code == 200
    listed = client.get("/api/documents")
    assert listed.json() == []


def test_post_document_rejects_bad_data(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app)
    _signup(client)
    bad = _sample_mnda()
    bad["ndaTerm"]["years"] = 0  # below ge=1
    r = client.post(
        "/api/documents",
        json={"document_type": "mnda", "data": bad},
    )
    assert r.status_code == 422


def test_post_document_rejects_unknown_type(monkeypatch_tmp_db):
    from app import db as dbmod

    dbmod.DB_PATH = monkeypatch_tmp_db
    dbmod.init_db()
    from app.main import app

    client = __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app)
    _signup(client)
    r = client.post(
        "/api/documents",
        json={"document_type": "nope-not-a-real-doc", "data": {}},
    )
    assert r.status_code == 400
