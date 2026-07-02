"""SQLAlchemy database setup: engine, session factory, declarative models."""

import os
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# Match the legacy env-var name; the new code reads this single source.
DB_PATH: str = os.getenv("DB_PATH", "/app/data/app.db")

# SQLite needs check_same_thread=False when used from FastAPI's threadpool.
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db() -> None:
    """Create every table that hasn't been created yet.

    Idempotent: safe to call on every startup. The container's entrypoint
    drops the DB file on each start so the schema is rebuilt from scratch
    — this call just makes the first boot deterministic.
    """
    Base.metadata.create_all(bind=engine)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    documents = relationship(
        "Document",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_type = Column(String, nullable=False)
    data_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="documents")