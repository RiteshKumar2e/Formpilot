"""Encrypted file storage. Files are encrypted with Fernet (AES-128-CBC + HMAC) and kept in the database
(table `stored_files`), so they last exactly as long as the rest of the data, even on hosts whose disk is
wiped on restart. Each call uses the caller's session, so a file is saved or removed in the same
transaction as its document. Files saved to STORAGE_DIR by earlier versions are still read and deleted there.
"""

from pathlib import Path

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import StoredFile
from ..security import file_cipher


def _legacy_path(key: str) -> Path:
    root = Path(get_settings().storage_dir).resolve()
    path = (root / key).resolve()
    if root not in path.parents:
        raise ValueError("Invalid storage key")
    return path


def save(db: Session, user_id: str, document_id: str, data: bytes) -> str:
    key = f"{user_id}/{document_id}.bin"
    _legacy_path(key)  # validates the key's shape
    db.merge(StoredFile(key=key, data=file_cipher().encrypt(data)))
    return key


def load(db: Session, key: str) -> bytes:
    row = db.get(StoredFile, key)
    if row is not None:
        return file_cipher().decrypt(row.data)
    return file_cipher().decrypt(_legacy_path(key).read_bytes())  # OSError if it's gone


def delete(db: Session, key: str) -> None:
    row = db.get(StoredFile, key)
    if row is not None:
        db.delete(row)
    _legacy_path(key).unlink(missing_ok=True)
