"""SQLAlchemy engine, session factory, and init helper."""
from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


_engine = create_engine(
    settings().db_url,
    connect_args={"check_same_thread": False}
    if settings().db_url.startswith("sqlite")
    else {},
    future=True,
)

SessionLocal = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False, future=True)


def init_db() -> None:
    """Create all tables. Imported models register themselves on Base."""
    from app.database import models  # noqa: F401  (ensure models are imported)

    Base.metadata.create_all(bind=_engine)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
