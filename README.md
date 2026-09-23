# CodeGuard AI

LLM-powered code validation and review platform. Paste code, auto-detect language, analyze with Ollama, get errors, warnings, security issues, fixes, and a validation report.

## Architecture

```
Browser (React + Monaco)
        │
   REST / WebSocket
        │
   FastAPI Backend
        │
   ┌────┼────────────┐
   │    │             │
Language  Static    Security
Detector  Validators Scanner
   │    │             │
   └────┼────────────┘
        │
   Validation Orchestrator
        │
   Ollama (Local LLM)
        │
   PostgreSQL (history, projects)
```

**Key principle**: Ollama is the reasoning layer, not the entire engine. Deterministic checks (syntax, security patterns) run first, then LLM analyzes with context.

## Prerequisites

| Software | Version | Purpose |
|----------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend build |
| PostgreSQL or Supabase | 14+ | Database |
| Ollama | Latest | Local LLM inference |

## Quick start (from GitHub)

```bash
git clone https://github.com/ns-matrix/codeguard-ai.git
cd codeguard-ai

# Windows (if scripts are blocked by execution policy)
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1

# Linux / macOS
./scripts/setup.sh
./scripts/dev.sh
```

Then open:

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | App UI |
| http://localhost:8001/api/health | Backend health |
| http://localhost:8001/docs | Swagger UI |

`setup` creates `backend/.env` from the example (edit `DATABASE_URL` for local Postgres or Supabase before first run if needed).

### Run tests

```bash
# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\test.ps1

# Linux / macOS
./scripts/test.sh
```

Fast suite: backend pytest (`not llm and not integration`) + frontend `tsc` build.

### Stop dev servers

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop.ps1
# or
./scripts/stop.sh
```

## 1. Clone & Setup

```bash
git clone https://github.com/ns-matrix/codeguard-ai.git
cd codeguard-ai
```

## 2. Database (local PostgreSQL or Supabase)

### Option A — Local PostgreSQL

```sql
-- Connect as superuser (postgres)
CREATE DATABASE code_validator;
```

Connection string format:
```
postgresql+asyncpg://<user>:<password>@localhost:5432/code_validator
```

### Option B — Supabase (recommended for hosted / sharing)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database → Connection string → URI**.
3. Use **Session mode** (port `5432`) — better fit for SQLAlchemy/asyncpg than the transaction pooler.
4. Put the URI in `backend/.env` as `DATABASE_URL` (prefix with `postgresql+asyncpg://` if Supabase shows `postgresql://`).

Example:

```env
DATABASE_URL=postgresql+asyncpg://postgres.abc123:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

Notes:
- Tables are created automatically on backend startup (`init_db` → `create_all` + column migrations).
- SSL is forced automatically when the host contains `supabase` or `amazonaws.com` (override with `?ssl=disable`).
- Session pooler username is `postgres.<project-ref>` and region must match your project (e.g. `aws-0-ap-south-1`).
- Direct host `db.<ref>.supabase.co` is often IPv6-only; use the Session pooler on IPv4 networks.
- Tests still use a local `code_validator_test` database (see `backend/tests/conftest.py`), not Supabase.

### Configure

```bash
cp backend/.env.example backend/.env
# edit DATABASE_URL (and OLLAMA_* if needed)
```

## 3. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

Configure environment variables in `backend/.env`:

```env
# local
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/code_validator
# or Supabase (Session mode URI from the dashboard)
# DATABASE_URL=postgresql+asyncpg://postgres.REF:PASSWORD@aws-0-....pooler.supabase.com:5432/postgres
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=deepseek-r1:7b-fast
DEBUG=false
```

Start the backend:

```bash
uvicorn app.main:app --reload --port 8001
```

Verify:
```
http://localhost:8001/api/health
http://localhost:8001/docs          # Swagger UI
```

## 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Opens at: `http://localhost:5173`

The Vite proxy forwards `/api` requests to the backend on port 8001.

## 5. Ollama Setup

Install Ollama: https://ollama.ai

Pull a coding model:

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

Verify Ollama is running:
```
http://localhost:11434/api/tags
```

## Docker Setup (Alternative)

```bash
docker compose up --build
```

Services:

| Service | Port | Notes |
|---------|------|-------|
| `db` | 5432 | Postgres (`postgres`/`postgres` by default — override with env) |
| `backend` | **8001** → container 8000 | FastAPI |
| `frontend` | 5173 | Vite dev server (proxies `/api` → backend) |

Override credentials:

```bash
POSTGRES_USER=me POSTGRES_PASSWORD=secret docker compose up --build
```

Ollama stays on the host (`http://host.docker.internal:11434`).

## Project Structure

```
codeguard-ai/
├── .github/workflows/ci.yml     # CI: backend tests + frontend build
├── scripts/
│   ├── setup.ps1 / setup.sh     # deps + .env from example
│   ├── dev.ps1 / dev.sh         # start backend :8001 + frontend :5173
│   ├── test.ps1 / test.sh       # fast tests
│   └── stop.ps1 / stop.sh       # stop dev servers
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── core/
│   │   │   ├── config.py            # Settings (DB, Ollama, timeouts)
│   │   │   └── logging.py           # Colored console logging
│   │   ├── db/
│   │   │   ├── database.py          # Async SQLAlchemy + asyncpg
│   │   │   └── schema.sql           # Raw SQL migrations
│   │   ├── models/
│   │   │   ├── validation.py        # ORM models (Project, Validation, Issue, Log)
│   │   │   └── schemas.py           # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── language_detector.py # 16-language regex detection
│   │   │   ├── syntax_validator.py  # Per-language bracket/brace/keyword checks
│   │   │   ├── security_scanner.py  # Secrets, injection, XSS, crypto, network
│   │   │   ├── ollama_service.py    # Ollama REST API client
│   │   │   └── validation_service.py# Orchestrator combining all layers
│   │   └── api/
│   │       ├── validation.py        # /validate, /fix, /explain, /find-bugs, etc.
│   │       ├── models.py            # /models (Ollama status + model list)
│   │       ├── projects.py          # CRUD projects
│   │       ├── history.py           # Validation history
│   │       └── stats.py             # Dashboard stats/series
│   ├── tests/                       # pytest (fast suite + llm/integration markers)
│   ├── requirements.txt
│   ├── .env.example                 # copy → .env (never commit .env)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx                  # Router
│   │   ├── main.tsx                 # Entry point
│   │   ├── index.css                # Tailwind + custom styles
│   │   ├── components/              # CodeEditor, IssueList, charts, layout, …
│   │   ├── pages/                   # Dashboard, Validator, History, Settings
│   │   ├── services/api.ts          # Typed fetch client
│   │   └── stores/                  # Zustand state
│   ├── package.json
│   ├── vite.config.ts               # Dev proxy /api → :8001
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore                       # ignores backend/.env, secrets, caches
└── README.md
```

## API Endpoints

### Validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/detect-language` | Auto-detect programming language |
| POST | `/api/v1/validate` | Full validation (syntax + security + LLM) |
| POST | `/api/v1/fix` | AI-generated corrected code |
| POST | `/api/v1/explain` | Explain what the code does |
| POST | `/api/v1/find-bugs` | Focus on logic bugs |
| POST | `/api/v1/security-scan` | Focus on security vulnerabilities |
| POST | `/api/v1/optimize` | Focus on performance |
| POST | `/api/v1/generate-tests` | Generate unit tests |
| POST | `/api/v1/document` | Generate documentation |

### Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/models` | Ollama connection status + available models |
| GET | `/api/v1/projects` | List projects |
| POST | `/api/v1/projects` | Create project |
| DELETE | `/api/v1/projects/{id}` | Delete project |
| GET | `/api/v1/history` | Validation history |
| GET | `/api/v1/history/{id}` | Single validation details |

### Example Request

```bash
curl -X POST http://localhost:8001/api/v1/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def add(a, b):\n    return a + b",
    "language": "auto",
    "model": "deepseek-r1:7b-fast"
  }'
```

### Example Response

```json
{
  "validation_id": "53f4ea2a-03de-4bca-ad02-7a1ead7dbc65",
  "status": "passed",
  "language": "python",
  "model": "qwen2.5-coder:7b",
  "score": 100,
  "total_issues": 0,
  "critical": 0,
  "high": 0,
  "medium": 0,
  "low": 0,
  "issues": [],
  "improvements": [],
  "corrected_code": null,
  "syntax_valid": true,
  "syntax_warnings": []
}
```

## Supported Languages

| Language | Detection | Syntax Validation | LLM Analysis |
|----------|-----------|-------------------|--------------|
| Python | Yes | Yes | Yes |
| JavaScript | Yes | Yes | Yes |
| TypeScript | Yes | Yes | Yes |
| Java | Yes | Yes | Yes |
| C | Yes | Yes | Yes |
| C++ | Yes | Yes | Yes |
| Go | Yes | Yes | Yes |
| Rust | Yes | Yes | Yes |
| PHP | Yes | Yes | Yes |
| HTML | Yes | Yes | Yes |
| CSS | Yes | Yes | Yes |
| SQL | Yes | Yes | Yes |
| JSON | Yes | Yes | Yes |
| YAML | Yes | Yes | Yes |
| Bash | Yes | Yes | Yes |

## Validation Pipeline

```
Code Input
    │
    ▼
Language Detection (regex patterns + keyword matching)
    │
    ▼
Syntax Validation (per-language bracket/brace/keyword checks)
    │
    ▼
Security Scanner (secrets, injection, XSS, crypto, network patterns)
    │
    ▼
Ollama LLM Analysis (logic, architecture, maintainability)
    │
    ▼
Result Merger (combine all findings, calculate score)
    │
    ▼
Report (issues, score, corrected code)
```

## Severity Levels

| Level | Icon | Examples |
|-------|------|----------|
| Critical | Red | RCE, SQL injection, hardcoded secrets |
| High | Orange | Auth bypass, XSS, path traversal |
| Medium | Yellow | Missing validation, weak crypto, debug mode |
| Low | Blue | Style issues, naming, documentation |

## AI Actions

| Action | What it does |
|--------|-------------|
| Validate | Full pipeline: syntax + security + LLM analysis |
| Fix Code | Generate corrected version of the code |
| Explain | Describe what the code does |
| Find Bugs | Focus on logical errors |
| Security | Focus on vulnerabilities |
| Optimize | Focus on performance |
| Tests | Generate unit tests |
| Docs | Generate documentation/comments |

## Configuration

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/code_validator
# or Supabase Session-mode URI (postgresql+asyncpg://…)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=deepseek-r1:7b-fast
DEBUG=false
```

### Key Settings (`backend/app/core/config.py`)

| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_CODE_LENGTH` | 100,000 | Max characters per validation |
| `VALIDATION_TIMEOUT` | 60s | Timeout for deterministic checks |
| `LLM_TIMEOUT` | 300s | Timeout for Ollama requests |
| `CORS_ORIGINS` | localhost:5173, localhost:3000 | Allowed frontend origins |

## Troubleshooting

### PostgreSQL connection failed

```
asyncpg.exceptions.InvalidPasswordError: password authentication failed
```

Fix: Verify username/password in `.env` matches your PostgreSQL role.

### Ollama offline

```
Ollama status: disconnected
```

Fix: Start Ollama (`ollama serve`) and pull a model (`ollama pull deepseek-r1:7b-fast`).

### Port conflict

Port 8000 occupied by another service.

Fix: Change `--port` in uvicorn command and update `vite.config.ts` proxy target.

### Frontend import errors

```
Failed to resolve import "./IssueList/IssueList"
```

Fix: Check import paths are relative (use `../` not `./` for sibling directories).

## License

MIT
