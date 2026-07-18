/**
 * Compresses media before it ever hits the outbox/uploader. Runs on-device,
 * before any network activity - the whole point is to not upload a
 * 12MB phone-camera photo when a 400KB compressed version looks the same
 * over chat.
 *
 * npm install react-native-compressor (already added to package.json)
 */
import { Image as ImageCompressor, Video as VideoCompressor } from "react-native-compressor";

export interface CompressedFile {
  uri: string;
  sizeBytes: number;
}

async function sizeOf(uri: string): Promise<number> {
  const RNFS = require("react-native-fs");
  const stat = await RNFS.stat(uri);
  return Number(stat.size);
}

export async function compressImage(uri: string): Promise<CompressedFile> {
  const resultUri = await ImageCompressor.compress(uri, {
    compressionMethod: "auto",
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
  });
  return { uri: resultUri, sizeBytes: await sizeOf(resultUri) };
}

export async function compressVideo(
  uri: string,
  onProgress?: (fraction: number) => void
): Promise<CompressedFile> {
  const resultUri = await VideoCompressor.compress(
    uri,
    { compressionMethod: "auto" },
    (progress) => onProgress?.(progress)
  );
  return { uri: resultUri, sizeBytes: await sizeOf(resultUri) };
}

/** Picks the right compressor based on mime type, or passes through unchanged for anything else (e.g. audio, docs). */
export async function compressForUpload(uri: string, contentType: string): Promise<CompressedFile> {
  if (contentType.startsWith("image/")) return compressImage(uri);
  if (contentType.startsWith("video/")) return compressVideo(uri);
  return { uri, sizeBytes: await sizeOf(uri) };
}
