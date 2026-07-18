import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_access_token, get_current_user
from app.database import get_db, AsyncSessionLocal
from app.models import User, Message
from app.schemas import MessageAck, MessageSyncItem, SentMessageStatus
from app.push import notify_new_message
from app.utils import ensure_utc
from app.ws_manager import manager

router = APIRouter(tags=["messages"])


async def _get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def _get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def _all_user_ids(db: AsyncSession) -> list[str]:
    result = await db.execute(select(User.id))
    return [row[0] for row in result.all()]


async def _broadcast_presence(db: AsyncSession, user_id: str, username: str, is_online: bool, last_seen_at: datetime):
    all_ids = await _all_user_ids(db)
    await manager.broadcast_to_others(all_ids, user_id, {
        "type": "presence",
        "username": username,
        "is_online": is_online,
        "last_seen_at": last_seen_at.isoformat(),
    })


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    # WebSocket auth: browsers/RN can't set custom headers on the upgrade
    # request easily, so the access token travels as a query param instead.
    try:
        user_id = decode_access_token(token)
    except HTTPException:
        await ws.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        user = await _get_user_by_id(db, user_id)
        if user is None:
            await ws.close(code=4401)
            return
        my_username = user.username
        user.last_seen_at = datetime.now(timezone.utc)
        await db.commit()
        await _broadcast_presence(db, user_id, my_username, True, user.last_seen_at)

    await manager.connect(user_id, ws)

    try:
        while True:
            raw = await ws.receive_json()
            envelope_type = raw.get("type")

            if envelope_type == "ping":
                # client-side heartbeat: proves the connection is actually
                # alive end-to-end, not just open at the TCP level
                await ws.send_json({"type": "pong"})
                continue

            if envelope_type == "read":
                await _handle_read_receipt(user_id, raw)
                continue

            if envelope_type != "message":
                await ws.send_json({"error": {"code": "bad_envelope", "message": f"unknown type {envelope_type!r}"}})
                continue

            client_id = raw.get("client_id")
            recipient_username = raw.get("recipient_username")
            ciphertext_b64 = raw.get("ciphertext")

            if not all([client_id, recipient_username, ciphertext_b64]):
                await ws.send_json({"error": {"code": "bad_envelope", "message": "missing required fields"}})
                continue

            async with AsyncSessionLocal() as db:
                recipient = await _get_user_by_username(db, recipient_username)
                if recipient is None:
                    await ws.send_json({"error": {"code": "unknown_recipient", "message": recipient_username}})
                    continue

                # idempotency check - same sender + same client_id = same logical send
                existing = await db.execute(
                    select(Message).where(
                        Message.sender_id == user_id,
                        Message.client_id == client_id,
                    )
                )
                msg = existing.scalar_one_or_none()

                if msg is None:
                    msg = Message(
                        client_id=client_id,
                        sender_id=user_id,
                        recipient_id=recipient.id,
                        ciphertext=base64.b64decode(ciphertext_b64),
                    )
                    db.add(msg)
                    try:
                        await db.commit()
                        await db.refresh(msg)
                    except IntegrityError:
                        # race: two sends with the same client_id landed at once -
                        # whoever lost the race just reads back the winner's row
                        await db.rollback()
                        existing = await db.execute(
                            select(Message).where(
                                Message.sender_id == user_id,
                                Message.client_id == client_id,
                            )
                        )
                        msg = existing.scalar_one()

                delivered = await manager.push(recipient.id, {
                    "type": "message",
                    "id": msg.id,
                    "client_id": msg.client_id,
                    "sender_username": my_username,
                    "ciphertext": base64.b64encode(msg.ciphertext).decode(),
                    "created_at": msg.created_at.isoformat(),
                })

                if delivered and msg.delivered_at is None:
                    msg.delivered_at = datetime.now(timezone.utc)
                    await db.commit()

                if not delivered:
                    # recipient has no live socket - wake their device via
                    # FCM instead. Content-free payload; they pull the
                    # actual ciphertext through /messages/sync on wake.
                    await notify_new_message(db, recipient.id, my_username, msg.id)

                await ws.send_json({
                    "type": "ack",
                    **MessageAck(
                        id=msg.id,
                        client_id=msg.client_id,
                        created_at=msg.created_at.isoformat(),
                        delivered=delivered,
                    ).model_dump(),
                })

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id)
        async with AsyncSessionLocal() as db:
            user = await _get_user_by_id(db, user_id)
            if user:
                user.last_seen_at = datetime.now(timezone.utc)
                await db.commit()
                await _broadcast_presence(db, user_id, my_username, False, user.last_seen_at)


async def _handle_read_receipt(reader_user_id: str, raw: dict) -> None:
    """
    Client -> server: {"type": "read", "message_ids": [...]}
    Marks each message read_at (only if reader_user_id is actually the
    recipient - you can't mark your OWN sent messages as read), then
    notifies each affected sender live if they're connected.
    """
    message_ids = raw.get("message_ids") or []
    if not message_ids:
        return

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Message).where(Message.id.in_(message_ids)))
        messages = result.scalars().all()

        # group newly-read ids by sender, so each sender gets one push
        # listing everything they need to know about, not one push per message
        by_sender: dict[str, list[str]] = {}
        for m in messages:
            if m.recipient_id != reader_user_id:
                continue  # ignore attempts to mark someone else's message read
            if m.read_at is not None:
                continue  # already read, nothing to do
            m.read_at = now
            if m.delivered_at is None:
                m.delivered_at = now  # read implies delivered, in case sync/push both missed it
            by_sender.setdefault(m.sender_id, []).append(m.id)

        await db.commit()

        for sender_id, ids in by_sender.items():
            await manager.push(sender_id, {
                "type": "read_receipt",
                "message_ids": ids,
                "read_at": now.isoformat(),
            })


@router.get("/messages/sync", response_model=list[MessageSyncItem])
async def sync_messages(
    since: str | None = Query(None, description="ISO timestamp cursor; omit to pull everything"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Pull-based catch-up for offline clients: anything addressed to me,
    created after `since`. Marks returned messages delivered (sync
    counts as delivery, same as a live WebSocket push would).
    """
    query = select(Message).where(Message.recipient_id == current_user.id)
    if since:
        try:
            cursor = datetime.fromisoformat(since)
        except ValueError:
            raise HTTPException(status_code=400, detail="`since` must be ISO 8601")
        query = query.where(Message.created_at > cursor)
    query = query.order_by(Message.created_at.asc())

    result = await db.execute(query)
    messages = result.scalars().all()

    now = datetime.now(timezone.utc)
    items = []
    for m in messages:
        if m.delivered_at is None:
            m.delivered_at = now
        sender = await _get_user_by_id(db, m.sender_id)
        items.append(MessageSyncItem(
            id=m.id,
            client_id=m.client_id,
            sender_username=sender.username if sender else "unknown",
            ciphertext=base64.b64encode(m.ciphertext).decode(),
            created_at=m.created_at.isoformat(),
        ))
    await db.commit()
    return items


@router.get("/messages/sent-status", response_model=list[SentMessageStatus])
async def sent_message_status(
    since: str | None = Query(None, description="ISO timestamp cursor on created_at; omit to pull everything"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Symmetric to /messages/sync, but for the OTHER direction: catches up
    a sender on delivered_at/read_at changes that happened to their own
    sent messages while they were offline (e.g. the recipient read a
    message while the sender's device had no connection at all - a live
    read_receipt push can't reach a socket that doesn't exist).
    """
    query = select(Message).where(Message.sender_id == current_user.id)
    if since:
        try:
            cursor = datetime.fromisoformat(since)
        except ValueError:
            raise HTTPException(status_code=400, detail="`since` must be ISO 8601")
        query = query.where(Message.created_at > cursor)
    query = query.order_by(Message.created_at.asc())

    result = await db.execute(query)
    messages = result.scalars().all()

    return [
        SentMessageStatus(
            id=m.id,
            client_id=m.client_id,
            delivered_at=m.delivered_at.isoformat() if m.delivered_at else None,
            read_at=m.read_at.isoformat() if m.read_at else None,
        )
        for m in messages
    ]
