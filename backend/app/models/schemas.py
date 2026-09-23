from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class IssueBase(BaseModel):
    severity: str
    category: str
    line_number: Optional[int] = None
    title: str
    description: Optional[str] = None
    recommendation: Optional[str] = None
    confidence: Optional[float] = None
    evidence: Optional[str] = None


class IssueCreate(IssueBase):
    pass


class IssueResponse(IssueBase):
    id: UUID

    class Config:
        from_attributes = True


class ValidationBase(BaseModel):
    language: str
    model: str
    code: str


class ValidationCreate(ValidationBase):
    project_id: Optional[UUID] = None


class ValidationResponse(BaseModel):
    id: UUID
    language: str
    model: str
    status: str
    score: Optional[int] = None
    created_at: Optional[str] = None
    issues: list[IssueResponse] = []
    total_issues: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    info: int = 0
    duration_ms: Optional[int] = None
    syntax_valid: Optional[bool] = None
    code: Optional[str] = None
    code_hash: Optional[str] = None

    class Config:
        from_attributes = True


class ValidationSummary(BaseModel):
    validation_id: UUID
    status: str
    language: str
    model: str
    score: Optional[int] = None
    total_issues: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    issues: list[IssueResponse] = []
    corrected_code: Optional[str] = None


class DetectLanguageRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)


class DetectLanguageResponse(BaseModel):
    language: str
    confidence: float


class ValidateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    language: Optional[str] = None
    model: Optional[str] = None
    project_id: Optional[UUID] = None


class FixCodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100_000)
    issues: list[IssueBase] = []
    language: str
    model: Optional[str] = None


class FixCodeResponse(BaseModel):
    original_code: str
    fixed_code: str
    explanation: str


class OllamaModel(BaseModel):
    name: str
    size: Optional[int] = None
    modified_at: Optional[str] = None


class OllamaStatus(BaseModel):
    connected: bool
    endpoint: str
    models: list[OllamaModel] = []
    error: Optional[str] = None
    default_model: Optional[str] = None


class AppConfig(BaseModel):
    app_name: str
    app_version: str
    default_model: str
    max_code_length: int
    llm_timeout: int
    validation_timeout: int
    debug: bool
    temperature: float
    num_predict: int
    score_penalties: dict[str, int]


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    created_at: Optional[str] = None
    validation_count: int = 0

    class Config:
        from_attributes = True
