"""
Schema for steps 1-4: users, devices, refresh tokens, crypto key bundles,
and (new in step 4) messages for the offline outbox pattern.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, LargeBinary, Boolean, UniqueConstraint, Index, Integer, JSON, text
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
    crypto_bundle: Mapped["DeviceKeyBundle | None"] = relationship(back_populates="device", uselist=False, cascade="all, delete-orphan")
    one_time_prekeys: Mapped[list["OneTimePreKey"]] = relationship(back_populates="device", foreign_keys="OneTimePreKey.device_id", cascade="all, delete-orphan")


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


class DeviceKeyBundle(Base):
    """X3DH public material for one concrete device.

    The legacy ``KeyBundle`` above remains user-scoped for compatibility.
    New E2EE sessions use this device-scoped bundle exclusively. Private keys,
    X3DH secrets, and ratchet state never enter this table.
    """
    __tablename__ = "device_key_bundles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"), unique=True)

    identity_signing_key_public: Mapped[bytes] = mapped_column(LargeBinary)
    identity_dh_key_public: Mapped[bytes] = mapped_column(LargeBinary)
    signed_prekey_id: Mapped[str] = mapped_column(String(64))
    signed_prekey_public: Mapped[bytes] = mapped_column(LargeBinary)
    signed_prekey_signature: Mapped[bytes] = mapped_column(LargeBinary)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    device: Mapped["Device"] = relationship(back_populates="crypto_bundle")


class OneTimePreKey(Base):
    """Public one-time X25519 prekey, atomically claimed exactly once."""
    __tablename__ = "one_time_prekeys"
    __table_args__ = (
        UniqueConstraint("device_id", "key_id", name="uq_one_time_prekey_device_key"),
        Index("ix_one_time_prekeys_available", "device_id", "claimed_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    device_id: Mapped[str] = mapped_column(ForeignKey("devices.id"))
    key_id: Mapped[str] = mapped_column(String(64))
    public_key: Mapped[bytes] = mapped_column(LargeBinary)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    claimed_by_device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    device: Mapped["Device"] = relationship(back_populates="one_time_prekeys", foreign_keys=[device_id])


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
        UniqueConstraint("sender_device_id", "recipient_device_id", "client_id", name="uq_message_device_envelope"),
        Index("ix_messages_recipient_created", "recipient_id", "created_at"),
        Index("ix_messages_recipient_device_created", "recipient_device_id", "created_at"),
        Index(
            "uq_messages_legacy_sender_client",
            "sender_id",
            "client_id",
            unique=True,
            postgresql_where=text("protocol_version = 0"),
            sqlite_where=text("protocol_version = 0"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    client_id: Mapped[str] = mapped_column(String(64))

    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id"))

    ciphertext: Mapped[bytes] = mapped_column(LargeBinary)

    # Protocol version 0 is the legacy base64(JSON) payload. Version 1 is
    # an opaque X3DH + Double Ratchet envelope, encrypted entirely client-side.
    protocol_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    sender_device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    recipient_device_id: Mapped[str | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ratchet_public_key: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    message_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    previous_chain_length: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nonce: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    prekey_header: Mapped[dict | None] = mapped_column(JSON, nullable=True)

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
