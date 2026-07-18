from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.schemas import UserPublic, PresenceResponse
from app.ws_manager import manager

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
async def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/{username}", response_model=UserPublic)
async def read_user(username: str, db: AsyncSession = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    return user


@router.get("/{username}/presence", response_model=PresenceResponse)
async def read_presence(username: str, db: AsyncSession = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    return PresenceResponse(
        username=user.username,
        is_online=manager.is_online(user.id),
        last_seen_at=user.last_seen_at.isoformat() if user.last_seen_at else None,
    )
