import hashlib
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Device, User

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def hash_passcode(passcode: str) -> str:
    return pwd_context.hash(passcode)


def verify_passcode(passcode: str, passcode_hash: str) -> bool:
    return pwd_context.verify(passcode, passcode_hash)


def hash_refresh_token(token: str) -> str:
    # refresh tokens are opaque random strings; we only ever store the hash
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: str, device_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "did": device_id,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token_claims(token: str) -> dict:
    """Returns verified access-token claims without logging token contents."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="wrong token type")
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="invalid token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid token")


def decode_access_token(token: str) -> str:
    """Returns user_id if valid, raises HTTPException otherwise."""
    return decode_access_token_claims(token)["sub"]


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if token is None:
        raise HTTPException(status_code=401, detail="not authenticated")
    user_id = decode_access_token(token)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="user no longer exists")
    return user


async def get_current_device(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Device:
    """Require a device-bound access token for X3DH-v1 operations."""
    if token is None:
        raise HTTPException(status_code=401, detail="not authenticated")
    claims = decode_access_token_claims(token)
    device_id = claims.get("did")
    if not device_id:
        raise HTTPException(status_code=401, detail="device-bound access token required")
    result = await db.execute(
        select(Device).where(
            Device.id == device_id,
            Device.user_id == claims["sub"],
            Device.is_active.is_(True),
        )
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=401, detail="device is no longer active")
    return device


async def get_current_device_optional(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Device | None:
    """Resolve a device when present; permits legacy user-only tokens for v0 sync."""
    if token is None:
        return None
    claims = decode_access_token_claims(token)
    device_id = claims.get("did")
    if not device_id:
        return None
    result = await db.execute(
        select(Device).where(
            Device.id == device_id,
            Device.user_id == claims["sub"],
            Device.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()
