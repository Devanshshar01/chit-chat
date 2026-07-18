"""
Wraps boto3 against an S3-compatible endpoint. R2 IS S3-compatible, so
this is just boto3 with endpoint_url set to R2's URL and region_name="auto" -
nothing R2-specific beyond that. Same code would work against real S3,
MinIO, or (for testing) a local moto server - only the endpoint changes.

Presigned URLs mean the actual file bytes never pass through this
backend - the client PUTs directly to R2. The backend's job is only:
issue presigned URLs, track upload state, and orchestrate multipart
completion.
"""
import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import settings


def get_s3_client(endpoint_url: str | None = None):
    """
    endpoint_url override exists purely for testing against a local
    moto server - production always uses settings.r2_endpoint_url.
    """
    resolved_endpoint = endpoint_url or settings.s3_endpoint_url_override or settings.r2_endpoint_url
    return boto3.client(
        "s3",
        endpoint_url=resolved_endpoint,
        aws_access_key_id=settings.r2_access_key_id or "test",
        aws_secret_access_key=settings.r2_secret_access_key or "test",
        region_name="auto",
        config=BotoConfig(signature_version="s3v4"),
    )


def build_storage_key(user_id: str, filename: str, media_id: str) -> str:
    # media_id in the path guarantees uniqueness even for repeated filenames
    safe_name = filename.replace("/", "_").replace("\\", "_")
    return f"{user_id}/{media_id}/{safe_name}"


# ---------- simple (single PUT) upload path - small files ----------

def presign_put(client, bucket: str, key: str, content_type: str) -> str:
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=settings.presigned_url_expire_seconds,
    )


# ---------- multipart upload path - large files ----------

def create_multipart_upload(client, bucket: str, key: str, content_type: str) -> str:
    resp = client.create_multipart_upload(Bucket=bucket, Key=key, ContentType=content_type)
    return resp["UploadId"]


def presign_upload_part(client, bucket: str, key: str, upload_id: str, part_number: int) -> str:
    return client.generate_presigned_url(
        "upload_part",
        Params={
            "Bucket": bucket, "Key": key,
            "UploadId": upload_id, "PartNumber": part_number,
        },
        ExpiresIn=settings.presigned_url_expire_seconds,
    )


def complete_multipart_upload(client, bucket: str, key: str, upload_id: str, parts: list[dict]) -> None:
    # parts must be [{"PartNumber": int, "ETag": str}, ...] in ascending order
    client.complete_multipart_upload(
        Bucket=bucket, Key=key, UploadId=upload_id,
        MultipartUpload={"Parts": sorted(parts, key=lambda p: p["PartNumber"])},
    )


def abort_multipart_upload(client, bucket: str, key: str, upload_id: str) -> None:
    client.abort_multipart_upload(Bucket=bucket, Key=key, UploadId=upload_id)


# ---------- retrieval ----------

def presign_get(client, bucket: str, key: str) -> str:
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=settings.presigned_url_expire_seconds,
    )


def head_object(client, bucket: str, key: str) -> dict | None:
    try:
        return client.head_object(Bucket=bucket, Key=key)
    except ClientError:
        return None
