import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.validation import Validation, ValidationIssue
from app.models.schemas import ValidationResponse, IssueResponse

router = APIRouter(prefix="/api/v1/history", tags=["history"])


def _issue_response(i: ValidationIssue) -> IssueResponse:
    return IssueResponse(
        id=i.id,
        severity=i.severity,
        category=i.category,
        line_number=i.line_number,
        title=i.title,
        description=i.description,
        recommendation=i.recommendation,
        confidence=float(i.confidence) if i.confidence else None,
        evidence=i.evidence,
    )


def _validation_response(v: Validation, issues: list[ValidationIssue],
                         include_code: bool = False) -> ValidationResponse:
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for i in issues:
        if i.severity in counts:
            counts[i.severity] += 1
    return ValidationResponse(
        id=v.id,
        language=v.language,
        model=v.model,
        status=v.status,
        score=v.score,
        created_at=v.created_at.isoformat() if v.created_at else None,
        issues=[_issue_response(i) for i in issues],
        total_issues=len(issues),
        duration_ms=v.duration_ms,
        syntax_valid=v.syntax_valid,
        code=v.code if include_code else None,
        code_hash=v.code_hash if include_code else None,
        **counts,
    )


async def _issues_for(db: AsyncSession, validation_id) -> list[ValidationIssue]:
    result = await db.execute(
        select(ValidationIssue).where(ValidationIssue.validation_id == validation_id)
    )
    return list(result.scalars().all())


@router.get("", response_model=list[ValidationResponse])
async def list_history(limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Validation).order_by(Validation.created_at.desc()).limit(limit)
    )
    validations = result.scalars().all()
    response = []
    for v in validations:
        issues = await _issues_for(db, v.id)
        response.append(_validation_response(v, issues))
    return response


@router.get("/{validation_id}", response_model=ValidationResponse)
async def get_validation(validation_id: str, db: AsyncSession = Depends(get_db)):
    try:
        vid = uuid.UUID(validation_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Validation not found")
    result = await db.execute(select(Validation).where(Validation.id == vid))
    validation = result.scalar_one_or_none()
    if not validation:
        raise HTTPException(status_code=404, detail="Validation not found")

    issues = await _issues_for(db, validation.id)
    return _validation_response(validation, issues, include_code=True)
