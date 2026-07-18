import uuid as uuid_module
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import User, Media
from app.schemas import (
    InitiateUploadRequest, InitiateUploadResponse, UploadPart,
    CompleteUploadRequest, MediaMetadata,
)
from app.storage import (
    get_s3_client, build_storage_key,
    presign_put, create_multipart_upload, presign_upload_part,
    complete_multipart_upload, presign_get, head_object,
)

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/uploads", response_model=InitiateUploadResponse)
async def initiate_upload(
    body: InitiateUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.total_size_bytes <= 0:
        raise HTTPException(status_code=400, detail="total_size_bytes must be positive")

    media_id = str(uuid_module.uuid4())
    storage_key = build_storage_key(current_user.id, body.filename, media_id)

    media = Media(
        id=media_id,
        uploader_id=current_user.id,
        filename=body.filename,
        content_type=body.content_type,
        total_size_bytes=body.total_size_bytes,
        storage_key=storage_key,
    )

    client = get_s3_client()
    bucket = settings.r2_bucket_name

    if body.total_size_bytes <= settings.multipart_threshold_bytes:
        # small file - one direct PUT, no multipart orchestration needed
        media.is_multipart = False
        db.add(media)
        await db.commit()

        url = presign_put(client, bucket, media.storage_key, body.content_type)
        return InitiateUploadResponse(
            media_id=media.id,
            is_multipart=False,
            chunk_size_bytes=body.total_size_bytes,
            put_url=url,
        )

    # large file - multipart. Compression/chunking on the client (step 6's
    # client half) decides actual chunk boundaries; the part size here is
    # just what we tell it to use.
    media.is_multipart = True
    upload_id = create_multipart_upload(client, bucket, media.storage_key, body.content_type)
    media.s3_upload_id = upload_id
    db.add(media)
    await db.commit()

    chunk_size = settings.multipart_chunk_size_bytes
    part_count = (body.total_size_bytes + chunk_size - 1) // chunk_size

    parts = [
        UploadPart(
            part_number=n,
            url=presign_upload_part(client, bucket, media.storage_key, upload_id, n),
        )
        for n in range(1, part_count + 1)
    ]

    return InitiateUploadResponse(
        media_id=media.id,
        is_multipart=True,
        chunk_size_bytes=chunk_size,
        parts=parts,
    )


@router.post("/uploads/{media_id}/complete", response_model=MediaMetadata)
async def complete_upload(
    media_id: str,
    body: CompleteUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if media is None or media.uploader_id != current_user.id:
        raise HTTPException(status_code=404, detail="upload not found")
    if media.status != "uploading":
        raise HTTPException(status_code=409, detail=f"upload is already {media.status}")

    client = get_s3_client()
    bucket = settings.r2_bucket_name

    if media.is_multipart:
        if not body.parts:
            raise HTTPException(status_code=400, detail="parts required to complete a multipart upload")
        complete_multipart_upload(
            client, bucket, media.storage_key, media.s3_upload_id,
            [{"PartNumber": p.part_number, "ETag": p.etag} for p in body.parts],
        )
    else:
        # simple path: verify the client's direct PUT actually landed
        if head_object(client, bucket, media.storage_key) is None:
            raise HTTPException(status_code=409, detail="object not found in bucket yet - PUT may not have completed")

    media.status = "ready"
    media.completed_at = datetime.now(timezone.utc)
    await db.commit()

    download_url = presign_get(client, bucket, media.storage_key)
    return MediaMetadata(
        id=media.id,
        filename=media.filename,
        content_type=media.content_type,
        total_size_bytes=media.total_size_bytes,
        status=media.status,
        download_url=download_url,
        created_at=media.created_at.isoformat(),
    )


@router.get("/{media_id}", response_model=MediaMetadata)
async def get_media(
    media_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if media is None:
        raise HTTPException(status_code=404, detail="media not found")
    # Not restricting to uploader-only read access here - once a media id is
    # referenced in a message to a peer, that peer needs to be able to fetch
    # it too. Real access control (only sender + recipient) is message-layer
    # work, not this endpoint's job.

    download_url = None
    if media.status == "ready":
        client = get_s3_client()
        download_url = presign_get(client, settings.r2_bucket_name, media.storage_key)

    return MediaMetadata(
        id=media.id,
        filename=media.filename,
        content_type=media.content_type,
        total_size_bytes=media.total_size_bytes,
        status=media.status,
        download_url=download_url,
        created_at=media.created_at.isoformat(),
    )
