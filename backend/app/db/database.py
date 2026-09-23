from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import get_settings

settings = get_settings()


def _prepare_url(url: str) -> str:
    """Force SSL for managed Postgres unless the URL already sets ssl/sslmode.

    Supabase direct hosts are often IPv6-only; prefer the Session pooler
    (aws-0-<region>.pooler.supabase.com). Use ?ssl=disable if TLS is blocked.
    """
    if "ssl=" in url or "sslmode=" in url:
        return url
    host_part = url.split("@", 1)[-1].split("/", 1)[0]
    if "supabase" in host_part or "amazonaws.com" in host_part:
        sep = "&" if "?" in url else "?"
        return f"{url}{sep}ssl=require"
    return url


DATABASE_URL = _prepare_url(settings.DATABASE_URL)

if "code_validator_test" in DATABASE_URL:
    # Tests run across multiple event loops; pooling would bind connections
    # to a dead loop. NullPool creates a fresh connection per checkout.
    engine = create_async_engine(DATABASE_URL, echo=settings.DEBUG, poolclass=NullPool)
else:
    engine = create_async_engine(
        DATABASE_URL, echo=settings.DEBUG, pool_size=10, max_overflow=20
    )
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


MIGRATIONS = [
    "ALTER TABLE validations ADD COLUMN IF NOT EXISTS duration_ms INTEGER",
    "ALTER TABLE validations ADD COLUMN IF NOT EXISTS syntax_valid BOOLEAN",
]


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for statement in MIGRATIONS:
            try:
                await conn.execute(text(statement))
            except Exception:
                # Table missing when models were not imported into metadata
                pass
