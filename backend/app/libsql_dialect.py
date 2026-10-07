"""SQLAlchemy dialect for libSQL, the engine behind Turso.

libSQL speaks SQLite's SQL and file format, so this reuses SQLAlchemy's SQLite dialect and only swaps
the driver for the `libsql` package. URL: ``sqlite+libsql:///./formpilot.db`` for a local file; a
Turso database is connected through `database.make_engine` with its URL and auth token.
"""

import os

from sqlalchemy.dialects import registry
from sqlalchemy.dialects.sqlite.pysqlite import SQLiteDialect_pysqlite


class SQLiteDialect_libsql(SQLiteDialect_pysqlite):
    driver = "libsql"
    supports_statement_cache = True

    @classmethod
    def import_dbapi(cls):
        import libsql

        return libsql

    def on_connect(self):
        # pysqlite registers Python functions (e.g. REGEXP) on connect; libSQL connections can't.
        return None

    def create_connect_args(self, url):
        database = url.database or ":memory:"
        if database != ":memory:":
            database = os.path.abspath(database)
        return [database], {"_check_same_thread": False}


registry.register("sqlite.libsql", __name__, "SQLiteDialect_libsql")
