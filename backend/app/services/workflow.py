"""A small workflow engine: runs named steps in order and records each one.

Every run is saved with the status, duration and outcome of each step, so a user (or an integration
calling the API) can see exactly what happened to a document or a form: which steps ran, which were
skipped, and why.

    run = WorkflowRunner(db, user_id, "document_ingestion", subject_id=doc.id)
    with run.step("read_text") as step:
        text = read(...)
        step.detail = f"{pages} pages"
    run.skip("llm_extraction", "No LLM configured")
    run.finish()
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator

from sqlalchemy.orm import Session

from ..models import WorkflowRun


class StepRecord:
    def __init__(self, name: str):
        self.name = name
        self.status = "running"
        self.detail: str | None = None
        self.duration_ms = 0

    def as_dict(self) -> dict:
        return {"name": self.name, "status": self.status, "detail": self.detail, "duration_ms": self.duration_ms}


class WorkflowRunner:
    def __init__(self, db: Session, user_id: str, workflow: str, subject_id: str | None = None):
        self.db = db
        self.steps: list[StepRecord] = []
        self.run = WorkflowRun(user_id=user_id, workflow=workflow, subject_id=subject_id, status="running", steps=[])
        db.add(self.run)

    @contextmanager
    def step(self, name: str) -> Iterator[StepRecord]:
        record = StepRecord(name)
        self.steps.append(record)
        started = time.perf_counter()
        try:
            yield record
        except Exception as exc:
            record.status = "failed"
            record.detail = record.detail or str(exc)[:300]
            raise
        else:
            if record.status == "running":
                record.status = "completed"
        finally:
            record.duration_ms = round((time.perf_counter() - started) * 1000)
            self._save()

    def skip(self, name: str, reason: str) -> None:
        record = StepRecord(name)
        record.status = "skipped"
        record.detail = reason
        self.steps.append(record)
        self._save()

    def finish(self, status: str | None = None) -> WorkflowRun:
        failed = any(s.status == "failed" for s in self.steps)
        self.run.status = status or ("failed" if failed else "completed")
        self.run.finished_at = datetime.now(timezone.utc)
        self._save()
        return self.run

    def _save(self) -> None:
        # Assign a new list so SQLAlchemy sees the change to the (encrypted JSON) column.
        self.run.steps = [s.as_dict() for s in self.steps]
