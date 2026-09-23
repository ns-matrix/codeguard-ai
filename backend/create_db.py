import asyncio
import asyncpg

async def create():
    conn = await asyncpg.connect("postgresql://postgres:KingMaker@localhost:5432/postgres")
    try:
        await conn.execute("CREATE DATABASE code_validator")
        print("Database created")
    except asyncpg.DuplicateDatabaseError:
        print("Database already exists")
    finally:
        await conn.close()

asyncio.run(create())
