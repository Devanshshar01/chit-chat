"""
FCM push notifications for messages that could not be delivered live.

Design constraints, matching the rest of the backend:
  - The server never sees plaintext, so the notification payload carries
    NO message content - only the sender's username and the message id.
    The client wakes up, pulls the actual ciphertext through the same
    /messages/sync path it already uses, and renders locally. Nothing
    about the (future) encryption flow is bypassed.
  - Data-only messages: display is handled entirely on-device, which is
    what lets the client suppress the popup when the chat is already
    open in the foreground.
  - firebase-admin is synchronous; every send runs in a worker thread so
    the event loop is never blocked.
  - Dead tokens (uninstalled app, rotated token) are detected from FCM's
    "unregistered" error and cleared from the device row automatically.

Configuration: set FIREBASE_CREDENTIALS_FILE in .env to the path of a
Firebase service-account JSON (Firebase console -> Project settings ->
Service accounts -> Generate new private key). If unset, push is simply
disabled and everything else keeps working - offline recipients still
catch up via /messages/sync on next connect.
"""
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Device

logger = logging.getLogger("app.push")

_firebase_app = None
_init_attempted = False


def _get_firebase_app():
    """Lazily initializes firebase-admin once. Returns None if not configured."""
    global _firebase_app, _init_attempted
    if _init_attempted:
        return _firebase_app
    _init_attempted = True

    if not settings.firebase_credentials_file:
        logger.info("push disabled: FIREBASE_CREDENTIALS_FILE not set")
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials

        cred = credentials.Certificate(settings.firebase_credentials_file)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("firebase-admin initialized")
    except Exception:
        logger.exception("firebase-admin initialization failed - push disabled")
        _firebase_app = None
    return _firebase_app


def push_enabled() -> bool:
    return _get_firebase_app() is not None


def _send_to_token(token: str, data: dict[str, str]) -> str:
    """
    Sends one data-only, high-priority FCM message. Runs in a worker
    thread. Returns "ok", "dead_token", or "error".
    """
    from firebase_admin import messaging

    msg = messaging.Message(
        token=token,
        data=data,
        android=messaging.AndroidConfig(priority="high"),
    )
    try:
        messaging.send(msg, app=_get_firebase_app())
        return "ok"
    except messaging.UnregisteredError:
        return "dead_token"
    except Exception:
        logger.exception("FCM send failed for token ending ...%s", token[-8:])
        return "error"


async def notify_new_message(
    db: AsyncSession,
    recipient_user_id: str,
    sender_username: str,
    message_id: str,
) -> None:
    """
    Notifies every active device of the recipient that a new message is
    waiting. Payload is content-free by design (see module docstring).
    Dead tokens are cleared in the same transaction scope.
    """
    if not push_enabled():
        return

    result = await db.execute(
        select(Device).where(
            Device.user_id == recipient_user_id,
            Device.is_active.is_(True),
            Device.push_token.is_not(None),
        )
    )
    devices = result.scalars().all()
    if not devices:
        return

    data = {
        "type": "new_message",
        "sender_username": sender_username,
        "message_id": message_id,
    }

    # one token can be registered on several stale device rows; dedupe
    seen: set[str] = set()
    dead_tokens: set[str] = set()
    for device in devices:
        token = device.push_token
        if token in seen:
            continue
        seen.add(token)
        outcome = await asyncio.to_thread(_send_to_token, token, data)
        if outcome == "dead_token":
            dead_tokens.add(token)

    if dead_tokens:
        for device in devices:
            if device.push_token in dead_tokens:
                device.push_token = None
        await db.commit()
        logger.info("cleared %d dead push token(s)", len(dead_tokens))
