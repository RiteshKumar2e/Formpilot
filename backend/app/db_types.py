"""Column types for encrypted user data and embeddings."""

import json
from typing import Any

import numpy as np
from cryptography.fernet import InvalidToken
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator, UserDefinedType

from .security import file_cipher

EMBEDDING_DIM = 384


class EncryptedText(TypeDecorator):
    """Text encrypted with the server's Fernet key before it reaches the database.

    Rows written before encryption was introduced are read back as-is.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        return file_cipher().encrypt(value.encode()).decode()

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if value is None:
            return None
        try:
            return file_cipher().decrypt(value.encode()).decode()
        except InvalidToken:
            return value


class EncryptedJSON(TypeDecorator):
    impl = EncryptedText
    cache_ok = True

    def process_bind_param(self, value: Any, dialect) -> str | None:
        return None if value is None else json.dumps(value, separators=(",", ":"))

    def process_result_value(self, value: str | None, dialect) -> Any:
        return None if value is None else json.loads(value)


class F32Blob(UserDefinedType):
    """libSQL's native vector column, F32_BLOB(n): packed little-endian float32 values.

    Plain SQLite accepts the type name too and stores the same bytes as a BLOB.
    """

    cache_ok = True

    def get_col_spec(self, **kw) -> str:
        return f"F32_BLOB({EMBEDDING_DIM})"


class Embedding(TypeDecorator):
    impl = F32Blob
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return None if value is None else np.asarray(value, dtype="<f4").tobytes()

    def process_result_value(self, value, dialect):
        return None if value is None else np.frombuffer(value, dtype="<f4")
