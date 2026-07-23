import base64
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------- auth ----------

class LoginRequest(BaseModel):
    username: str
    passcode: str
    device_name: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ---------- users ----------

class UserPublic(BaseModel):
    id: str
    display_name: str
    username: str

    class Config:
        from_attributes = True


# ---------- devices / push ----------

class PushTokenRequest(BaseModel):
    push_token: str
    device_name: str | None = None


# ---------- crypto identity ----------
# Public keys travel as base64 over the wire; stored as raw bytes in the DB.

class KeyBundleUpload(BaseModel):
    identity_key_public: str      # base64, 32 bytes raw (Ed25519 pub)
    signed_prekey_public: str     # base64, 32 bytes raw (X25519 pub)
    prekey_signature: str         # base64, 64 bytes raw (Ed25519 signature)

    @field_validator("identity_key_public", "signed_prekey_public", "prekey_signature")
    @classmethod
    def must_be_valid_b64(cls, v: str) -> str:
        try:
            base64.b64decode(v, validate=True)
        except Exception:
            raise ValueError("must be valid base64")
        return v


class KeyBundlePublic(BaseModel):
    user_id: str
    identity_key_public: str
    signed_prekey_public: str
    prekey_signature: str


# ---------- X3DH device bundles ----------

def _decode_b64(value: str, field_name: str, expected_bytes: int | None = None) -> str:
    try:
        decoded = base64.b64decode(value, validate=True)
    except Exception as exc:
        raise ValueError(f"{field_name} must be valid base64") from exc
    if expected_bytes is not None and len(decoded) != expected_bytes:
        raise ValueError(f"{field_name} must decode to {expected_bytes} bytes")
    return value


class DeviceKeyBundleUpload(BaseModel):
    identity_signing_key_public: str
    identity_dh_key_public: str
    signed_prekey_id: str = Field(min_length=1, max_length=64)
    signed_prekey_public: str
    signed_prekey_signature: str

    @field_validator("identity_signing_key_public", "identity_dh_key_public", "signed_prekey_public")
    @classmethod
    def must_be_32_byte_key(cls, value: str, info) -> str:
        return _decode_b64(value, info.field_name, 32)

    @field_validator("signed_prekey_signature")
    @classmethod
    def must_be_ed25519_signature(cls, value: str) -> str:
        return _decode_b64(value, "signed_prekey_signature", 64)


class OneTimePreKeyUpload(BaseModel):
    key_id: str = Field(min_length=1, max_length=64)
    public_key: str

    @field_validator("public_key")
    @classmethod
    def must_be_x25519_public_key(cls, value: str) -> str:
        return _decode_b64(value, "public_key", 32)


class OneTimePreKeyBatchUpload(BaseModel):
    prekeys: list[OneTimePreKeyUpload] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def key_ids_must_be_unique(self):
        if len({prekey.key_id for prekey in self.prekeys}) != len(self.prekeys):
            raise ValueError("one-time prekey key_id values must be unique within a batch")
        return self


class OneTimePreKeyPublic(BaseModel):
    key_id: str
    public_key: str


class DeviceKeyBundlePublic(BaseModel):
    device_id: str
    device_name: str
    identity_signing_key_public: str
    identity_dh_key_public: str
    signed_prekey_id: str
    signed_prekey_public: str
    signed_prekey_signature: str
    one_time_prekeys_available: int


class DeviceKeyBundleClaim(DeviceKeyBundlePublic):
    one_time_prekey: OneTimePreKeyPublic | None = None


class PrekeyUploadResult(BaseModel):
    accepted: int
    available: int


# ---------- messages (offline outbox pattern) ----------

class MessageSend(BaseModel):
    client_id: str            # generated on-device when queued into the local outbox
    recipient_username: str
    ciphertext: str           # base64 - opaque to the server


class PrekeyMessageHeader(BaseModel):
    """Public X3DH setup data carried only on the first ratchet message."""
    initiator_identity_dh_key: str
    initiator_ephemeral_key: str
    recipient_signed_prekey_id: str = Field(min_length=1, max_length=64)
    recipient_one_time_prekey_id: str | None = Field(default=None, max_length=64)

    @field_validator("initiator_identity_dh_key", "initiator_ephemeral_key")
    @classmethod
    def must_have_x25519_public_key(cls, value: str, info) -> str:
        return _decode_b64(value, info.field_name, 32)


class EncryptedMessageEnvelope(BaseModel):
    """Opaque Double Ratchet ciphertext plus relay-safe header metadata."""
    type: str = "encrypted_message"
    client_id: str = Field(min_length=1, max_length=64)
    recipient_username: str = Field(min_length=1, max_length=32)
    recipient_device_id: str = Field(min_length=1, max_length=36)
    protocol_version: int = Field(default=1, ge=1, le=1)
    session_id: str = Field(min_length=1, max_length=64)
    ratchet_public_key: str
    message_number: int = Field(ge=0)
    previous_chain_length: int = Field(ge=0)
    nonce: str
    ciphertext: str = Field(min_length=1)
    prekey_header: PrekeyMessageHeader | None = None

    @field_validator("ratchet_public_key")
    @classmethod
    def must_have_x25519_ratchet_key(cls, value: str) -> str:
        return _decode_b64(value, "ratchet_public_key", 32)

    @field_validator("nonce")
    @classmethod
    def must_have_xchacha_nonce(cls, value: str) -> str:
        return _decode_b64(value, "nonce", 24)

    @field_validator("ciphertext")
    @classmethod
    def must_have_ciphertext(cls, value: str) -> str:
        return _decode_b64(value, "ciphertext")


class MessageAck(BaseModel):
    id: str
    client_id: str
    created_at: str
    delivered: bool           # True if pushed live to an active recipient connection


class MessageSyncItem(BaseModel):
    id: str
    client_id: str
    sender_username: str
    ciphertext: str
    created_at: str
    protocol_version: int = 0
    sender_device_id: str | None = None
    recipient_device_id: str | None = None
    session_id: str | None = None
    ratchet_public_key: str | None = None
    message_number: int | None = None
    previous_chain_length: int | None = None
    nonce: str | None = None
    prekey_header: dict[str, Any] | None = None


class PresenceResponse(BaseModel):
    username: str
    is_online: bool
    last_seen_at: str | None


class SentMessageStatus(BaseModel):
    id: str
    client_id: str
    delivered_at: str | None
    read_at: str | None
    recipient_device_id: str | None = None


# ---------- media pipeline ----------

class InitiateUploadRequest(BaseModel):
    filename: str
    content_type: str
    total_size_bytes: int


class UploadPart(BaseModel):
    part_number: int
    url: str


class InitiateUploadResponse(BaseModel):
    media_id: str
    is_multipart: bool
    chunk_size_bytes: int
    # exactly one of these two will be populated, depending on is_multipart
    put_url: str | None = None
    parts: list[UploadPart] | None = None


class CompletedPart(BaseModel):
    part_number: int
    etag: str


class CompleteUploadRequest(BaseModel):
    parts: list[CompletedPart] = []  # empty/ignored for the simple (non-multipart) path


class MediaMetadata(BaseModel):
    id: str
    filename: str
    content_type: str
    total_size_bytes: int
    status: str
    download_url: str | None = None
    created_at: str


# ---------- link previews ----------

class LinkPreviewRequest(BaseModel):
    url: str


class LinkPreviewResponse(BaseModel):
    url: str
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    available: bool  # False if fetch/parse failed - caller should just render a plain link
