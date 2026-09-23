import asyncio
import os
import sys
from urllib.parse import quote_plus, urlparse, urlunparse

# Prefer CI/TEST_* env; defaults match docker-compose / GitHub Actions Postgres.
_default_user = os.environ.get("TEST_DB_USER", "postgres")
_default_password = os.environ.get("TEST_DB_PASSWORD", "postgres")
_default_host = os.environ.get("TEST_DB_HOST", "localhost")
_default_port = os.environ.get("TEST_DB_PORT", "5432")
_default_name = os.environ.get("TEST_DB_NAME", "code_validator_test")

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    f"postgresql+asyncpg://{_default_user}:{quote_plus(_default_password)}"
    f"@{_default_host}:{_default_port}/{_default_name}",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("OLLAMA_BASE_URL", "http://localhost:11434")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _admin_url() -> str:
    """Admin DSN for CREATE DATABASE (connects to `postgres`)."""
    if "TEST_DB_USER" in os.environ or "TEST_DB_PASSWORD" in os.environ:
        return (
            f"postgresql://{_default_user}:{quote_plus(_default_password)}"
            f"@{_default_host}:{_default_port}/postgres"
        )
    # Parse app URL (asyncpg+ dialect) and swap database for `postgres`.
    parsed = urlparse(TEST_DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
    return urlunparse(parsed._replace(path="/postgres"))


def _ensure_test_database():
    import asyncpg

    async def run():
        try:
            conn = await asyncpg.connect(_admin_url())
        except Exception:
            # DB may already exist / no CREATE privilege (e.g. Supabase) —
            # tests will still run if the target database exists.
            return
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", _default_name
            )
            if not exists:
                await conn.execute(f'CREATE DATABASE "{_default_name}"')
        finally:
            await conn.close()

    asyncio.run(run())


_ensure_test_database()


import pytest  # noqa: E402
import httpx  # noqa: E402


@pytest.fixture
async def client():
    from httpx import ASGITransport
    from app.main import app
    from app.db.database import init_db

    await init_db()
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
