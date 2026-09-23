import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.database import get_db
from app.models.validation import Project, Validation
from app.models.schemas import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    response = []
    for p in projects:
        count_result = await db.execute(
            select(func.count(Validation.id)).where(Validation.project_id == p.id)
        )
        count = count_result.scalar() or 0
        response.append(ProjectResponse(
            id=p.id,
            name=p.name,
            created_at=p.created_at.isoformat() if p.created_at else None,
            validation_count=count,
        ))
    return response


@router.post("", response_model=ProjectResponse)
async def create_project(req: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(id=uuid.uuid4(), name=req.name)
    db.add(project)
    await db.flush()
    return ProjectResponse(
        id=project.id,
        name=project.name,
        created_at=project.created_at.isoformat() if project.created_at else None,
        validation_count=0,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    count_result = await db.execute(
        select(func.count(Validation.id)).where(Validation.project_id == project.id)
    )
    count = count_result.scalar() or 0
    return ProjectResponse(
        id=project.id,
        name=project.name,
        created_at=project.created_at.isoformat() if project.created_at else None,
        validation_count=count,
    )


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    return {"status": "deleted"}
