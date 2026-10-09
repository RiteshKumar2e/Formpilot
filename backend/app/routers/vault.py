"""Application Vault: Common Answers, Smart Answers, templates, and the browser-extension autofill API."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import ApplicationTemplate, SavedAnswer, User
from ..ratelimit import ai_rate_limit
from ..schemas import (
    AutofillIn,
    AutofillSuggestOut,
    SavedAnswerIn,
    SavedAnswerOut,
    SmartAnswerIn,
    SmartAnswerOut,
    SmartAnswerSourceOut,
    TemplateFieldIn,
    TemplateIn,
    TemplateMatchIn,
    TemplateMatchOut,
    TemplateOut,
)
from ..services import autofill
from ..services.answers import suggest_answer
from ..services.templates import best_match, reusable_answers

router = APIRouter(tags=["vault"])

MAX_SAVED_ANSWERS = 100
MAX_TEMPLATES = 50


# --- Common answers --------------------------------------------------------------------------


def _owned_answer(db: Session, user: User, answer_id: str) -> SavedAnswer:
    answer = db.get(SavedAnswer, answer_id)
    if answer is None or answer.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Answer not found.")
    return answer


@router.get("/answers", response_model=list[SavedAnswerOut])
def list_answers(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[SavedAnswer]:
    return list(db.scalars(select(SavedAnswer).where(SavedAnswer.user_id == user.id).order_by(SavedAnswer.updated_at.desc())))


@router.post("/answers", response_model=SavedAnswerOut, status_code=status.HTTP_201_CREATED)
def create_answer(payload: SavedAnswerIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SavedAnswer:
    if len(list(db.scalars(select(SavedAnswer.id).where(SavedAnswer.user_id == user.id)))) >= MAX_SAVED_ANSWERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You can save up to {MAX_SAVED_ANSWERS} answers.")
    answer = SavedAnswer(user_id=user.id, question=payload.question.strip(), answer=payload.answer.strip())
    db.add(answer)
    db.commit()
    return answer


@router.put("/answers/{answer_id}", response_model=SavedAnswerOut)
def update_answer(answer_id: str, payload: SavedAnswerIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SavedAnswer:
    answer = _owned_answer(db, user, answer_id)
    answer.question, answer.answer = payload.question.strip(), payload.answer.strip()
    db.commit()
    return answer


@router.delete("/answers/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_answer(answer_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(_owned_answer(db, user, answer_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/answers/suggest", response_model=SmartAnswerOut, dependencies=[Depends(ai_rate_limit)])
def smart_answer(payload: SmartAnswerIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> SmartAnswerOut:
    """Suggests an answer to an open question from the profile, documents and saved answers. Never saved automatically."""
    s = suggest_answer(db, user, payload.question, payload.organization, payload.role, payload.max_words)
    return SmartAnswerOut(
        answer=s.answer, method=s.method, sources=[SmartAnswerSourceOut(type=r.type, label=r.label, detail=r.detail) for r in s.sources]
    )


# --- Templates -------------------------------------------------------------------------------


def _template_out(t: ApplicationTemplate) -> TemplateOut:
    data = t.data or {}
    fields = [TemplateFieldIn.model_validate(f) for f in data.get("fields", [])]
    return TemplateOut(
        id=t.id,
        name=t.name,
        application_type=t.application_type,
        organization=data.get("organization"),
        fields=fields,
        documents=data.get("documents", []),
        common_answers=[TemplateFieldIn.model_validate(f) for f in reusable_answers(t)],
        completed=sum(1 for f in fields if f.value),
        total=len(fields),
        use_count=t.use_count,
        created_at=t.created_at,
    )


def _owned_template(db: Session, user: User, template_id: str) -> ApplicationTemplate:
    template = db.get(ApplicationTemplate, template_id)
    if template is None or template.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found.")
    return template


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TemplateOut]:
    rows = db.scalars(select(ApplicationTemplate).where(ApplicationTemplate.user_id == user.id).order_by(ApplicationTemplate.created_at.desc()))
    return [_template_out(t) for t in rows]


@router.post("/templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(payload: TemplateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TemplateOut:
    if len(list(db.scalars(select(ApplicationTemplate.id).where(ApplicationTemplate.user_id == user.id)))) >= MAX_TEMPLATES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You can save up to {MAX_TEMPLATES} templates.")
    template = ApplicationTemplate(
        user_id=user.id,
        name=payload.name.strip(),
        application_type=payload.application_type,
        data={
            "organization": payload.organization,
            "fields": [f.model_dump() for f in payload.fields],
            "documents": list(dict.fromkeys(payload.documents)),
        },
    )
    db.add(template)
    db.commit()
    return _template_out(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(template_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    db.delete(_owned_template(db, user, template_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/templates/match", response_model=TemplateMatchOut | None)
def match_template(payload: TemplateMatchIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TemplateMatchOut | None:
    """The saved template most similar to a form with these labels, if any is similar enough."""
    match = best_match(db, user.id, payload.labels)
    if match is None:
        return None
    return TemplateMatchOut(id=match.template.id, name=match.template.name, score=match.score, reusable=match.reusable)


@router.post("/templates/{template_id}/use", response_model=TemplateOut)
def use_template(template_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TemplateOut:
    template = _owned_template(db, user, template_id)
    template.use_count += 1
    db.commit()
    return _template_out(template)


# --- Browser extension ------------------------------------------------------------------------


@router.post("/autofill/suggest", response_model=AutofillSuggestOut, dependencies=[Depends(ai_rate_limit)])
def autofill_suggest(payload: AutofillIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AutofillSuggestOut:
    """Suggested values for the fields of a form on another website. FormPilot never submits the form."""
    fields, summary, template, workflow_id, documents, profile = autofill.suggest(
        db, user, payload.fields, payload.page_title, payload.organization, payload.role
    )
    return AutofillSuggestOut(
        fields=fields, summary=summary, template=template, workflow_id=workflow_id, documents=documents, profile=profile
    )
