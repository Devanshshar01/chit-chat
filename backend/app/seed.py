"""
Seeds exactly two real accounts. Run with:
    python -m app.seed

Passcodes are read from env vars so they never end up committed to git:
    SEED_DEVANSH_PASSCODE=xxxx SEED_SWARNIMA_PASSCODE=yyyy python -m app.seed
Falls back to placeholder passcodes for local dev if unset - change these
before this touches anything real.
"""
import asyncio
import os

from sqlalchemy import select

from app.auth import hash_passcode
from app.database import AsyncSessionLocal, init_models
from app.models import User

SEED_USERS = [
    {
        "username": "devansh",
        "display_name": "Devansh",
        "passcode": os.environ.get("SEED_DEVANSH_PASSCODE", "changeme1"),
    },
    {
        "username": "swarnima",
        "display_name": "Swarnima",
        "passcode": os.environ.get("SEED_SWARNIMA_PASSCODE", "changeme2"),
    },
]


async def seed():
    await init_models()
    async with AsyncSessionLocal() as db:
        for u in SEED_USERS:
            result = await db.execute(select(User).where(User.username == u["username"]))
            if result.scalar_one_or_none():
                print(f"skip: {u['username']} already exists")
                continue
            user = User(
                username=u["username"],
                display_name=u["display_name"],
                passcode_hash=hash_passcode(u["passcode"]),
            )
            db.add(user)
            print(f"created: {u['username']}")
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
