export interface StoredMessage {
  id: string;
  client_id: string;
  sender_username: string;
  recipient_username: string;
  text: string;
  ciphertext?: string;
  created_at: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  protocol_version: number;
  sender_device_id?: string;
  recipient_device_id?: string;
}

export interface OutboxItem {
  client_id: string;
  recipient_username: string;
  text: string;
  created_at: string;
  attempts: number;
}

const DB_NAME = 'chit_chat_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'client_id' });
        msgStore.createIndex('by_sender', 'sender_username', { unique: false });
        msgStore.createIndex('by_recipient', 'recipient_username', { unique: false });
        msgStore.createIndex('by_created_at', 'created_at', { unique: false });
        msgStore.createIndex('by_id', 'id', { unique: false });
      }

      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'client_id' });
      }

      if (!db.objectStoreNames.contains('crypto_keys')) {
        db.createObjectStore('crypto_keys', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Messages Helper Functions
export async function saveMessage(msg: StoredMessage): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    store.put(msg);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveMessages(msgs: StoredMessage[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    for (const msg of msgs) {
      store.put(msg);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMessagesForChat(myUsername: string, otherUsername: string): Promise<StoredMessage[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const request = store.getAll();

    request.onsuccess = () => {
      const all: StoredMessage[] = request.result || [];
      const filtered = all.filter(
        (m) =>
          (m.sender_username === myUsername && m.recipient_username === otherUsername) ||
          (m.sender_username === otherUsername && m.recipient_username === myUsername)
      );
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      resolve(filtered);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function updateMessageStatus(client_id: string, status: StoredMessage['status'], serverId?: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const request = store.get(client_id);

    request.onsuccess = () => {
      const msg: StoredMessage = request.result;
      if (msg) {
        msg.status = status;
        if (serverId) msg.id = serverId;
        store.put(msg);
      }
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

export async function updateMessagesStatusByIds(serverIds: string[], status: StoredMessage['status']): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const request = store.getAll();

    request.onsuccess = () => {
      const all: StoredMessage[] = request.result || [];
      for (const m of all) {
        if (serverIds.includes(m.id)) {
          m.status = status;
          store.put(m);
        }
      }
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

// Outbox Helper Functions
export async function addToOutbox(item: OutboxItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOutbox(): Promise<OutboxItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromOutbox(client_id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    store.delete(client_id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Crypto Store Helpers
export async function setCryptoKey(id: string, value: any): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('crypto_keys', 'readwrite');
    const store = tx.objectStore('crypto_keys');
    store.put({ id, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCryptoKey<T = any>(id: string): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('crypto_keys', 'readonly');
    const store = tx.objectStore('crypto_keys');
    const request = store.get(id);
    request.onsuccess = () => {
      const res = request.result;
      resolve(res ? res.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}
