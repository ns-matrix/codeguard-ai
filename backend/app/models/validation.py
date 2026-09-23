import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, ForeignKey, Numeric, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    validations = relationship("Validation", back_populates="project", cascade="all, delete-orphan")


class Validation(Base):
    __tablename__ = "validations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    language = Column(String(50), nullable=False)
    model = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    score = Column(Integer, nullable=True)
    code = Column(Text, nullable=False)
    code_hash = Column(Text, nullable=False)
    duration_ms = Column(Integer, nullable=True)
    syntax_valid = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="validations")
    issues = relationship("ValidationIssue", back_populates="validation", cascade="all, delete-orphan")
    logs = relationship("ValidationLog", back_populates="validation", cascade="all, delete-orphan")


class ValidationIssue(Base):
    __tablename__ = "validation_issues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    validation_id = Column(UUID(as_uuid=True), ForeignKey("validations.id", ondelete="CASCADE"), nullable=False)
    severity = Column(String(20), nullable=False)
    category = Column(String(50), nullable=False)
    line_number = Column(Integer, nullable=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    confidence = Column(Numeric(5, 4), nullable=True)
    evidence = Column(Text, nullable=True)

    validation = relationship("Validation", back_populates="issues")


class ValidationLog(Base):
    __tablename__ = "validation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    validation_id = Column(UUID(as_uuid=True), ForeignKey("validations.id", ondelete="CASCADE"), nullable=False)
    stage = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    validation = relationship("Validation", back_populates="logs")
