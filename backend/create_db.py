import asyncio
import os

import asyncpg

ADMIN_URL = os.environ.get(
    "ADMIN_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres",
)


async def create():
    conn = await asyncpg.connect(ADMIN_URL)
    try:
        await conn.execute("CREATE DATABASE code_validator")
        print("Database created")
    except asyncpg.DuplicateDatabaseError:
        print("Database already exists")
    finally:
        await conn.close()

asyncio.run(create())
