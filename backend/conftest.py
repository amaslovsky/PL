"""Shared pytest fixtures."""

import os

# The chat module reads OPENROUTER_API_KEY at import time and fails fast
# when unset. Every test that loads app.main (directly or transitively)
# needs this in place, so do it before any app imports.
os.environ.setdefault("OPENROUTER_API_KEY", "test-key-not-used")

import tempfile

import pytest


@pytest.fixture
def monkeypatch_tmp_db(monkeypatch):
    """Yield a unique temp file path for the SQLite DB; clean up after."""
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    os.unlink(path)
    from app import db as dbmod

    monkeypatch.setattr(dbmod, "DB_PATH", path, raising=False)
    yield path
    if os.path.exists(path):
        os.unlink(path)