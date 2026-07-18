import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.link_preview import fetch_link_preview
from app.models import User, LinkPreview
from app.schemas import LinkPreviewRequest, LinkPreviewResponse
from app.utils import ensure_utc

router = APIRouter(prefix="/link-preview", tags=["link-preview"])

SUCCESS_CACHE_TTL = timedelta(days=7)
FAILURE_CACHE_TTL = timedelta(hours=1)  # retry failures sooner - might've been transient


def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


@router.post("", response_model=LinkPreviewResponse)
async def get_link_preview(
    body: LinkPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = _url_hash(body.url)
    result = await db.execute(select(LinkPreview).where(LinkPreview.url_hash == key))
    cached = result.scalar_one_or_none()

    if cached:
        ttl = FAILURE_CACHE_TTL if cached.fetch_failed else SUCCESS_CACHE_TTL
        if datetime.now(timezone.utc) - ensure_utc(cached.fetched_at) < ttl:
            return LinkPreviewResponse(
                url=cached.url,
                title=cached.title,
                description=cached.description,
                image_url=cached.image_url,
                available=not cached.fetch_failed,
            )

    try:
        data = fetch_link_preview(body.url)
        failed = False
        title, description, image_url = data.title, data.description, data.image_url
    except Exception:
        # Deliberately broad: a link preview is a nice-to-have, not
        # something worth surfacing a stack trace for. Any failure -
        # blocked SSRF target (UnsafeUrlError), timeout, malformed HTML,
        # whatever - just means "no preview available," not a 500.
        failed = True
        title = description = image_url = None

    if cached:
        cached.url = body.url
        cached.title = title
        cached.description = description
        cached.image_url = image_url
        cached.fetch_failed = failed
        cached.fetched_at = datetime.now(timezone.utc)
    else:
        db.add(LinkPreview(
            url_hash=key, url=body.url,
            title=title, description=description, image_url=image_url,
            fetch_failed=failed,
        ))
    await db.commit()

    return LinkPreviewResponse(
        url=body.url, title=title, description=description, image_url=image_url,
        available=not failed,
    )
