# CodeGuard AI

LLM-powered code validation and review platform. Paste code, auto-detect the language, run deterministic checks + local Ollama analysis, and get errors, security issues, fixes, and a validation report.

**Repo:** https://github.com/ns-matrix/codeguard-ai

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Setup (step by step)](#setup-step-by-step)
  - [1. Clone the repo](#1-clone-the-repo)
  - [2. Database](#2-database)
  - [3. Environment file](#3-environment-file)
  - [4. Backend](#4-backend)
  - [5. Frontend](#5-frontend)
  - [6. Ollama](#6-ollama)
  - [7. Run the app](#7-run-the-app)
- [Docker setup](#docker-setup)
- [Tests](#tests)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

| Area | What you get |
|------|----------------|
| Validate | Full pipeline: language detect → syntax → security → LLM analysis |
| Fix | AI-suggested corrected code with diff |
| Explain / Bugs / Security / Optimize / Tests / Docs | Focused LLM actions |
| Format | Deterministic code formatting |
| History | Past validations stored in Postgres/Supabase |
| Dashboard | Scores, charts, recent activity |
| Offline-friendly | Deterministic checks still run if Ollama is down |

**Supported languages:** Python, JavaScript, TypeScript, Java, C, C++, Go, Rust, PHP, HTML, CSS, SQL, JSON, YAML, Bash

---

## Architecture

```
Browser (React + Monaco + Tailwind)
        │
   REST  /api  (Vite proxy → backend)
        │
   FastAPI (port 8001)
        │
   ┌────┼────────────────┐
   │    │                │
Language  Static       Security
Detector  Validators   Scanner
   │    │                │
   └────┼────────────────┘
        │
   Validation Orchestrator
        │
   Ollama (local LLM)     PostgreSQL / Supabase
```

**Design principle:** Ollama is the reasoning layer, not the whole engine. Deterministic checks run first; the LLM adds analysis with context.

---

## Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Python | 3.11+ | Backend |
| Node.js | 18+ (20 LTS recommended) | Frontend |
| npm | comes with Node | Frontend packages |
| PostgreSQL **or** Supabase | 14+ | Database |
| Ollama | Latest | Local LLM |
| Docker *(optional)* | Latest | One-command full stack |

---

## Quick start

```bash
git clone https://github.com/ns-matrix/codeguard-ai.git
cd codeguard-ai

# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
# edit backend/.env (database URL), then:
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1

# Linux / macOS
./scripts/setup.sh
# edit backend/.env, then:
./scripts/dev.sh
```

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | App UI |
| http://localhost:8001/api/health | Backend health |
| http://localhost:8001/docs | Swagger UI |

Stop servers:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1
# or ./scripts/stop.sh
```

---

## Setup (step by step)

### 1. Clone the repo

```bash
git clone https://github.com/ns-matrix/codeguard-ai.git
cd codeguard-ai
```

### 2. Database

Pick **one** option.

#### Option A — Local PostgreSQL

```sql
-- connect as superuser
CREATE DATABASE code_validator;
```

Connection string for `.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/code_validator
```

If the database does not exist yet, you can create it with:

```bash
cd backend
ADMIN_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/postgres" python create_db.py
```

#### Option B — Supabase (hosted)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database → Connection string → Session pooler** (port `5432`).
3. Use the **Session** pooler (not Transaction) — better fit for SQLAlchemy/asyncpg.
4. Put the URI in `backend/.env` as `DATABASE_URL`, prefixing with `postgresql+asyncpg://` if needed.

Example:

```env
DATABASE_URL=postgresql+asyncpg://postgres.YOUR_REF:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

**Supabase notes:**

- Username is `postgres.<project-ref>` (not bare `postgres`).
- Region in the host must match your project (e.g. `aws-0-ap-south-1`).
- Direct host `db.<ref>.supabase.co` is often **IPv6-only** — use the Session pooler on IPv4 networks.
- SSL is forced automatically for `supabase` / `amazonaws.com` hosts. If TLS is blocked on your network, append `?ssl=disable`.
- Tables are created automatically on backend startup (`init_db`).
- **Tests do not use Supabase** — they use a local `code_validator_test` database (see `backend/tests/conftest.py`).

#### Option C — Docker Postgres only

Skip manual SQL — `docker compose up db` starts Postgres with `postgres` / `postgres` / `code_validator`.

### 3. Environment file

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Local Postgres
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@localhost:5432/code_validator

# — or — Supabase Session pooler
# DATABASE_URL=postgresql+asyncpg://postgres.REF:PASSWORD@aws-0-....pooler.supabase.com:5432/postgres

OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=deepseek-r1:7b-fast
OLLAMA_TEMPERATURE=0.1
OLLAMA_NUM_PREDICT=4096
DEBUG=false
```

> **Never commit `backend/.env`.** It is gitignored. Only `.env.example` is in the repo.

`scripts/setup.*` creates `.env` from the example automatically if missing.

### 4. Backend

```bash
cd backend

# virtualenv (recommended)
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
```

Start:

```bash
uvicorn app.main:app --reload --port 8001
```

Verify:

- http://localhost:8001/api/health → `{"status":"healthy", ...}`
- http://localhost:8001/docs → Swagger UI

### 5. Frontend

```bash
cd frontend
npm install          # or: npm ci
npm run dev
```

Opens at **http://localhost:5173**.

Vite proxies `/api` → `http://localhost:8001` (see `frontend/vite.config.ts`).

### 6. Ollama

1. Install: https://ollama.ai
2. Pull the default model:

```bash
ollama pull deepseek-r1:7b-fast
```

Optional models:

```bash
ollama pull qwen2.5-coder:7b
ollama pull deepseek-r1:7b
ollama pull codellama:7b
ollama pull llama3.1:8b
```

3. Verify: http://localhost:11434/api/tags

> Backend works without Ollama for deterministic checks; LLM actions need Ollama running.

### 7. Run the app

| Process | Command | URL |
|---------|---------|-----|
| Backend | `uvicorn app.main:app --reload --port 8001` (from `backend/`) | http://localhost:8001 |
| Frontend | `npm run dev` (from `frontend/`) | http://localhost:5173 |

Or use the helper scripts (start both):

```powershell
# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

```bash
# Linux / macOS
./scripts/setup.sh
./scripts/dev.sh
```

---

## Docker setup

One command for Postgres + backend + frontend:

```bash
docker compose up --build
```

| Service | Port | Notes |
|---------|------|-------|
| `db` | 5432 | Postgres 16 (`postgres`/`postgres`/`code_validator` by default) |
| `backend` | **8001** → container 8000 | FastAPI |
| `frontend` | 5173 | Vite dev server |

Override credentials:

```bash
POSTGRES_USER=me POSTGRES_PASSWORD=secret docker compose up --build
```

Ollama stays on the host machine (`http://host.docker.internal:11434`).

---

## Tests

```powershell
# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

```bash
# Linux / macOS
./scripts/test.sh
```

What runs:

1. Backend fast suite: `pytest -m "not llm and not integration"`
2. Frontend: `tsc && vite build`

Markers (see `backend/pytest.ini`):

| Marker | Meaning |
|--------|---------|
| *(none)* | Fast, deterministic — runs in CI |
| `llm` | Calls real Ollama (slow) |
| `integration` | Needs full DB + often LLM |

Run everything including LLM tests (Ollama must be up):

```bash
cd backend
python -m pytest -q
```

CI runs on every push: `.github/workflows/ci.yml` (backend tests + frontend build).

---

## Project structure

```
codeguard-ai/
├── .github/workflows/ci.yml     # CI: backend tests + frontend build
├── scripts/
│   ├── setup.ps1 / setup.sh     # install deps, create .env
│   ├── dev.ps1   / dev.sh       # start backend :8001 + frontend :5173
│   ├── test.ps1  / test.sh      # fast tests + frontend build
│   └── stop.ps1  / stop.sh      # stop dev servers
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry
│   │   ├── core/
│   │   │   ├── config.py        # Settings
│   │   │   └── logging.py
│   │   ├── db/
│   │   │   ├── database.py      # Async SQLAlchemy + SSL helper
│   │   │   └── schema.sql
│   │   ├── models/
│   │   │   ├── validation.py    # ORM models
│   │   │   └── schemas.py       # Pydantic schemas
│   │   ├── services/
│   │   │   ├── language_detector.py
│   │   │   ├── syntax_validator.py
│   │   │   ├── security_scanner.py
│   │   │   ├── ollama_service.py
│   │   │   ├── formatter.py
│   │   │   └── validation_service.py
│   │   └── api/
│   │       ├── validation.py    # /validate, /fix, /format, …
│   │       ├── models.py        # /models, /config
│   │       ├── projects.py
│   │       ├── history.py
│   │       └── stats.py
│   ├── tests/                   # pytest
│   ├── create_db.py
│   ├── requirements.txt
│   ├── .env.example             # copy → .env
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx / main.tsx
│   │   ├── components/          # Editor, charts, layout, …
│   │   ├── pages/               # Dashboard, Validator, History, Settings
│   │   ├── services/api.ts
│   │   └── stores/              # Zustand
│   ├── package.json
│   ├── vite.config.ts           # proxy /api → :8001
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore                   # ignores .env, caches, node_modules
└── README.md
```

---

## API reference

### Validation / AI

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/detect-language` | Auto-detect language |
| POST | `/api/v1/validate` | Full validation |
| POST | `/api/v1/fix` | AI-corrected code |
| POST | `/api/v1/format` | Format code |
| POST | `/api/v1/explain` | Explain code |
| POST | `/api/v1/find-bugs` | Logic bugs |
| POST | `/api/v1/security-scan` | Security focus |
| POST | `/api/v1/optimize` | Performance focus |
| POST | `/api/v1/generate-tests` | Generate tests |
| POST | `/api/v1/document` | Generate docs |

### Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health + Ollama status |
| GET | `/api/v1/models` | Ollama models |
| GET | `/api/v1/config` | App config |
| GET | `/api/v1/stats?days=7` | Dashboard stats |
| GET | `/api/v1/history` | Validation history |
| GET | `/api/v1/history/{id}` | One validation |
| GET/POST | `/api/v1/projects` | Projects |

### Example

```bash
curl -X POST http://localhost:8001/api/v1/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def add(a, b):\n    return a + b",
    "language": "auto",
    "model": "deepseek-r1:7b-fast"
  }'
```

Example response:

```json
{
  "validation_id": "53f4ea2a-03de-4bca-ad02-7a1ead7dbc65",
  "status": "passed",
  "language": "python",
  "model": "deepseek-r1:7b-fast",
  "score": 100,
  "total_issues": 0,
  "critical": 0,
  "high": 0,
  "medium": 0,
  "low": 0,
  "issues": [],
  "syntax_valid": true
}
```

---

## Configuration

### `backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | local Postgres | Async SQLAlchemy URL (`postgresql+asyncpg://…`) |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint |
| `OLLAMA_DEFAULT_MODEL` | `deepseek-r1:7b-fast` | Default model |
| `OLLAMA_TEMPERATURE` | `0.1` | Sampling temperature |
| `OLLAMA_NUM_PREDICT` | `4096` | Max tokens |
| `DEBUG` | `false` | SQL echo / debug |

### Settings (`backend/app/core/config.py`)

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_CODE_LENGTH` | 100000 | Max code characters |
| `VALIDATION_TIMEOUT` | 60 | Deterministic checks timeout (s) |
| `LLM_TIMEOUT` | 300 | Ollama timeout (s) |
| `CORS_ORIGINS` | localhost:5173, localhost:3000 | Allowed origins |

### Score penalties

| Severity | Penalty |
|----------|---------|
| Critical | −30 |
| High | −20 |
| Medium | −10 |
| Low | −5 |
| Info | 0 |

Score is clamped to 0–100.

---

## Troubleshooting

### Database password failed

```
asyncpg.exceptions.InvalidPasswordError
```

Fix: Match user/password in `backend/.env` to your Postgres role (or Supabase dashboard).

### Supabase: IPv6 / TLS errors

- Prefer **Session pooler** host `aws-0-<region>.pooler.supabase.com`, not `db.<ref>.supabase.co`.
- Confirm region matches the project.
- If TLS handshake fails on your network: `...postgres?ssl=disable`.

### Ollama disconnected

```
"ollama": "disconnected"
```

Fix:

```bash
ollama serve
ollama pull deepseek-r1:7b-fast
```

Check: http://localhost:11434/api/tags

### Port already in use

```powershell
# Windows — stop helpers
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1
```

Or change the uvicorn port and update `frontend/vite.config.ts` proxy target.

### Windows: script execution disabled

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

### Frontend cannot reach API

- Backend must be on **8001** (or update `vite.config.ts`).
- Open http://localhost:8001/api/health first.

### Tests cannot connect to DB

Fast tests expect local Postgres:

- User/password via `TEST_DB_USER` / `TEST_DB_PASSWORD` (defaults: `postgres`/`postgres`)
- Database: `code_validator_test` (auto-created if possible)

Override:

```bash
export TEST_DB_PASSWORD=your_local_password
./scripts/test.sh
```

---

## License

MIT
