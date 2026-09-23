import asyncio
import os
import sys

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:KingMaker@localhost:5432/code_validator_test"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("OLLAMA_BASE_URL", "http://localhost:11434")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _ensure_test_database():
    import asyncpg

    async def run():
        conn = await asyncpg.connect(
            "postgresql://postgres:KingMaker@localhost:5432/postgres"
        )
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = 'code_validator_test'"
            )
            if not exists:
                await conn.execute("CREATE DATABASE code_validator_test")
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
