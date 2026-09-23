from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.validation import Validation, ValidationIssue
from app.services.validation_service import ValidationService

router = APIRouter(prefix="/api/v1", tags=["stats"])

SEVERITY_ORDER = ("critical", "high", "medium", "low", "info")


def _day_range(start_date, end_date):
    day = start_date
    while day <= end_date:
        yield day
        day = day + timedelta(days=1)


def _counts_by_severity(issues: list[ValidationIssue]) -> dict[str, int]:
    counts = {sev: 0 for sev in SEVERITY_ORDER}
    for issue in issues:
        sev = issue.severity if issue.severity in counts else "low"
        counts[sev] += 1
    return counts


def _validation_summary(v: Validation, issues: list[ValidationIssue]) -> dict[str, Any]:
    counts = _counts_by_severity(issues)
    return {
        "id": str(v.id),
        "language": v.language,
        "model": v.model,
        "status": v.status,
        "score": v.score,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "duration_ms": v.duration_ms,
        "syntax_valid": v.syntax_valid,
        "total_issues": len(issues),
        **counts,
        "issues": [
            {
                "id": str(i.id),
                "severity": i.severity,
                "category": i.category,
                "line_number": i.line_number,
                "title": i.title,
                "description": i.description,
                "recommendation": i.recommendation,
                "confidence": float(i.confidence) if i.confidence else None,
                "evidence": i.evidence,
            }
            for i in issues
        ],
    }


@router.get("/stats")
async def get_stats(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> dict:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_validations = (await db.execute(select(func.count(Validation.id)))).scalar() or 0
    validations_today = (
        await db.execute(select(func.count(Validation.id)).where(Validation.created_at >= today_start))
    ).scalar() or 0
    avg_score = (
        await db.execute(select(func.avg(Validation.score)).where(Validation.score.is_not(None)))
    ).scalar()
    total_issues = (
        await db.execute(
            select(func.count(ValidationIssue.id))
            .join(Validation, ValidationIssue.validation_id == Validation.id)
        )
    ).scalar() or 0
    critical_issues = (
        await db.execute(
            select(func.count(ValidationIssue.id))
            .join(Validation, ValidationIssue.validation_id == Validation.id)
            .where(ValidationIssue.severity == "critical")
        )
    ).scalar() or 0

    status_rows = await db.execute(
        select(Validation.status, func.count(Validation.id)).group_by(Validation.status)
    )
    status_counts = {"passed": 0, "warning": 0, "error": 0}
    for status, count in status_rows.all():
        if status in status_counts:
            status_counts[status] = count

    severity_rows = await db.execute(
        select(ValidationIssue.severity, func.count(ValidationIssue.id))
        .join(Validation, ValidationIssue.validation_id == Validation.id)
        .where(Validation.created_at >= since)
        .group_by(ValidationIssue.severity)
    )
    severity_counts = {sev: 0 for sev in SEVERITY_ORDER}
    for sev, count in severity_rows.all():
        if sev in severity_counts:
            severity_counts[sev] = count

    series_rows = await db.execute(
        select(
            func.date(Validation.created_at).label("day"),
            func.count(Validation.id),
            func.avg(Validation.score),
        )
        .where(Validation.created_at >= since)
        .group_by("day")
        .order_by("day")
    )
    count_by_day: dict[Any, int] = {}
    score_by_day: dict[Any, list[float]] = {}
    for day, count, avg in series_rows.all():
        count_by_day[day] = count
        if avg is not None:
            score_by_day[day] = [float(avg)]
    # Zero-fill every calendar day in range so the chart is a real time axis,
    # not a sparse two-point diagonal that looks simulated.
    series = []
    for day in _day_range(since.date(), now.date()):
        scores = score_by_day.get(day)
        series.append({
            "date": str(day),
            "count": count_by_day.get(day, 0),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        })

    lang_rows = await db.execute(
        select(Validation.language, func.count(Validation.id))
        .where(Validation.created_at >= since)
        .group_by(Validation.language)
        .order_by(func.count(Validation.id).desc())
    )
    languages = [{"language": lang, "count": count} for lang, count in lang_rows.all()]

    security_group = tuple(ValidationService.SECURITY_GROUP)
    if security_group:
        sec_rows = await db.execute(
            select(ValidationIssue.category, func.count(ValidationIssue.id))
            .join(Validation, ValidationIssue.validation_id == Validation.id)
            .where(
                Validation.created_at >= since,
                ValidationIssue.category.in_(security_group),
            )
            .group_by(ValidationIssue.category)
            .order_by(func.count(ValidationIssue.id).desc())
        )
        security_categories = [{"category": cat, "count": count} for cat, count in sec_rows.all()]
        sec_series_rows = await db.execute(
            select(func.date(Validation.created_at).label("day"), func.count(ValidationIssue.id))
            .select_from(ValidationIssue)
            .join(Validation, ValidationIssue.validation_id == Validation.id)
            .where(
                Validation.created_at >= since,
                ValidationIssue.category.in_(security_group),
            )
            .group_by("day")
            .order_by("day")
        )
        sec_count_by_day = {day: count for day, count in sec_series_rows.all()}
        security_series = [
            {"date": str(day), "count": sec_count_by_day.get(day, 0)}
            for day in _day_range(since.date(), now.date())
        ]
    else:
        security_categories = []
        security_series = []

    recent_rows = (
        await db.execute(
            select(Validation).order_by(Validation.created_at.desc()).limit(8)
        )
    ).scalars().all()
    recent = []
    for v in recent_rows:
        issue_rows = (
            await db.execute(
                select(ValidationIssue).where(ValidationIssue.validation_id == v.id)
            )
        ).scalars().all()
        recent.append(_validation_summary(v, issue_rows))

    return {
        "days": days,
        "total_validations": total_validations,
        "validations_today": validations_today,
        "issues_found": total_issues,
        "critical_issues": critical_issues,
        "average_score": round(float(avg_score), 1) if avg_score is not None else None,
        "status_counts": status_counts,
        "severity_counts": severity_counts,
        "series": series,
        "languages": languages,
        "security_categories": security_categories,
        "security_series": security_series,
        "recent": recent,
        "generated_at": now.isoformat(),
    }
