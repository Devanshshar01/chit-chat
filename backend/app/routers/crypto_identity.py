import base64

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_device, get_current_user
from app.crypto import verify_prekey_signature
from app.database import get_db
from app.models import Device, DeviceKeyBundle, KeyBundle, OneTimePreKey, User
from app.schemas import (
    DeviceKeyBundleClaim,
    DeviceKeyBundlePublic,
    DeviceKeyBundleUpload,
    KeyBundlePublic,
    KeyBundleUpload,
    OneTimePreKeyBatchUpload,
    OneTimePreKeyPublic,
    PrekeyUploadResult,
)

router = APIRouter(prefix="/keys", tags=["crypto-identity"])


async def _available_prekey_count(db: AsyncSession, device_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(OneTimePreKey).where(
            OneTimePreKey.device_id == device_id,
            OneTimePreKey.claimed_at.is_(None),
        )
    )
    return int(result.scalar_one())


async def _public_device_bundle(
    db: AsyncSession,
    device: Device,
    bundle: DeviceKeyBundle,
) -> DeviceKeyBundlePublic:
    return DeviceKeyBundlePublic(
        device_id=device.id,
        device_name=device.device_name,
        identity_signing_key_public=base64.b64encode(bundle.identity_signing_key_public).decode(),
        identity_dh_key_public=base64.b64encode(bundle.identity_dh_key_public).decode(),
        signed_prekey_id=bundle.signed_prekey_id,
        signed_prekey_public=base64.b64encode(bundle.signed_prekey_public).decode(),
        signed_prekey_signature=base64.b64encode(bundle.signed_prekey_signature).decode(),
        one_time_prekeys_available=await _available_prekey_count(db, device.id),
    )


@router.put("/me", response_model=KeyBundlePublic)
async def upload_key_bundle(
    body: KeyBundleUpload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Client generated an identity keypair + signed prekey on-device and is
    now publishing the PUBLIC halves so other devices can find them.
    We verify the prekey's signature before trusting it - never store
    unverified key material.
    """
    if not verify_prekey_signature(
        body.identity_key_public, body.signed_prekey_public, body.prekey_signature
    ):
        raise HTTPException(status_code=400, detail="prekey signature does not verify against identity key")

    result = await db.execute(select(KeyBundle).where(KeyBundle.user_id == current_user.id))
    existing = result.scalar_one_or_none()

    identity_bytes = base64.b64decode(body.identity_key_public)
    prekey_bytes = base64.b64decode(body.signed_prekey_public)
    sig_bytes = base64.b64decode(body.prekey_signature)

    if existing:
        existing.identity_key_public = identity_bytes
        existing.signed_prekey_public = prekey_bytes
        existing.prekey_signature = sig_bytes
        bundle = existing
    else:
        bundle = KeyBundle(
            user_id=current_user.id,
            identity_key_public=identity_bytes,
            signed_prekey_public=prekey_bytes,
            prekey_signature=sig_bytes,
        )
        db.add(bundle)

    await db.commit()
    await db.refresh(bundle)

    return KeyBundlePublic(
        user_id=bundle.user_id,
        identity_key_public=base64.b64encode(bundle.identity_key_public).decode(),
        signed_prekey_public=base64.b64encode(bundle.signed_prekey_public).decode(),
        prekey_signature=base64.b64encode(bundle.prekey_signature).decode(),
    )


@router.get("/{username}", response_model=KeyBundlePublic)
async def fetch_key_bundle(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")

    result = await db.execute(select(KeyBundle).where(KeyBundle.user_id == user.id))
    bundle = result.scalar_one_or_none()
    if bundle is None:
        raise HTTPException(status_code=404, detail="user has not published a key bundle yet")

    return KeyBundlePublic(
        user_id=bundle.user_id,
        identity_key_public=base64.b64encode(bundle.identity_key_public).decode(),
        signed_prekey_public=base64.b64encode(bundle.signed_prekey_public).decode(),
        prekey_signature=base64.b64encode(bundle.prekey_signature).decode(),
    )


@router.put("/me/device-bundle", response_model=DeviceKeyBundlePublic)
async def upload_device_key_bundle(
    body: DeviceKeyBundleUpload,
    db: AsyncSession = Depends(get_db),
    current_device: Device = Depends(get_current_device),
):
    """Publish the public X3DH bundle for the authenticated device only."""
    if not verify_prekey_signature(
        body.identity_signing_key_public,
        body.signed_prekey_public,
        body.signed_prekey_signature,
    ):
        raise HTTPException(status_code=400, detail="signed prekey signature does not verify")

    result = await db.execute(
        select(DeviceKeyBundle).where(DeviceKeyBundle.device_id == current_device.id)
    )
    bundle = result.scalar_one_or_none()
    values = {
        "identity_signing_key_public": base64.b64decode(body.identity_signing_key_public),
        "identity_dh_key_public": base64.b64decode(body.identity_dh_key_public),
        "signed_prekey_id": body.signed_prekey_id,
        "signed_prekey_public": base64.b64decode(body.signed_prekey_public),
        "signed_prekey_signature": base64.b64decode(body.signed_prekey_signature),
    }
    if bundle is None:
        bundle = DeviceKeyBundle(device_id=current_device.id, **values)
        db.add(bundle)
    else:
        for field, value in values.items():
            setattr(bundle, field, value)

    await db.commit()
    await db.refresh(bundle)
    return await _public_device_bundle(db, current_device, bundle)


@router.put("/me/one-time-prekeys", response_model=PrekeyUploadResult)
async def upload_one_time_prekeys(
    body: OneTimePreKeyBatchUpload,
    db: AsyncSession = Depends(get_db),
    current_device: Device = Depends(get_current_device),
):
    """Append public X25519 one-time prekeys for the authenticated device."""
    bundle_result = await db.execute(
        select(DeviceKeyBundle).where(DeviceKeyBundle.device_id == current_device.id)
    )
    if bundle_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=409, detail="publish a device key bundle before uploading one-time prekeys")

    key_ids = [prekey.key_id for prekey in body.prekeys]
    existing_result = await db.execute(
        select(OneTimePreKey).where(
            OneTimePreKey.device_id == current_device.id,
            OneTimePreKey.key_id.in_(key_ids),
        )
    )
    existing_by_id = {prekey.key_id: prekey for prekey in existing_result.scalars()}
    accepted = 0
    for prekey in body.prekeys:
        public_key = base64.b64decode(prekey.public_key)
        existing = existing_by_id.get(prekey.key_id)
        if existing is not None:
            if existing.public_key != public_key:
                raise HTTPException(status_code=409, detail=f"one-time prekey id already exists: {prekey.key_id}")
            continue
        db.add(OneTimePreKey(
            device_id=current_device.id,
            key_id=prekey.key_id,
            public_key=public_key,
        ))
        accepted += 1

    await db.commit()
    return PrekeyUploadResult(
        accepted=accepted,
        available=await _available_prekey_count(db, current_device.id),
    )


@router.get("/{username}/devices", response_model=list[DeviceKeyBundlePublic])
async def list_recipient_devices(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List active devices with published X3DH bundles for session setup."""
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="user not found")
    result = await db.execute(
        select(Device, DeviceKeyBundle)
        .join(DeviceKeyBundle, DeviceKeyBundle.device_id == Device.id)
        .where(Device.user_id == user.id, Device.is_active.is_(True))
        .order_by(Device.created_at.asc())
    )
    return [await _public_device_bundle(db, device, bundle) for device, bundle in result.all()]


@router.post("/{username}/devices/{device_id}/claim-prekey-bundle", response_model=DeviceKeyBundleClaim)
async def claim_prekey_bundle(
    username: str,
    device_id: str,
    db: AsyncSession = Depends(get_db),
    current_device: Device = Depends(get_current_device),
):
    """Return a target device's X3DH bundle and atomically consume one OTPK.

    A prekey is considered consumed as soon as it is returned. This is the
    safe failure mode: a crashed initiator wastes one public prekey but never
    permits two initiators to receive the same one.
    """
    target_result = await db.execute(
        select(Device, DeviceKeyBundle, User)
        .join(DeviceKeyBundle, DeviceKeyBundle.device_id == Device.id)
        .join(User, User.id == Device.user_id)
        .where(Device.id == device_id, Device.is_active.is_(True), User.username == username)
    )
    target = target_result.one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="recipient device key bundle not found")
    target_device, bundle, _ = target
    if target_device.id == current_device.id:
        raise HTTPException(status_code=400, detail="cannot claim a prekey bundle for the current device")

    # PostgreSQL locks one available row and skips rows another claimant has
    # already locked. The claim timestamp is committed before the response.
    prekey_result = await db.execute(
        select(OneTimePreKey)
        .where(OneTimePreKey.device_id == target_device.id, OneTimePreKey.claimed_at.is_(None))
        .order_by(OneTimePreKey.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    prekey = prekey_result.scalar_one_or_none()
    claimed: OneTimePreKeyPublic | None = None
    if prekey is not None:
        prekey.claimed_at = datetime.now(timezone.utc)
        prekey.claimed_by_device_id = current_device.id
        claimed = OneTimePreKeyPublic(
            key_id=prekey.key_id,
            public_key=base64.b64encode(prekey.public_key).decode(),
        )
        await db.commit()

    public = await _public_device_bundle(db, target_device, bundle)
    return DeviceKeyBundleClaim(**public.model_dump(), one_time_prekey=claimed)
