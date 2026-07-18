/**
 * Chunked upload matching the backend contract exactly (verified in
 * backend/app/routers/media.py - both the single-PUT and multipart paths
 * were tested end-to-end against a real S3-compatible server; this is
 * the client-side mirror of that same protocol, unverified on a real
 * device since this sandbox has no RN runtime to execute it in).
 *
 * Reads the file in chunks via react-native-fs rather than loading the
 * whole thing into memory - matters once "large file" means a 200MB
 * video, not just a photo.
 */
import RNFS from "react-native-fs";
import sodium from "libsodium-wrappers";

import { initiateUpload, completeUpload, type MediaMetadata } from "../api/client";
import { compressForUpload } from "./compress";

export interface UploadProgress {
  bytesSent: number;
  totalBytes: number;
}

async function readChunkAsBytes(path: string, position: number, length: number): Promise<Uint8Array> {
  const base64Chunk = await RNFS.read(path, length, position, "base64");
  await sodium.ready;
  return sodium.from_base64(base64Chunk);
}

/**
 * Compresses (if applicable), uploads, and confirms with the backend.
 * Returns the final MediaMetadata once the backend has verified the
 * object actually landed in the bucket.
 */
export async function uploadMedia(
  accessToken: string,
  localUri: string,
  filename: string,
  contentType: string,
  onProgress?: (p: UploadProgress) => void
): Promise<MediaMetadata> {
  const compressed = await compressForUpload(localUri, contentType);
  const totalBytes = compressed.sizeBytes;

  const init = await initiateUpload(accessToken, filename, contentType, totalBytes);

  if (!init.is_multipart) {
    if (!init.put_url) throw new Error("backend said simple upload but sent no put_url");
    const bytes = await readChunkAsBytes(compressed.uri, 0, totalBytes);
    const res = await fetch(init.put_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes,
    });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    onProgress?.({ bytesSent: totalBytes, totalBytes });
    return completeUpload(accessToken, init.media_id, []);
  }

  if (!init.parts) throw new Error("backend said multipart but sent no parts");
  const chunkSize = init.chunk_size_bytes;
  const completedParts: { part_number: number; etag: string }[] = [];
  let bytesSent = 0;

  for (const part of init.parts) {
    const start = (part.part_number - 1) * chunkSize;
    const length = Math.min(chunkSize, totalBytes - start);
    const bytes = await readChunkAsBytes(compressed.uri, start, length);

    const res = await fetch(part.url, { method: "PUT", body: bytes });
    if (!res.ok) throw new Error(`part ${part.part_number} upload failed: ${res.status}`);

    const etag = res.headers.get("ETag");
    if (!etag) throw new Error(`part ${part.part_number} response had no ETag header`);
    completedParts.push({ part_number: part.part_number, etag });

    bytesSent += length;
    onProgress?.({ bytesSent, totalBytes });
  }

  return completeUpload(accessToken, init.media_id, completedParts);
}
