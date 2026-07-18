/**
 * The offline outbox pattern, extended in step 8 with presence and read
 * receipts, wired to the tested backend contract in
 * backend/app/routers/messages.py and backend/app/routers/users.py:
 *
 *   - enqueue() writes to local SQLite FIRST, returns instantly (the UI
 *     renders the message before any network activity happens)
 *   - a persistent WebSocket flushes pending rows in order; each carries
 *     the same client_id every retry, so a dropped connection mid-send
 *     can safely resend without the backend creating a duplicate
 *     (verified server-side: same client_id twice -> same row back)
 *   - if the socket is down, flush() is a no-op until reconnect; nothing
 *     is lost because it's sitting in outbox with status='pending'
 *   - on connect (and periodically), also calls /messages/sync so
 *     anything the *other* side sent while we were offline gets pulled
 *     down even if the live push never had anywhere to land
 *   - markAsRead() sends a "read" envelope over the socket; the backend
 *     pushes a live read_receipt back to the sender if they're connected
 *   - /messages/sent-status catches a sender up on delivered_at/read_at
 *     changes to messages THEY sent, in case the live read_receipt push
 *     had nowhere to land (sender was offline when the recipient read it)
 *   - presence pushes from the backend update peer online/last-seen state
 *
 * Requires (not yet installed anywhere - written against these APIs):
 *   npm install react-native-get-random-values uuid
 */
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

import {
  getDb, getLastSyncCursor, setLastSyncCursor,
  getLastSentStatusCursor, setLastSentStatusCursor,
} from "./db";
import { wsUrl, syncMessages, syncSentStatus, type SyncedMessage } from "../api/client";

const MAX_BACKOFF_MS = 30_000;

type IncomingHandler = (msg: SyncedMessage) => void;
type StatusChangeHandler = () => void; // fired whenever delivered_at/read_at changes - UI just re-reads from SQLite
type PresenceHandler = (username: string, isOnline: boolean, lastSeenAt: string) => void;

interface Handlers {
  onIncoming: IncomingHandler;
  onStatusChange?: StatusChangeHandler;
  onPresence?: PresenceHandler;
}

export class OutboxManager {
  private ws: WebSocket | null = null;
  private accessToken: string;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private handlers: Handlers;

  constructor(accessToken: string, handlers: Handlers) {
    this.accessToken = accessToken;
    this.handlers = handlers;
  }

  /** Call once when the app starts (or on login). */
  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  /** Queues a message for sending. Returns immediately - this is the whole point. */
  enqueue(recipientUsername: string, ciphertextB64: string): string {
    const clientId = uuidv4();
    const createdAt = new Date().toISOString();

    getDb().execute(
      `INSERT INTO outbox (client_id, recipient_username, ciphertext, status, attempts, created_at)
       VALUES (?, ?, ?, 'pending', 0, ?)`,
      [clientId, recipientUsername, ciphertextB64, createdAt]
    );
    getDb().execute(
      `INSERT INTO messages (id, client_id, direction, peer_username, ciphertext, created_at)
       VALUES (?, ?, 'outgoing', ?, ?, ?)`,
      [clientId, clientId, recipientUsername, ciphertextB64, createdAt]
    );

    this.flush();
    return clientId;
  }

  /**
   * Marks a set of locally-stored incoming messages as read and tells
   * the backend, which will notify the sender live if they're
   * connected. Safe to call repeatedly - already-marked messages are
   * just skipped locally, and the backend is idempotent on its side too
   * (re-marking an already-read message is a no-op there).
   */
  markAsRead(messageIds: string[]): void {
    if (messageIds.length === 0) return;

    const placeholders = messageIds.map(() => "?").join(",");
    getDb().execute(
      `UPDATE messages SET read_receipt_sent = 1
       WHERE id IN (${placeholders}) AND direction = 'incoming' AND read_receipt_sent = 0`,
      messageIds
    );

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "read", message_ids: messageIds }));
    }
    // if the socket's down, the read state is still recorded locally as
    // "sent" (read_receipt_sent=1) - there's currently no separate retry
    // queue for read receipts specifically. Good enough for a 2-user app;
    // a stricter version would track this the same way outbox rows are
    // tracked, and retry on reconnect.
  }

  private connect(): void {
    if (this.stopped) return;

    this.ws = new WebSocket(wsUrl(this.accessToken));

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.flush();
      this.catchUpViaSync();
      this.catchUpSentStatus();
    };

    this.ws.onmessage = (event: WebSocketMessageEvent) => {
      if (!event.data) return;
      const data = JSON.parse(event.data as string);

      switch (data.type) {
        case "message": {
          // incoming message pushed live from a peer
          getDb().execute(
            `INSERT OR IGNORE INTO messages (id, client_id, direction, peer_username, ciphertext, created_at)
             VALUES (?, ?, 'incoming', ?, ?, ?)`,
            [data.id, data.client_id, data.sender_username, data.ciphertext, data.created_at]
          );
          this.handlers.onIncoming(data as SyncedMessage);
          return;
        }

        case "ack": {
          // ack for something we sent
          getDb().execute(`UPDATE outbox SET status = 'sent' WHERE client_id = ?`, [data.client_id]);
          getDb().execute(`UPDATE messages SET id = ? WHERE client_id = ?`, [data.id, data.client_id]);
          if (data.delivered) {
            getDb().execute(
              `UPDATE messages SET delivered_at = ? WHERE client_id = ? AND delivered_at IS NULL`,
              [new Date().toISOString(), data.client_id]
            );
            this.handlers.onStatusChange?.();
          }
          return;
        }

        case "read_receipt": {
          const ids: string[] = data.message_ids ?? [];
          if (ids.length === 0) return;
          const placeholders = ids.map(() => "?").join(",");
          getDb().execute(
            `UPDATE messages SET read_at = ?, delivered_at = COALESCE(delivered_at, ?)
             WHERE id IN (${placeholders})`,
            [data.read_at, data.read_at, ...ids]
          );
          this.handlers.onStatusChange?.();
          return;
        }

        case "presence": {
          this.handlers.onPresence?.(data.username, data.is_online, data.last_seen_at);
          return;
        }

        default:
          return; // unknown envelope type - ignore rather than crash
      }
    };

    this.ws.onerror = () => {
      // onclose fires right after this and handles reconnect - nothing to do here
    };

    this.ws.onclose = () => {
      this.ws = null;
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, MAX_BACKOFF_MS);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /** Sends every still-pending outbox row, in order, oldest first. */
  private flush(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const result = getDb().execute(
      `SELECT client_id, recipient_username, ciphertext FROM outbox
       WHERE status = 'pending' ORDER BY created_at ASC`
    );
    const pending = result.rows?._array ?? [];

    for (const row of pending) {
      this.ws.send(JSON.stringify({
        type: "message",
        client_id: row.client_id,
        recipient_username: row.recipient_username,
        ciphertext: row.ciphertext,
      }));
      getDb().execute(`UPDATE outbox SET attempts = attempts + 1 WHERE client_id = ?`, [row.client_id]);
    }
  }

  /** REST fallback so a missed live push (incoming messages) still arrives once we're back. */
  private async catchUpViaSync(): Promise<void> {
    const since = getLastSyncCursor() ?? undefined;
    const items = await syncMessages(this.accessToken, since);

    for (const item of items) {
      getDb().execute(
        `INSERT OR IGNORE INTO messages (id, client_id, direction, peer_username, ciphertext, created_at)
         VALUES (?, ?, 'incoming', ?, ?, ?)`,
        [item.id, item.client_id, item.sender_username, item.ciphertext, item.created_at]
      );
      this.handlers.onIncoming(item);
    }

    if (items.length > 0) {
      setLastSyncCursor(items[items.length - 1].created_at);
    }
  }

  /**
   * REST fallback so missed delivered_at/read_at changes on OUR sent
   * messages catch up too.
   *
   * Cursor correctness note: the backend endpoint filters on the
   * message's created_at, not on when its status last changed - a
   * message sent long ago can still get read_at set arbitrarily late
   * (recipient was offline for days). If this simply advanced the
   * cursor to "now" after every successful fetch, an old still-unread
   * message would age out of every future catch-up once its created_at
   * fell behind the cursor - its eventual read receipt would never be
   * picked up. Instead, the cursor only advances to the created_at of
   * the OLDEST message that's still missing a read_at locally, so
   * nothing outstanding ever ages out.
   */
  private async catchUpSentStatus(): Promise<void> {
    const since = getLastSentStatusCursor() ?? undefined;
    const items = await syncSentStatus(this.accessToken, since);

    let anyChanged = false;
    for (const item of items) {
      if (item.delivered_at || item.read_at) {
        getDb().execute(
          `UPDATE messages SET delivered_at = COALESCE(?, delivered_at), read_at = COALESCE(?, read_at)
           WHERE id = ?`,
          [item.delivered_at, item.read_at, item.id]
        );
        anyChanged = true;
      }
    }
    if (anyChanged) this.handlers.onStatusChange?.();

    const oldestUnread = getDb().execute(
      `SELECT MIN(created_at) as min_created_at FROM messages
       WHERE direction = 'outgoing' AND read_at IS NULL`
    );
    const row = oldestUnread.rows?._array[0];

    if (row?.min_created_at) {
      // Back off by 1ms: the backend filters `created_at > since`
      // (strictly greater), so using the oldest unread message's exact
      // timestamp as the cursor would exclude that very message from
      // every future fetch - it would never catch up. Subtracting 1ms
      // keeps it just inside the boundary.
      const cursorDate = new Date(new Date(row.min_created_at as string).getTime() - 1);
      setLastSentStatusCursor(cursorDate.toISOString());
    } else {
      // nothing outstanding - safe to advance all the way to now
      setLastSentStatusCursor(new Date().toISOString());
    }
  }
}
