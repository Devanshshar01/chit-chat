import { API_BASE_URL } from '../config';

export type WSEventType =
  | 'presence'
  | 'message'
  | 'encrypted_message'
  | 'ack'
  | 'read_receipt'
  | 'typing'
  | 'connection_change';

export interface PresencePayload {
  type: 'presence';
  username: string;
  is_online: boolean;
  last_seen_at: string;
}

export interface MessagePayload {
  type: 'message';
  id: string;
  client_id: string;
  sender_username: string;
  ciphertext: string;
  created_at: string;
}

export interface EncryptedMessagePayload {
  type: 'encrypted_message';
  id: string;
  client_id: string;
  sender_username: string;
  ciphertext: string;
  protocol_version: number;
  created_at: string;
}

export interface AckPayload {
  type: 'ack';
  id: string;
  client_id: string;
  created_at: string;
  delivered: boolean;
}

export interface ReadReceiptPayload {
  type: 'read_receipt';
  message_ids: string[];
  read_at: string;
}

export interface TypingPayload {
  type: 'typing';
  sender_username: string;
  is_typing: boolean;
}

type EventListener = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners: Map<WSEventType, Set<EventListener>> = new Map();
  private pingInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;

  public connect(token: string) {
    if (this.ws && this.token === token && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.disconnect();
    this.token = token;

    let wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    if (!wsUrl.endsWith('/ws')) {
      wsUrl = `${wsUrl}/ws`;
    }
    const fullUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startPing();
        this.emit('connection_change', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;
          if (data.type) {
            this.emit(data.type, data);
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WS error:', err);
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };
    } catch (err) {
      console.error('WS connection error:', err);
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    this.isConnected = false;
    this.stopPing();
    this.emit('connection_change', { connected: false });

    if (this.token) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
      this.reconnectAttempts++;
      if (this.reconnectTimeout) window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = window.setTimeout(() => {
        if (this.token) this.connect(this.token);
      }, delay);
    }
  }

  public disconnect() {
    this.token = null;
    this.stopPing();
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.emit('connection_change', { connected: false });
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public sendMessage(client_id: string, recipient_username: string, ciphertext: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'message',
          client_id,
          recipient_username,
          ciphertext,
        })
      );
      return true;
    }
    return false;
  }

  public sendTyping(recipient_username: string, is_typing: boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'typing',
          recipient_username,
          is_typing,
        })
      );
    }
  }

  public sendReadReceipt(message_ids: string[]) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && message_ids.length > 0) {
      this.ws.send(
        JSON.stringify({
          type: 'read',
          message_ids,
        })
      );
    }
  }

  public on(event: WSEventType, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off(event: WSEventType, listener: EventListener) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
    }
  }

  private emit(event: WSEventType, data: any) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error('Error in WS listener:', err);
        }
      });
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const wsService = new WebSocketService();
