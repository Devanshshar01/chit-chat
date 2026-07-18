import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    verify_passcode,
    create_access_token,
    hash_refresh_token,
    get_current_user,
)
from app.config import settings
from app.database import get_db
from app.models import User, Device, RefreshToken
from app.schemas import LoginRequest, TokenResponse, RefreshRequest
from app.utils import ensure_utc

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    # Deliberately identical error for "no such user" and "wrong passcode" -
    # don't leak which one it was.
    if user is None or not verify_passcode(body.passcode, user.passcode_hash):
        raise HTTPException(status_code=401, detail="invalid username or passcode")

    device = Device(user_id=user.id, device_name=body.device_name)
    db.add(device)
    await db.flush()  # get device.id before using it below

    raw_refresh = secrets.token_urlsafe(48)
    refresh = RefreshToken(
        user_id=user.id,
        device_id=device.id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=raw_refresh,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_refresh_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()

    if stored is None or stored.revoked:
        raise HTTPException(status_code=401, detail="invalid refresh token")
    if ensure_utc(stored.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="refresh token expired")

    # rotate: revoke old, issue new refresh + access
    stored.revoked = True
    raw_refresh = secrets.token_urlsafe(48)
    new_refresh = RefreshToken(
        user_id=stored.user_id,
        device_id=stored.device_id,
        token_hash=hash_refresh_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(new_refresh)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(stored.user_id),
        refresh_token=raw_refresh,
    )


@router.post("/logout")
async def logout(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token_hash = hash_refresh_token(body.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == current_user.id,
        )
    )
    stored = result.scalar_one_or_none()
    if stored:
        stored.revoked = True
        # a logged-out device must stop receiving pushes for this account
        device_result = await db.execute(
            select(Device).where(Device.id == stored.device_id)
        )
        device = device_result.scalar_one_or_none()
        if device:
            device.push_token = None
        await db.commit()
    return {"ok": True}
