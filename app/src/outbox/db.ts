/**
 * Local on-device database. Two tables:
 *
 *   outbox   - messages this device wants to send, queued the instant the
 *              user hits send, independent of whether we're online.
 *   messages - the merged local view of the whole conversation (sent +
 *              received), what the chat UI (step 5) actually renders from.
 *
 * Using react-native-quick-sqlite - synchronous API, no native module
 * headaches with Hermes. If the app ends up on Expo instead of bare RN,
 * swap this file's driver import for expo-sqlite; nothing else in
 * outboxManager.ts needs to change since it only calls the functions
 * exported here.
 *
 *   npm install react-native-quick-sqlite
 */
import { open, type QuickSQLiteConnection } from "react-native-quick-sqlite";

let db: QuickSQLiteConnection | null = null;

export function getDb(): QuickSQLiteConnection {
  if (db) return db;
  db = open({ name: "unnamed-chat.db" });

  db.execute(`
    CREATE TABLE IF NOT EXISTS outbox (
      client_id TEXT PRIMARY KEY,
      recipient_username TEXT NOT NULL,
      ciphertext TEXT NOT NULL,       -- base64
      status TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,            -- server-assigned id once known, else client_id
      client_id TEXT NOT NULL,
      direction TEXT NOT NULL,        -- 'outgoing' | 'incoming'
      peer_username TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivered_at TEXT,              -- outgoing only: when the recipient's device got it
      read_at TEXT,                   -- outgoing only: when the recipient actually read it
      read_receipt_sent INTEGER NOT NULL DEFAULT 0,  -- incoming only: have we told the sender we've seen this
      UNIQUE(client_id)
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS media_cache (
      media_id TEXT PRIMARY KEY,
      local_path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      last_accessed_at TEXT NOT NULL
    );
  `);

  return db;
}

export function getLastSyncCursor(): string | null {
  const result = getDb().execute("SELECT value FROM sync_state WHERE key = 'last_sync_cursor'");
  const row = result.rows?._array[0];
  return row ? (row.value as string) : null;
}

export function setLastSyncCursor(iso: string): void {
  getDb().execute(
    `INSERT INTO sync_state (key, value) VALUES ('last_sync_cursor', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [iso]
  );
}

export function getLastSentStatusCursor(): string | null {
  const result = getDb().execute("SELECT value FROM sync_state WHERE key = 'last_sent_status_cursor'");
  const row = result.rows?._array[0];
  return row ? (row.value as string) : null;
}

export function setLastSentStatusCursor(iso: string): void {
  getDb().execute(
    `INSERT INTO sync_state (key, value) VALUES ('last_sent_status_cursor', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [iso]
  );
}

export interface LocalMessage {
  id: string;
  client_id: string;
  direction: 'outgoing' | 'incoming';
  peer_username: string;
  ciphertext: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  read_receipt_sent: number;
}

/** Only two users exist right now, so "all messages" IS the one conversation. */
export function getAllMessages(): LocalMessage[] {
  const result = getDb().execute(`SELECT * FROM messages ORDER BY created_at ASC`);
  return (result.rows?._array as LocalMessage[]) ?? [];
}
