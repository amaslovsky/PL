"""SQLite helpers and schema initialization."""

import sqlite3

from .config import DB_PATH


def get_conn() -> sqlite3.Connection:
    """Open a connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create the users and documents tables if they do not exist."""
    with get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT    NOT NULL UNIQUE,
                password_hash TEXT    NOT NULL,
                created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                document_type TEXT    NOT NULL,
                data_json     TEXT    NOT NULL,
                created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id)"
        )
        conn.commit()


def find_user_by_email(email: str) -> sqlite3.Row | None:
    """Return the user row matching `email`, or None."""
    with get_conn() as conn:
        return conn.execute(
            "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
            (email,),
        ).fetchone()


def find_user_by_id(user_id: int) -> sqlite3.Row | None:
    """Return the user row matching `user_id`, or None."""
    with get_conn() as conn:
        return conn.execute(
            "SELECT id, email, password_hash, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()


def create_user(email: str, password_hash: str) -> int:
    """Insert a user and return the new row id."""
    with get_conn() as conn:
        row = conn.execute(
            "INSERT INTO users(email, password_hash) VALUES(?, ?) RETURNING id",
            (email, password_hash),
        ).fetchone()
        conn.commit()
        return row["id"]


def create_document(user_id: int, document_type: str, data_json: str) -> int:
    """Insert a document row and return its id."""
    with get_conn() as conn:
        row = conn.execute(
            "INSERT INTO documents(user_id, document_type, data_json) "
            "VALUES(?, ?, ?) RETURNING id",
            (user_id, document_type, data_json),
        ).fetchone()
        conn.commit()
        return row["id"]


def update_document(doc_id: int, user_id: int, data_json: str) -> bool:
    """Overwrite a document's data_json. Returns False if no row was updated."""
    with get_conn() as conn:
        cursor = conn.execute(
            "UPDATE documents SET data_json = ?, updated_at = datetime('now') "
            "WHERE id = ? AND user_id = ?",
            (data_json, doc_id, user_id),
        )
        conn.commit()
        return cursor.rowcount > 0


def delete_document(doc_id: int, user_id: int) -> bool:
    """Delete a document if it belongs to `user_id`. Returns False if no row was deleted."""
    with get_conn() as conn:
        cursor = conn.execute(
            "DELETE FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id),
        )
        conn.commit()
        return cursor.rowcount > 0


def list_documents(user_id: int) -> list[sqlite3.Row]:
    """Return every document belonging to `user_id`, newest first."""
    with get_conn() as conn:
        return conn.execute(
            "SELECT id, document_type, data_json, created_at, updated_at "
            "FROM documents WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()


def get_document(doc_id: int, user_id: int) -> sqlite3.Row | None:
    """Return a single document owned by `user_id`, or None."""
    with get_conn() as conn:
        return conn.execute(
            "SELECT id, user_id, document_type, data_json, created_at, updated_at "
            "FROM documents WHERE id = ? AND user_id = ?",
            (doc_id, user_id),
        ).fetchone()
