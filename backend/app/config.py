"""
Central config. All environment-driven values live here so nothing
is hardcoded deeper in the app.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "unnamed-chat"
    database_url: str = "sqlite+aiosqlite:///./app.db"

    jwt_secret: str = "dev-secret-change-me-in-prod"  # override via env in real deploy
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24        # 24h
    refresh_token_expire_days: int = 30

    # R2 is S3-compatible - boto3 talks to it the same as any S3-compatible
    # store, just with a custom endpoint_url and region_name="auto".
    # Get these from the Cloudflare dashboard: R2 -> Manage API tokens.
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "unnamed-chat-media"

    # Only set in test/dev to point at a local S3-compatible server
    # (e.g. moto) instead of real R2. Leave unset in production.
    s3_endpoint_url_override: str = ""

    # Path to a Firebase service-account JSON for FCM push notifications
    # (Firebase console -> Project settings -> Service accounts). Leave
    # unset to disable push - offline recipients still catch up via
    # /messages/sync on their next connect.
    firebase_credentials_file: str = ""

    # Multipart upload threshold/part size. S3-compatible APIs require
    # every part except the last to be >= 5MiB.
    multipart_threshold_bytes: int = 8 * 1024 * 1024   # 8 MiB
    multipart_chunk_size_bytes: int = 8 * 1024 * 1024  # 8 MiB
    presigned_url_expire_seconds: int = 60 * 15        # 15 min

    @property
    def r2_endpoint_url(self) -> str:
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
