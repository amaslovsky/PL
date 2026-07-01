"""SQLite helpers and schema initialization."""

import sqlite3

from .config import DB_PATH


def get_conn() -> sqlite3.Connection:
    """Open a connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the users table if it does not exist."""
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                email      TEXT    NOT NULL UNIQUE,
                created_at TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.commit()


def upsert_user(email: str) -> int:
    """Insert a user by email or return the existing id."""
    with get_conn() as conn:
        row = conn.execute(
            "INSERT INTO users(email) VALUES(?) "
            "ON CONFLICT(email) DO UPDATE SET email=email "
            "RETURNING id",
            (email,),
        ).fetchone()
        conn.commit()
        return row["id"]
