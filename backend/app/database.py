from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import libsql_dialect  # noqa: F401  (registers sqlite+libsql)
from .config import Settings, get_settings


class Base(DeclarativeBase):
    pass


def make_engine(settings: Settings) -> Engine:
    if settings.turso_database_url:
        import libsql

        def connect():
            return libsql.connect(settings.turso_database_url, auth_token=settings.turso_auth_token)

        engine = create_engine("sqlite+libsql://", creator=connect, pool_pre_ping=True)
    elif settings.database_url.startswith("sqlite+libsql"):
        engine = create_engine(settings.database_url)
    elif settings.database_url.startswith("sqlite"):
        engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
    else:
        return create_engine(settings.database_url, pool_pre_ping=True)

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_conn, _record):  # pragma: no cover - driver hook
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


engine = make_engine(get_settings())
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def uses_libsql(bind) -> bool:
    """libSQL (local file or Turso) has native vector functions; plain SQLite doesn't."""
    return bind.dialect.driver == "libsql"


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
