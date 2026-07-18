"""
Push-token lifecycle for a user's devices.

The client registers its FCM token right after login and whenever FCM
rotates it (onTokenRefresh), and unregisters it on logout. Login already
creates a Device row per session; the token attaches to the newest
active row so step 9 needed no schema change - Device.push_token has
existed since the initial schema, reserved for exactly this.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Device, User
from app.schemas import PushTokenRequest

router = APIRouter(prefix="/devices", tags=["devices"])


@router.put("/me/push-token")
async def register_push_token(
    body: PushTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Idempotent: registering the same token twice is a no-op. If the token
    was previously registered to a different user (the app was logged out
    and back in as someone else on the same phone), it moves - one
    physical device, one owner at a time.
    """
    # detach this token from anyone else holding it
    result = await db.execute(
        select(Device).where(
            Device.push_token == body.push_token,
            Device.user_id != current_user.id,
        )
    )
    for foreign_device in result.scalars().all():
        foreign_device.push_token = None

    # already registered for this user?
    result = await db.execute(
        select(Device).where(
            Device.user_id == current_user.id,
            Device.push_token == body.push_token,
        )
    )
    device = result.scalars().first()

    if device is None:
        # attach to the newest active device row without a token (the row
        # login just created), or create one if none exists
        result = await db.execute(
            select(Device)
            .where(
                Device.user_id == current_user.id,
                Device.is_active.is_(True),
                Device.push_token.is_(None),
            )
            .order_by(Device.created_at.desc())
        )
        device = result.scalars().first()
        if device is None:
            device = Device(user_id=current_user.id, device_name=body.device_name or "phone")
            db.add(device)
        device.push_token = body.push_token

    device.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True}


@router.delete("/me/push-token")
async def unregister_push_token(
    body: PushTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Called on logout so a signed-out phone stops receiving pushes."""
    result = await db.execute(
        select(Device).where(
            Device.user_id == current_user.id,
            Device.push_token == body.push_token,
        )
    )
    for device in result.scalars().all():
        device.push_token = None
    await db.commit()
    return {"ok": True}
