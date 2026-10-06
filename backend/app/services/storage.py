"""Encrypted file storage. Files are encrypted with Fernet (AES-128-CBC + HMAC) before touching disk."""

from pathlib import Path

from ..config import get_settings
from ..security import file_cipher


def _root() -> Path:
    root = Path(get_settings().storage_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _path(key: str) -> Path:
    path = (_root() / key).resolve()
    if _root() not in path.parents:
        raise ValueError("Invalid storage key")
    return path


def save(user_id: str, document_id: str, data: bytes) -> str:
    key = f"{user_id}/{document_id}.bin"
    path = _path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(file_cipher().encrypt(data))
    return key


def load(key: str) -> bytes:
    return file_cipher().decrypt(_path(key).read_bytes())


def delete(key: str) -> None:
    _path(key).unlink(missing_ok=True)
