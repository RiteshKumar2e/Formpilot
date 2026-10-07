"""Vector index over document passages, stored in Turso (libSQL).

Embeddings live in an F32_BLOB column next to the passage text, and nearest-neighbour search runs in
the database with libSQL's `vector_distance_cos`, scoped to the signed-in user's passages. On plain
SQLite, which has no vector functions, the same vectors are scored in-process.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from ..database import uses_libsql
from ..models import Document, DocumentChunk
from .embeddings import get_embedder

CHUNK_CHARS = 500


@dataclass(frozen=True)
class Passage:
    text: str
    source_filename: str
    score: float


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


def index_document(db: Session, doc: Document, text_: str) -> int:
    """Replaces the document's passages in the index. Returns how many were stored."""
    db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
    chunks = chunk_text(text_)
    if not chunks:
        return 0
    embedder = get_embedder()
    vectors = embedder.embed(chunks)
    for position, (chunk, vector) in enumerate(zip(chunks, vectors)):
        db.add(
            DocumentChunk(
                document_id=doc.id, user_id=doc.user_id, position=position, text=chunk, embedder=embedder.name, embedding=vector
            )
        )
    db.flush()
    return len(chunks)


def _reembed_stale(db: Session, user_id: str) -> None:
    """Re-embeds passages written by a different embedding model, so all vectors are comparable."""
    embedder = get_embedder()
    stale = list(db.scalars(select(DocumentChunk).where(DocumentChunk.user_id == user_id, DocumentChunk.embedder != embedder.name)))
    if not stale:
        return
    for chunk, vector in zip(stale, embedder.embed([c.text for c in stale])):
        chunk.embedding = vector
        chunk.embedder = embedder.name
    db.commit()


_NEAREST_SQL = text(
    """
    SELECT c.id, d.filename, vector_distance_cos(c.embedding, :query) AS distance
    FROM document_chunks c JOIN documents d ON d.id = c.document_id
    WHERE c.user_id = :user_id
    ORDER BY distance
    LIMIT :k
    """
)


def search(db: Session, user_id: str, queries: list[str], k: int) -> list[list[Passage]]:
    """For each query, the k passages from the user's documents closest in meaning."""
    if not queries:
        return []
    _reembed_stale(db, user_id)
    query_vectors = get_embedder().embed(queries)

    if uses_libsql(db.get_bind()):
        results = []
        for vector in query_vectors:
            rows = db.execute(_NEAREST_SQL, {"query": vector.astype("<f4").tobytes(), "user_id": user_id, "k": k}).all()
            # Passage text is encrypted, so it's decrypted through the ORM rather than read raw.
            texts = {c.id: c.text for c in db.scalars(select(DocumentChunk).where(DocumentChunk.id.in_([r.id for r in rows])))}
            results.append([Passage(texts[r.id], r.filename, round(1 - float(r.distance), 4)) for r in rows])
        return results

    rows = db.execute(
        select(DocumentChunk.text, DocumentChunk.embedding, Document.filename)
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(DocumentChunk.user_id == user_id)
    ).all()
    if not rows:
        return [[] for _ in queries]
    matrix = np.vstack([r.embedding for r in rows])
    scores = query_vectors @ matrix.T  # cosine similarity: every vector is normalized
    results = []
    for row_scores in scores:
        top = np.argsort(-row_scores)[:k]
        results.append([Passage(rows[i].text, rows[i].filename, round(float(row_scores[i]), 4)) for i in top])
    return results
