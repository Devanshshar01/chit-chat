import base64
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException
from pydantic import ValidationError
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import decode_access_token_claims, get_current_device_optional, get_current_user
from app.database import get_db, AsyncSessionLocal
from app.models import Device, Message, User
from app.schemas import EncryptedMessageEnvelope, MessageAck, MessageSyncItem, SentMessageStatus
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
        claims = decode_access_token_claims(token)
        user_id = claims["sub"]
        sender_device_id = claims.get("did")
    except HTTPException:
        await ws.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        user = await _get_user_by_id(db, user_id)
        if user is None:
            await ws.close(code=4401)
            return
        if sender_device_id:
            device_result = await db.execute(
                select(Device).where(
                    Device.id == sender_device_id,
                    Device.user_id == user_id,
                    Device.is_active.is_(True),
                )
            )
            if device_result.scalar_one_or_none() is None:
                await ws.close(code=4401)
                return
        my_username = user.username
        user.last_seen_at = datetime.now(timezone.utc)
        await db.commit()
        await _broadcast_presence(db, user_id, my_username, True, user.last_seen_at)

    connection_id = sender_device_id or f"legacy:{user_id}"
    await manager.connect(user_id, connection_id, ws)

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

            if envelope_type == "encrypted_message":
                if not sender_device_id:
                    await ws.send_json({"error": {"code": "device_bound_token_required", "message": "log in again before sending encrypted messages"}})
                    continue
                try:
                    envelope = EncryptedMessageEnvelope.model_validate(raw)
                except ValidationError:
                    await ws.send_json({"error": {"code": "bad_envelope", "message": "invalid encrypted message envelope"}})
                    continue
                await _handle_encrypted_message(ws, user_id, sender_device_id, my_username, envelope)
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
        manager.disconnect(user_id, connection_id)
        async with AsyncSessionLocal() as db:
            user = await _get_user_by_id(db, user_id)
            if user:
                user.last_seen_at = datetime.now(timezone.utc)
                await db.commit()
                await _broadcast_presence(db, user_id, my_username, False, user.last_seen_at)


async def _handle_encrypted_message(
    ws: WebSocket,
    sender_user_id: str,
    sender_device_id: str,
    sender_username: str,
    envelope: EncryptedMessageEnvelope,
) -> None:
    """Persist and relay an opaque, device-targeted Double Ratchet envelope."""
    async with AsyncSessionLocal() as db:
        recipient_result = await db.execute(
            select(User, Device).join(Device, Device.user_id == User.id).where(
                User.username == envelope.recipient_username,
                Device.id == envelope.recipient_device_id,
                Device.is_active.is_(True),
            )
        )
        recipient = recipient_result.one_or_none()
        if recipient is None:
            await ws.send_json({"error": {"code": "unknown_recipient_device", "message": "recipient device is unavailable"}})
            return
        recipient_user, recipient_device = recipient

        existing_result = await db.execute(
            select(Message).where(
                Message.sender_device_id == sender_device_id,
                Message.recipient_device_id == recipient_device.id,
                Message.client_id == envelope.client_id,
            )
        )
        message = existing_result.scalar_one_or_none()
        if message is None:
            message = Message(
                client_id=envelope.client_id,
                sender_id=sender_user_id,
                recipient_id=recipient_user.id,
                ciphertext=base64.b64decode(envelope.ciphertext),
                protocol_version=envelope.protocol_version,
                sender_device_id=sender_device_id,
                recipient_device_id=recipient_device.id,
                session_id=envelope.session_id,
                ratchet_public_key=base64.b64decode(envelope.ratchet_public_key),
                message_number=envelope.message_number,
                previous_chain_length=envelope.previous_chain_length,
                nonce=base64.b64decode(envelope.nonce),
                prekey_header=envelope.prekey_header.model_dump() if envelope.prekey_header else None,
            )
            db.add(message)
            try:
                await db.commit()
                await db.refresh(message)
            except IntegrityError:
                await db.rollback()
                retry_result = await db.execute(
                    select(Message).where(
                        Message.sender_device_id == sender_device_id,
                        Message.recipient_device_id == recipient_device.id,
                        Message.client_id == envelope.client_id,
                    )
                )
                message = retry_result.scalar_one()

        payload = _encrypted_message_payload(message, sender_username)
        delivered = await manager.push_device(recipient_user.id, recipient_device.id, payload)
        if delivered and message.delivered_at is None:
            message.delivered_at = datetime.now(timezone.utc)
            await db.commit()
        if not delivered:
            await notify_new_message(db, recipient_user.id, sender_username, message.id)

        await ws.send_json({
            "type": "ack",
            **MessageAck(
                id=message.id,
                client_id=message.client_id,
                created_at=message.created_at.isoformat(),
                delivered=delivered,
            ).model_dump(),
        })


def _encrypted_message_payload(message: Message, sender_username: str) -> dict:
    return {
        "type": "encrypted_message",
        "id": message.id,
        "client_id": message.client_id,
        "sender_username": sender_username,
        "ciphertext": base64.b64encode(message.ciphertext).decode(),
        "protocol_version": message.protocol_version,
        "sender_device_id": message.sender_device_id,
        "recipient_device_id": message.recipient_device_id,
        "session_id": message.session_id,
        "ratchet_public_key": base64.b64encode(message.ratchet_public_key).decode() if message.ratchet_public_key else None,
        "message_number": message.message_number,
        "previous_chain_length": message.previous_chain_length,
        "nonce": base64.b64encode(message.nonce).decode() if message.nonce else None,
        "prekey_header": message.prekey_header,
        "created_at": message.created_at.isoformat(),
    }


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
    current_device: Device | None = Depends(get_current_device_optional),
):
    """
    Pull-based catch-up for offline clients: anything addressed to me,
    created after `since`. Marks returned messages delivered (sync
    counts as delivery, same as a live WebSocket push would).
    """
    query = select(Message).where(Message.recipient_id == current_user.id)
    if current_device is None:
        query = query.where(Message.protocol_version == 0)
    else:
        query = query.where(or_(
            Message.protocol_version == 0,
            Message.recipient_device_id == current_device.id,
        ))
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
            protocol_version=m.protocol_version,
            sender_device_id=m.sender_device_id,
            recipient_device_id=m.recipient_device_id,
            session_id=m.session_id,
            ratchet_public_key=base64.b64encode(m.ratchet_public_key).decode() if m.ratchet_public_key else None,
            message_number=m.message_number,
            previous_chain_length=m.previous_chain_length,
            nonce=base64.b64encode(m.nonce).decode() if m.nonce else None,
            prekey_header=m.prekey_header,
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
            recipient_device_id=m.recipient_device_id,
        )
        for m in messages
    ]
