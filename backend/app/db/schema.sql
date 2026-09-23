-- CodeGuard AI Database Schema
-- PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    language VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    score INTEGER,
    code TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_id UUID REFERENCES validations(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    line_number INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    recommendation TEXT,
    confidence NUMERIC(5,4),
    evidence TEXT
);

CREATE TABLE IF NOT EXISTS validation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    validation_id UUID REFERENCES validations(id) ON DELETE CASCADE,
    stage VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_validations_project ON validations(project_id);
CREATE INDEX idx_validations_created ON validations(created_at DESC);
CREATE INDEX idx_validation_issues_validation ON validation_issues(validation_id);
CREATE INDEX idx_validation_logs_validation ON validation_logs(validation_id);
