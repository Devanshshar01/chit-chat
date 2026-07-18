import base64
from pydantic import BaseModel, field_validator


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


# ---------- messages (offline outbox pattern) ----------

class MessageSend(BaseModel):
    client_id: str            # generated on-device when queued into the local outbox
    recipient_username: str
    ciphertext: str           # base64 - opaque to the server


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


class PresenceResponse(BaseModel):
    username: str
    is_online: bool
    last_seen_at: str | None


class SentMessageStatus(BaseModel):
    id: str
    client_id: str
    delivered_at: str | None
    read_at: str | None


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
