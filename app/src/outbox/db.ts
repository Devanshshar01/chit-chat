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
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS read_receipt_queue (
      message_id TEXT PRIMARY KEY,
      queued_at TEXT NOT NULL
    );
  `);

  // Additive columns on an existing table: guarded ALTERs so upgrading
  // an installed app keeps its data (SQLite has no ADD COLUMN IF NOT EXISTS).
  ensureColumn(db, 'messages', 'starred', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'messages', 'deleted_locally', 'INTEGER NOT NULL DEFAULT 0');

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

function ensureColumn(conn: QuickSQLiteConnection, table: string, column: string, definition: string): void {
  const info = conn.execute(`PRAGMA table_info(${table})`);
  const columns = (info.rows?._array ?? []).map((row) => row.name as string);
  if (!columns.includes(column)) {
    conn.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// ---------- settings (theme, font size, notification prefs, ...) ----------

export function getSetting(key: string): string | null {
  const result = getDb().execute('SELECT value FROM settings WHERE key = ?', [key]);
  const row = result.rows?._array[0];
  return row ? (row.value as string) : null;
}

export function setSetting(key: string, value: string): void {
  getDb().execute(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// ---------- read receipt queue (crash-safe at-least-once delivery) ----------

export function queueReadReceipts(messageIds: string[]): void {
  const now = new Date().toISOString();
  for (const id of messageIds) {
    getDb().execute(
      'INSERT OR IGNORE INTO read_receipt_queue (message_id, queued_at) VALUES (?, ?)',
      [id, now]
    );
  }
}

export function getQueuedReadReceipts(): string[] {
  const result = getDb().execute('SELECT message_id FROM read_receipt_queue ORDER BY queued_at ASC');
  return (result.rows?._array ?? []).map((row) => row.message_id as string);
}

export function clearQueuedReadReceipts(messageIds: string[]): void {
  if (messageIds.length === 0) return;
  const placeholders = messageIds.map(() => '?').join(',');
  getDb().execute(`DELETE FROM read_receipt_queue WHERE message_id IN (${placeholders})`, messageIds);
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
  starred: number;
  deleted_locally: number;
}

/** Only two users exist right now, so "all messages" IS the one conversation. */
export function getAllMessages(): LocalMessage[] {
  const result = getDb().execute(
    `SELECT * FROM messages WHERE deleted_locally = 0 ORDER BY created_at ASC`
  );
  return (result.rows?._array as LocalMessage[]) ?? [];
}

export function setMessageStarred(messageId: string, starred: boolean): void {
  getDb().execute('UPDATE messages SET starred = ? WHERE id = ?', [starred ? 1 : 0, messageId]);
}

/** "Delete for me": hides the message locally; the peer's copy is untouched. */
export function deleteMessageLocally(messageId: string): void {
  getDb().execute('UPDATE messages SET deleted_locally = 1 WHERE id = ?', [messageId]);
}
