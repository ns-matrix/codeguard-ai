from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from app.db.database import get_db
from app.services.language_detector import detect_language
from app.services.validation_service import ValidationService

router = APIRouter(prefix="/api/v1", tags=["validation"])


class DetectLanguageRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    filename: Optional[str] = None


class DetectLanguageResponse(BaseModel):
    language: str
    confidence: float
    method: str


class ValidateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: Optional[str] = None
    model: Optional[str] = None
    project_id: Optional[UUID] = None


class FixCodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    issues: list[dict] = []
    language: str
    model: Optional[str] = None
    target: Optional[dict] = None


class FormatRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: Optional[str] = None


@router.post("/detect-language", response_model=DetectLanguageResponse)
async def detect(req: DetectLanguageRequest):
    result = detect_language(req.code, filename=req.filename)
    return DetectLanguageResponse(language=result.language, confidence=result.confidence, method=result.method)


@router.post("/validate")
async def validate(req: ValidateRequest, db: AsyncSession = Depends(get_db)):
    service = ValidationService(db)
    result = await service.validate_code(
        code=req.code,
        language=req.language,
        model=req.model,
        project_id=str(req.project_id) if req.project_id else None,
    )
    return result


@router.post("/fix")
async def fix_code(req: FixCodeRequest, db: AsyncSession = Depends(get_db)):
    service = ValidationService(db)
    lang = req.language
    if not lang or lang == "auto":
        lang = detect_language(req.code).language
    result = await service.fix_code(req.code, req.issues, lang, req.model, target=req.target)
    return result


@router.post("/format")
async def format_code(req: FormatRequest):
    service = ValidationService(None)
    return await service.format_code(req.code, req.language)


@router.post("/explain")
async def explain(req: ValidateRequest, db: AsyncSession = Depends(get_db)):
    service = ValidationService(db)
    lang = req.language
    if not lang or lang == "auto":
        lang = detect_language(req.code).language
    result = await service.explain_code(req.code, lang, req.model)
    return result


@router.post("/find-bugs")
async def find_bugs(req: ValidateRequest, db: AsyncSession = Depends(get_db)):
    service = ValidationService(db)
    lang = req.language
    if not lang or lang == "auto":
        lang = detect_language(req.code).language
    result = await service.find_bugs(req.code, lang, req.model)
    return result


@router.post("/security-scan")
async def security_scan(req: ValidateRequest, db: AsyncSession = Depends(get_db)):
    service = ValidationService(db)
    lang = req.language
    if not lang or lang == "auto":
        lang = detect_language(req.code).language
    result = await service.security_scan(req.code, lang, req.model)
    return result


@router.post("/optimize")
async def optimize(req: ValidateRequest, db: AsyncSession = Depends(get_db)):
    service = ValidationService(db)
    lang = req.language
    if not lang or lang == "auto":
        lang = detect_language(req.code).language
    result = await service.optimize_code(req.code, lang, req.model)
    return result


@router.post("/generate-tests")
async def generate_tests(req: ValidateRequest, db: AsyncSession = Depends(get_db)):
    service = ValidationService(db)
    lang = req.language
    if not lang or lang == "auto":
        lang = detect_language(req.code).language
    result = await service.generate_tests(req.code, lang, req.model)
    return result


@router.post("/document")
async def document(req: ValidateRequest, db: AsyncSession = Depends(get_db)):
    service = ValidationService(db)
    lang = req.language
    if not lang or lang == "auto":
        lang = detect_language(req.code).language
    result = await service.document_code(req.code, lang, req.model)
    return result
