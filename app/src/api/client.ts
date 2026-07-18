/**
 * Thin fetch wrapper matching the backend's actual routes (app/routers/).
 * Update API_BASE_URL once the backend has a real deployment target -
 * localhost only makes sense while developing against a device on the
 * same network / an emulator with adb reverse.
 */
import { PublicKeyBundle } from "../crypto/identity";

const API_BASE_URL = "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body?.error ?? body;
    throw new ApiError(res.status, err?.code ?? "unknown", err?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function login(username: string, passcode: string, deviceName: string): Promise<TokenPair> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, passcode, device_name: deviceName }),
  });
  return handle<TokenPair>(res);
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return handle<TokenPair>(res);
}

export async function uploadKeyBundle(accessToken: string, bundle: PublicKeyBundle) {
  const res = await fetch(`${API_BASE_URL}/keys/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      identity_key_public: bundle.identityKeyPublic,
      signed_prekey_public: bundle.signedPrekeyPublic,
      prekey_signature: bundle.prekeySignature,
    }),
  });
  return handle(res);
}

export async function fetchPeerKeyBundle(accessToken: string, username: string) {
  const res = await fetch(`${API_BASE_URL}/keys/${username}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handle<{
    user_id: string;
    identity_key_public: string;
    signed_prekey_public: string;
    prekey_signature: string;
  }>(res);
}

export interface SyncedMessage {
  id: string;
  client_id: string;
  sender_username: string;
  ciphertext: string; // base64
  created_at: string; // ISO
}

/** Pull-based catch-up for anything missed while the WebSocket was down. */
export async function syncMessages(accessToken: string, since?: string): Promise<SyncedMessage[]> {
  const url = new URL(`${API_BASE_URL}/messages/sync`);
  if (since) url.searchParams.set("since", since);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handle<SyncedMessage[]>(res);
}

export interface SentMessageStatus {
  id: string;
  client_id: string;
  delivered_at: string | null;
  read_at: string | null;
}

/** Catches up on delivered_at/read_at changes to OUR sent messages that happened while we were offline. */
export async function syncSentStatus(accessToken: string, since?: string): Promise<SentMessageStatus[]> {
  const url = new URL(`${API_BASE_URL}/messages/sent-status`);
  if (since) url.searchParams.set("since", since);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handle<SentMessageStatus[]>(res);
}

export interface PresenceResult {
  username: string;
  is_online: boolean;
  last_seen_at: string | null;
}

export async function fetchPresence(accessToken: string, username: string): Promise<PresenceResult> {
  const res = await fetch(`${API_BASE_URL}/users/${username}/presence`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handle<PresenceResult>(res);
}

export function wsUrl(accessToken: string): string {
  const base = API_BASE_URL.replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(accessToken)}`;
}

// ---------- media pipeline ----------

export interface UploadPart {
  part_number: number;
  url: string;
}

export interface InitiateUploadResponse {
  media_id: string;
  is_multipart: boolean;
  chunk_size_bytes: number;
  put_url?: string;
  parts?: UploadPart[];
}

export async function initiateUpload(
  accessToken: string,
  filename: string,
  contentType: string,
  totalSizeBytes: number
): Promise<InitiateUploadResponse> {
  const res = await fetch(`${API_BASE_URL}/media/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      filename,
      content_type: contentType,
      total_size_bytes: totalSizeBytes,
    }),
  });
  return handle<InitiateUploadResponse>(res);
}

export interface MediaMetadata {
  id: string;
  filename: string;
  content_type: string;
  total_size_bytes: number;
  status: string;
  download_url: string | null;
  created_at: string;
}

export async function completeUpload(
  accessToken: string,
  mediaId: string,
  parts: { part_number: number; etag: string }[]
): Promise<MediaMetadata> {
  const res = await fetch(`${API_BASE_URL}/media/uploads/${mediaId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ parts }),
  });
  return handle<MediaMetadata>(res);
}

export async function getMedia(accessToken: string, mediaId: string): Promise<MediaMetadata> {
  const res = await fetch(`${API_BASE_URL}/media/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return handle<MediaMetadata>(res);
}

// ---------- link previews ----------

export interface LinkPreviewResult {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  available: boolean;
}

/** Backend does the actual fetching (SSRF-guarded, cached) - tested end-to-end there. */
export async function fetchLinkPreview(accessToken: string, url: string): Promise<LinkPreviewResult> {
  const res = await fetch(`${API_BASE_URL}/link-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ url }),
  });
  return handle<LinkPreviewResult>(res);
}
