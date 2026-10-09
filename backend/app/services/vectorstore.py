"""Vector index over document passages, stored in Qdrant.

Each passage of a user's documents is embedded and stored as a Qdrant point whose payload holds the
user, the document, the embedding model and the passage text, encrypted with the server's key. Search
is a nearest-neighbour query filtered to the signed-in user, so one account never sees another's data.

With QDRANT_URL set, FormPilot uses that Qdrant server or Qdrant Cloud cluster. Without it, Qdrant runs
inside the backend and keeps its data in QDRANT_PATH (":memory:" in tests).
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlparse

import numpy as np
from cryptography.fernet import InvalidToken
from qdrant_client import QdrantClient, models
from sqlalchemy import inspect, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db_types import EMBEDDING_DIM
from ..models import Document
from ..security import file_cipher
from .embeddings import get_embedder

log = logging.getLogger(__name__)

CHUNK_CHARS = 500


@dataclass(frozen=True)
class Passage:
    text: str
    source_filename: str
    score: float


# --- Qdrant connection ---------------------------------------------------------------------------


@lru_cache
def client() -> QdrantClient:
    settings = get_settings()
    if settings.qdrant_url:
        # qdrant-client defaults to port 6333, which many college and office networks block. Qdrant Cloud
        # also serves on 443, so an https URL without a port uses that.
        parsed = urlparse(settings.qdrant_url)
        port = parsed.port or (443 if parsed.scheme == "https" else 6333)
        qdrant = QdrantClient(url=settings.qdrant_url, port=port, api_key=settings.qdrant_api_key or None, timeout=20)
    elif settings.qdrant_path == ":memory:":
        qdrant = QdrantClient(location=":memory:")
    else:
        qdrant = QdrantClient(path=settings.qdrant_path)
    _ensure_collection(qdrant, settings.qdrant_collection, indexes=bool(settings.qdrant_url))
    return qdrant


def close() -> None:
    """Releases the Qdrant connection (and the local folder's lock) when the server stops."""
    if client.cache_info().currsize:
        client().close()
        client.cache_clear()


def _collection() -> str:
    return get_settings().qdrant_collection


def _ensure_collection(qdrant: QdrantClient, name: str, indexes: bool) -> None:
    if qdrant.collection_exists(name):
        return
    qdrant.create_collection(name, vectors_config=models.VectorParams(size=EMBEDDING_DIM, distance=models.Distance.COSINE))
    if not indexes:
        return  # embedded Qdrant filters without indexes
    for field in ("user_id", "document_id", "embedder"):
        qdrant.create_payload_index(name, field_name=field, field_schema=models.PayloadSchemaType.KEYWORD)


def describe() -> str:
    settings = get_settings()
    if settings.qdrant_url:
        return "Qdrant (server / cloud)"
    return "Qdrant (in-memory)" if settings.qdrant_path == ":memory:" else "Qdrant (local folder)"


def stats() -> dict[str, int | str | None]:
    """Point count of the passages collection, for the admin dashboard."""
    settings = get_settings()
    try:
        return {"points": client().count(settings.qdrant_collection).count, "collection": settings.qdrant_collection, "error": None}
    except Exception as exc:  # the dashboard still loads when Qdrant is unreachable
        log.warning("Qdrant stats unavailable: %s", exc)
        return {"points": None, "collection": settings.qdrant_collection, "error": "Qdrant is unreachable"}


def _match(field: str, value: str) -> models.FieldCondition:
    return models.FieldCondition(key=field, match=models.MatchValue(value=value))


def _encrypt(passage: str) -> str:
    return file_cipher().encrypt(passage.encode()).decode()


def _decrypt(token: str) -> str:
    try:
        return file_cipher().decrypt(token.encode()).decode()
    except InvalidToken:
        return token  # stored before encryption was introduced


# --- Indexing ------------------------------------------------------------------------------------


def chunk_text(text_: str, max_chars: int = CHUNK_CHARS) -> list[str]:
    """Splits text into passages of whole lines, repeating the last line of each passage for context."""
    lines = [re.sub(r"\s+", " ", line).strip() for line in text_.splitlines()]
    lines = [line for line in lines if line]
    chunks: list[str] = []
    current: list[str] = []
    for line in lines:
        if current and sum(len(l) + 1 for l in current) + len(line) > max_chars:
            chunks.append("\n".join(current))
            current = current[-1:]
        current.append(line[:max_chars])
    if current and (not chunks or "\n".join(current) != chunks[-1]):
        chunks.append("\n".join(current))
    return chunks


def delete_document(document_id: str) -> None:
    client().delete(_collection(), points_selector=models.FilterSelector(filter=models.Filter(must=[_match("document_id", document_id)])))


def delete_user(user_id: str) -> None:
    client().delete(_collection(), points_selector=models.FilterSelector(filter=models.Filter(must=[_match("user_id", user_id)])))


def index_document(db: Session, doc: Document, text_: str) -> int:
    """Replaces the document's passages in the index. Returns how many were stored."""
    delete_document(doc.id)
    chunks = chunk_text(text_)
    if not chunks:
        return 0
    embedder = get_embedder()
    vectors = embedder.embed(chunks)
    client().upsert(
        _collection(),
        points=[
            models.PointStruct(
                id=str(uuid.uuid4()),
                vector=vector.tolist(),
                payload={
                    "user_id": doc.user_id,
                    "document_id": doc.id,
                    "position": position,
                    "embedder": embedder.name,
                    "text": _encrypt(chunk),
                },
            )
            for position, (chunk, vector) in enumerate(zip(chunks, vectors))
        ],
    )
    return len(chunks)


def _reembed_stale(user_id: str) -> None:
    """Re-embeds passages written by a different embedding model, so all vectors are comparable."""
    embedder = get_embedder()
    stale, _ = client().scroll(
        _collection(),
        scroll_filter=models.Filter(must=[_match("user_id", user_id)], must_not=[_match("embedder", embedder.name)]),
        limit=1000,
        with_payload=True,
    )
    if not stale:
        return
    vectors = embedder.embed([_decrypt(p.payload["text"]) for p in stale])
    client().upsert(
        _collection(),
        points=[
            models.PointStruct(id=p.id, vector=v.tolist(), payload={**p.payload, "embedder": embedder.name})
            for p, v in zip(stale, vectors)
        ],
    )


# --- Search --------------------------------------------------------------------------------------


def search(db: Session, user_id: str, queries: list[str], k: int) -> list[list[Passage]]:
    """For each query, the k passages from the user's documents closest in meaning."""
    if not queries:
        return []
    _reembed_stale(user_id)
    filenames = {d.id: d.filename for d in db.scalars(select(Document).where(Document.user_id == user_id))}
    results = []
    for vector in get_embedder().embed(queries):
        hits = client().query_points(
            _collection(), query=vector.tolist(), query_filter=models.Filter(must=[_match("user_id", user_id)]), limit=k, with_payload=True
        ).points
        results.append(
            [
                Passage(_decrypt(h.payload["text"]), filenames[h.payload["document_id"]], round(float(h.score), 4))
                for h in hits
                if h.payload["document_id"] in filenames  # skip passages of a document deleted mid-request
            ]
        )
    return results


# --- One-time move from the old database table ----------------------------------------------------


def migrate_from_database(engine: Engine) -> int:
    """Moves passages stored by earlier versions in the `document_chunks` table into Qdrant, then empties it."""
    if "document_chunks" not in inspect(engine).get_table_names():
        return 0
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT document_id, user_id, position, text, embedder, embedding FROM document_chunks")).all()
        if not rows:
            return 0
        points = []
        for document_id, user_id, position, encrypted, embedder, embedding in rows:
            vector = np.frombuffer(embedding, dtype="<f4")
            if vector.shape[0] != EMBEDDING_DIM:
                continue
            points.append(
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector.tolist(),
                    payload={"user_id": user_id, "document_id": document_id, "position": position, "embedder": embedder, "text": encrypted},
                )
            )
        if points:
            client().upsert(_collection(), points=points)
        conn.execute(text("DELETE FROM document_chunks"))
    log.info("Moved %d passages from the database to Qdrant.", len(points))
    return len(points)
