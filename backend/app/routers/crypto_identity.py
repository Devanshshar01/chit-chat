import base64

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.crypto import verify_prekey_signature
from app.database import get_db
from app.models import User, KeyBundle
from app.schemas import KeyBundleUpload, KeyBundlePublic

router = APIRouter(prefix="/keys", tags=["crypto-identity"])


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
