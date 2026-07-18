"""
Schema for steps 1-4: users, devices, refresh tokens, crypto key bundles,
and (new in step 4) messages for the offline outbox pattern.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, LargeBinary, Boolean, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    display_name: Mapped[str] = mapped_column(String(64))
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    passcode_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=_now, nullable=True)

    devices: Mapped[list["Device"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    key_bundle: Mapped["KeyBundle | None"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class Device(Base):
    """A device belonging to a user. Push tokens attach here (step 9 will use this)."""
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    device_name: Mapped[str] = mapped_column(String(64))
    push_token: Mapped[str | None] = mapped_column(String(256), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped["User"] = relationship(back_populates="devices")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(String(256))
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class KeyBundle(Base):
    """
    Public key material only. Private keys NEVER touch the server - they're
    generated and stored on-device (Keychain / Android Keystore). This table
    is what step 3's "public key exchange" actually exchanges.

    identity_key   = long-term Ed25519 signing key (crypto_sign)
    signed_prekey  = X25519 key used for the actual encryption handshake,
                     signed by identity_key so the other party can verify
                     it wasn't tampered with in transit.
    """
    __tablename__ = "key_bundles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True)

    identity_key_public: Mapped[bytes] = mapped_column(LargeBinary)
    signed_prekey_public: Mapped[bytes] = mapped_column(LargeBinary)
    prekey_signature: Mapped[bytes] = mapped_column(LargeBinary)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    user: Mapped["User"] = relationship(back_populates="key_bundle")


class Message(Base):
    """
    Server never sees plaintext - ciphertext is whatever the client
    produced using the session key derived from the step 3 key exchange.
    The server's only job here is: persist it durably, dedupe it, and
    deliver it (live over WebSocket if the recipient is connected, or via
    the sync endpoint whenever they next reconnect).

    client_id is generated on-device when the message is queued into the
    local outbox (step 4's client half) - BEFORE it's known whether the
    send will succeed. If the client retries a send after a dropped
    connection, it retries with the SAME client_id, and the unique
    constraint below makes that retry a no-op instead of a duplicate.
    """
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("sender_id", "client_id", name="uq_sender_client_id"),
        Index("ix_messages_recipient_created", "recipient_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(64))

    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id"))

    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Media(Base):
    """
    Tracks an upload's lifecycle. The actual bytes live in R2 under
    `storage_key` - this row is just metadata + upload-in-progress state.

    status:
      uploading - multipart upload created, parts not yet all confirmed
      ready     - completed and confirmed to exist in the bucket
      aborted   - explicitly cancelled (s3_upload_id aborted, key never used)
    """
    __tablename__ = "media"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    uploader_id: Mapped[str] = mapped_column(ForeignKey("users.id"))

    storage_key: Mapped[str] = mapped_column(String(512))
    filename: Mapped[str] = mapped_column(String(256))
    content_type: Mapped[str] = mapped_column(String(128))
    total_size_bytes: Mapped[int] = mapped_column()

    is_multipart: Mapped[bool] = mapped_column(Boolean, default=False)
    s3_upload_id: Mapped[str | None] = mapped_column(String(256), nullable=True)

    status: Mapped[str] = mapped_column(String(16), default="uploading")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LinkPreview(Base):
    """
    Cached OG-tag lookups, keyed by URL. Re-fetching every time the same
    link gets pasted (or re-synced to a second device) is wasteful and
    slow - cache for a week, then treat as stale.
    """
    __tablename__ = "link_previews"

    url_hash: Mapped[str] = mapped_column(String(64), primary_key=True)  # sha256 hex of the URL
    url: Mapped[str] = mapped_column(String(2048))

    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    fetch_failed: Mapped[bool] = mapped_column(Boolean, default=False)

    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
