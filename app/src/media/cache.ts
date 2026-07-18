/**
 * Caches downloaded media on-device so re-opening a chat doesn't
 * re-download the same photo/video every time. Capped total size with
 * least-recently-accessed eviction - never grows unbounded.
 */
import RNFS from "react-native-fs";

import { getDb } from "../outbox/db";

const CACHE_DIR = `${RNFS.CachesDirectoryPath}/unnamed-chat-media`;
const MAX_CACHE_BYTES = 500 * 1024 * 1024; // 500MB - arbitrary, tune later

async function ensureCacheDir(): Promise<void> {
  const exists = await RNFS.exists(CACHE_DIR);
  if (!exists) await RNFS.mkdir(CACHE_DIR);
}

interface CacheRow {
  media_id: string;
  local_path: string;
  size_bytes: number;
  last_accessed_at: string;
}

function getCacheRow(mediaId: string): CacheRow | null {
  const result = getDb().execute(`SELECT * FROM media_cache WHERE media_id = ?`, [mediaId]);
  const rows = result.rows?._array as CacheRow[] | undefined;
  return rows && rows.length > 0 ? rows[0] : null;
}

function touchCacheRow(mediaId: string): void {
  getDb().execute(
    `UPDATE media_cache SET last_accessed_at = ? WHERE media_id = ?`,
    [new Date().toISOString(), mediaId]
  );
}

/**
 * Returns a local file:// path for this media, downloading it first if
 * it isn't already cached. Safe to call every time the chat UI wants to
 * render this media - repeat calls just hit the cache.
 */
export async function getOrDownload(mediaId: string, downloadUrl: string): Promise<string> {
  const existing = getCacheRow(mediaId);
  if (existing) {
    const stillThere = await RNFS.exists(existing.local_path);
    if (stillThere) {
      touchCacheRow(mediaId);
      return existing.local_path;
    }
    // row says cached but file's gone (OS cache-clear, etc) - fall through and re-download
    getDb().execute(`DELETE FROM media_cache WHERE media_id = ?`, [mediaId]);
  }

  await ensureCacheDir();
  const localPath = `${CACHE_DIR}/${mediaId}`;

  const { promise } = RNFS.downloadFile({ fromUrl: downloadUrl, toFile: localPath });
  await promise;

  const stat = await RNFS.stat(localPath);
  getDb().execute(
    `INSERT INTO media_cache (media_id, local_path, size_bytes, last_accessed_at)
     VALUES (?, ?, ?, ?)`,
    [mediaId, localPath, Number(stat.size), new Date().toISOString()]
  );

  await evictIfNeeded();
  return localPath;
}

/** Deletes least-recently-accessed cached files until under the size cap. */
export async function evictIfNeeded(maxTotalBytes: number = MAX_CACHE_BYTES): Promise<void> {
  const result = getDb().execute(
    `SELECT * FROM media_cache ORDER BY last_accessed_at ASC`
  );
  const rows = (result.rows?._array as CacheRow[]) ?? [];

  const totalBytes = rows.reduce((sum, r) => sum + r.size_bytes, 0);
  if (totalBytes <= maxTotalBytes) return;

  let overBudget = totalBytes - maxTotalBytes;
  for (const row of rows) {
    if (overBudget <= 0) break;
    try {
      await RNFS.unlink(row.local_path);
    } catch {
      // file already gone - fine, still remove the tracking row
    }
    getDb().execute(`DELETE FROM media_cache WHERE media_id = ?`, [row.media_id]);
    overBudget -= row.size_bytes;
  }
}

export async function clearCache(): Promise<void> {
  const exists = await RNFS.exists(CACHE_DIR);
  if (exists) await RNFS.unlink(CACHE_DIR);
  getDb().execute(`DELETE FROM media_cache`);
}
