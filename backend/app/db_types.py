"""Column types for encrypted user data."""

import json
from typing import Any

from cryptography.fernet import InvalidToken
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from .security import file_cipher

EMBEDDING_DIM = 384  # size of the vectors stored in Qdrant (bge-small-en-v1.5)


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
