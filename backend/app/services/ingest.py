"""Document ingestion workflow: read -> extract (rules + LLM) -> validate -> index for retrieval."""

from __future__ import annotations

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from ..models import Document, ExtractedField
from . import integrations
from .embeddings import get_embedder
from .extraction import decide, extract_fields, llm_fields, merge_extractions, read_text
from .llm import llm_available
from .vectorstore import index_document
from .workflow import WorkflowRunner


def ingest_document(db: Session, doc: Document, data: bytes, background: BackgroundTasks | None = None) -> None:
    run = WorkflowRunner(db, doc.user_id, "document_ingestion", subject_id=doc.id)

    with run.step("read_text") as step:
        text, pages, early = read_text(data, doc.content_type)
        step.detail = early.message if early else f"{len(text or '')} characters from {pages} page(s)"
        if early:
            step.status = "failed" if early.status == "failed" else "completed"

    if early is not None:
        for name in ("rule_extraction", "llm_extraction", "validation", "vector_indexing"):
            run.skip(name, "No readable text.")
        doc.status, doc.message, doc.page_count = early.status, early.message, early.page_count
        run.finish("failed" if early.status == "failed" else "completed")
        return
    assert text is not None

    with run.step("rule_extraction") as step:
        fields = extract_fields(text)
        step.detail = f"{len(fields)} field(s) found by pattern rules"

    if llm_available():
        with run.step("llm_extraction") as step:
            model_fields = llm_fields(text)
            if model_fields is None:
                step.status = "failed"
                step.detail = "The LLM was unavailable; kept the rule-based results."
            else:
                before = len(fields)
                fields = merge_extractions(fields, model_fields, text)
                step.detail = f"LLM proposed {len(model_fields)} field(s); {len(fields)} kept after grounding ({before} from rules)"
    else:
        run.skip("llm_extraction", "No LLM configured (set GROQ_API_KEY).")

    with run.step("validation") as step:
        result = decide(fields, pages)
        low = [f.key for f in result.fields if f.confidence < 0.7]
        step.detail = f"Status {result.status}" + (f"; low confidence: {', '.join(low)}" if low else "")

    with run.step("vector_indexing") as step:
        count = index_document(db, doc, text)
        step.detail = f"{count} passage(s) embedded with {get_embedder().name}"

    doc.status, doc.message, doc.page_count = result.status, result.message, result.page_count
    for f in result.fields:
        db.add(ExtractedField(document_id=doc.id, user_id=doc.user_id, key=f.key, label=f.label, value=f.value, confidence=f.confidence))
    run.finish()
    integrations.emit(
        db, background, doc.user_id, "document.processed",
        {"document_id": doc.id, "filename": doc.filename, "status": doc.status, "fields": [f.key for f in result.fields]},
    )
