from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import Settings, get_settings


class Base(DeclarativeBase):
    pass


def make_engine(settings: Settings) -> Engine:
    """SQLite file for local development; PostgreSQL (or any SQLAlchemy URL) in production."""
    url = settings.database_url
    if not url.startswith("sqlite"):
        return create_engine(url, pool_pre_ping=True)

    engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_conn, _record):  # pragma: no cover - driver hook
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


engine = make_engine(get_settings())
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def describe(bind) -> str:
    """The database in use, for the AI engine status page."""
    name = bind.dialect.name
    if name == "sqlite":
        return "SQLite (local file)"
    if name == "postgresql":
        return "PostgreSQL"
    return name


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
