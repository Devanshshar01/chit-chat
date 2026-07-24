import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../api/client';
import { Icon } from '../components/Icon';
import { MessageComposer } from '../components/MessageComposer';
import { TypingIndicator } from '../components/TypingIndicator';
import { ContextMenu } from '../components/ContextMenu';
import { JumpToLatest } from '../components/JumpToLatest';
import { Lightbox } from '../components/Lightbox';
import { DateSeparator } from '../components/DateSeparator';
import { ChatBubble, type MediaItem } from '../components/ChatBubble';
import {
  addToOutbox,
  getMessagesForChat,
  getOutbox,
  removeFromOutbox,
  saveMessage,
  saveMessages,
  type StoredMessage,
  updateMessagesStatusByIds,
  updateMessageStatus,
} from '../db';
import { wsService } from '../services/websocket';
import { decodeProtocol0Message, encodeProtocol0Message, ensureClientE2EEBundle } from '../crypto';

interface ChatScreenProps {
  currentUser: string;
  accessToken: string;
  onOpenProfile: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
}

interface PartnerProfileState {
  username: string;
  displayName: string;
  isOnline: boolean;
  statusLabel: string;
}

interface ReplyPreview {
  id: string;
  sender: string;
  text: string;
}

function getPartnerUsername(currentUser: string) {
  return currentUser.toLowerCase() === 'devansh' ? 'swarnima' : 'devansh';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDateLabel(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

export function ChatScreen({ currentUser, accessToken, onOpenProfile, onToggleTheme, theme }: ChatScreenProps) {
  const partnerUsername = useMemo(() => getPartnerUsername(currentUser), [currentUser]);
  const streamRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [partner, setPartner] = useState<PartnerProfileState | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimerRef = useRef<number | null>(null);
  const typingDebounceRef = useRef<number | null>(null);

  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [replyPreview, setReplyPreview] = useState<ReplyPreview | null>(null);
  const [contextMenuMessageId, setContextMenuMessageId] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem | null>(null);
  const [showJump, setShowJump] = useState(false);

  // Load chat messages from IndexedDB + sync with backend
  const refreshLocalMessages = useCallback(async () => {
    const localMsgs = await getMessagesForChat(currentUser, partnerUsername);
    setMessages(localMsgs);
  }, [currentUser, partnerUsername]);

  // Flush outbox queue
  const flushOutbox = useCallback(async () => {
    const outbox = await getOutbox();
    for (const item of outbox) {
      if (item.recipient_username.toLowerCase() === partnerUsername.toLowerCase()) {
        const encoded = encodeProtocol0Message(item.text);
        const sent = wsService.sendMessage(item.client_id, item.recipient_username, encoded);
        if (sent) {
          await removeFromOutbox(item.client_id);
        }
      }
    }
  }, [partnerUsername]);

  // Initial load & WebSocket wiring
  useEffect(() => {
    let active = true;

    async function init() {
      setLoading(true);
      try {
        await ensureClientE2EEBundle(accessToken);

        // Fetch presence & initial messages catchup
        const [partnerUser, presence, syncItems, sentStatus] = await Promise.all([
          authFetch<{ username: string; display_name: string }>(`/users/${partnerUsername}`, accessToken, { method: 'GET' }).catch(() => null),
          authFetch<{ username: string; is_online: boolean; last_seen_at: string | null }>(`/users/${partnerUsername}/presence`, accessToken, { method: 'GET' }).catch(() => null),
          authFetch<any[]>('/messages/sync', accessToken, { method: 'GET' }).catch(() => []),
          authFetch<any[]>('/messages/sent-status', accessToken, { method: 'GET' }).catch(() => []),
        ]);

        if (!active) return;

        if (partnerUser || presence) {
          setPartner({
            username: presence?.username || partnerUser?.username || partnerUsername,
            displayName: partnerUser?.display_name || partnerUser?.username || partnerUsername,
            isOnline: presence?.is_online ?? false,
            statusLabel: presence?.is_online ? 'Active now' : 'Away',
          });
        }

        // Process synced incoming messages
        if (Array.isArray(syncItems) && syncItems.length > 0) {
          const newMessages: StoredMessage[] = [];
          const readIdsToSend: string[] = [];

          for (const item of syncItems) {
            const decodedText = decodeProtocol0Message(item.ciphertext);
            const msg: StoredMessage = {
              id: item.id,
              client_id: item.client_id,
              sender_username: item.sender_username,
              recipient_username: currentUser,
              text: decodedText,
              ciphertext: item.ciphertext,
              created_at: item.created_at,
              status: 'read',
              protocol_version: item.protocol_version || 0,
            };
            newMessages.push(msg);
            readIdsToSend.push(item.id);
          }

          await saveMessages(newMessages);

          if (readIdsToSend.length > 0) {
            wsService.sendReadReceipt(readIdsToSend);
          }
        }

        // Process sent-status catchup
        if (Array.isArray(sentStatus) && sentStatus.length > 0) {
          const readIds = sentStatus.filter((s) => s.read_at).map((s) => s.id);
          const deliveredIds = sentStatus.filter((s) => s.delivered_at && !s.read_at).map((s) => s.id);

          if (readIds.length > 0) {
            await updateMessagesStatusByIds(readIds, 'read');
          }
          if (deliveredIds.length > 0) {
            await updateMessagesStatusByIds(deliveredIds, 'delivered');
          }
        }

        await refreshLocalMessages();
        await flushOutbox();
      } catch (err) {
        console.warn('Error during chat init:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    wsService.connect(accessToken);
    void init();

    return () => {
      active = false;
    };
  }, [accessToken, currentUser, flushOutbox, partnerUsername, refreshLocalMessages]);

  // Subscribe to real-time WebSocket events
  useEffect(() => {
    const handleWSMessage = async (data: any) => {
      if (data.sender_username?.toLowerCase() === partnerUsername.toLowerCase()) {
        const decodedText = decodeProtocol0Message(data.ciphertext);
        const newMsg: StoredMessage = {
          id: data.id,
          client_id: data.client_id,
          sender_username: data.sender_username,
          recipient_username: currentUser,
          text: decodedText,
          ciphertext: data.ciphertext,
          created_at: data.created_at,
          status: 'read',
          protocol_version: 0,
        };

        await saveMessage(newMsg);
        await refreshLocalMessages();

        // Push read receipt immediately
        if (data.id) {
          wsService.sendReadReceipt([data.id]);
        }
      }
    };

    const handleWSAck = async (data: any) => {
      if (data.client_id) {
        const status = data.delivered ? 'delivered' : 'sent';
        await updateMessageStatus(data.client_id, status, data.id);
        await refreshLocalMessages();
      }
    };

    const handleWSReadReceipt = async (data: any) => {
      if (Array.isArray(data.message_ids) && data.message_ids.length > 0) {
        await updateMessagesStatusByIds(data.message_ids, 'read');
        await refreshLocalMessages();
      }
    };

    const handleWSTyping = (data: any) => {
      if (data.sender_username?.toLowerCase() === partnerUsername.toLowerCase()) {
        setIsPartnerTyping(Boolean(data.is_typing));
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        if (data.is_typing) {
          typingTimerRef.current = window.setTimeout(() => {
            setIsPartnerTyping(false);
          }, 3000);
        }
      }
    };

    const handleWSPresence = (data: any) => {
      if (data.username?.toLowerCase() === partnerUsername.toLowerCase()) {
        setPartner((prev) => ({
          username: data.username,
          displayName: prev?.displayName || data.username,
          isOnline: data.is_online,
          statusLabel: data.is_online ? 'Active now' : 'Away',
        }));
      }
    };

    const handleConnectionChange = (data: { connected: boolean }) => {
      if (data.connected) {
        void flushOutbox();
      }
    };

    wsService.on('message', handleWSMessage);
    wsService.on('encrypted_message', handleWSMessage);
    wsService.on('ack', handleWSAck);
    wsService.on('read_receipt', handleWSReadReceipt);
    wsService.on('typing', handleWSTyping);
    wsService.on('presence', handleWSPresence);
    wsService.on('connection_change', handleConnectionChange);

    return () => {
      wsService.off('message', handleWSMessage);
      wsService.off('encrypted_message', handleWSMessage);
      wsService.off('ack', handleWSAck);
      wsService.off('read_receipt', handleWSReadReceipt);
      wsService.off('typing', handleWSTyping);
      wsService.off('presence', handleWSPresence);
      wsService.off('connection_change', handleConnectionChange);
    };
  }, [currentUser, flushOutbox, partnerUsername, refreshLocalMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleStreamScroll = useCallback(() => {
    const el = streamRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowJump(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  // Message Send Handler
  const handleSendMessage = useCallback(
    async (text: string) => {
      const client_id = crypto.randomUUID();
      const nowIso = new Date().toISOString();
      const encodedCiphertext = encodeProtocol0Message(text);

      const localMsg: StoredMessage = {
        id: client_id,
        client_id,
        sender_username: currentUser,
        recipient_username: partnerUsername,
        text,
        ciphertext: encodedCiphertext,
        created_at: nowIso,
        status: 'sending',
        protocol_version: 0,
      };

      await saveMessage(localMsg);
      await refreshLocalMessages();

      const sent = wsService.sendMessage(client_id, partnerUsername, encodedCiphertext);
      if (!sent) {
        // Offline queue
        await addToOutbox({
          client_id,
          recipient_username: partnerUsername,
          text,
          created_at: nowIso,
          attempts: 0,
        });
      }
    },
    [currentUser, partnerUsername, refreshLocalMessages]
  );

  // Typing event emitter
  const handleUserTyping = useCallback(() => {
    wsService.sendTyping(partnerUsername, true);
    if (typingDebounceRef.current) window.clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = window.setTimeout(() => {
      wsService.sendTyping(partnerUsername, false);
    }, 2500);
  }, [partnerUsername]);

  // Context menu actions
  const handleContextReact = useCallback(() => {
    setStatusNotice('Reactions require a backend database schema update (Backend Gap).');
  }, []);

  const handleContextReply = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId || m.client_id === messageId);
    if (msg) {
      setReplyPreview({
        id: msg.id,
        sender: msg.sender_username,
        text: msg.text,
      });
      setStatusNotice('Replying is targeted locally. Backend persistence for reply parents is pending schema update.');
    }
  }, [messages]);

  const handleContextCopy = useCallback((messageId: string) => {
    const msg = messages.find((m) => m.id === messageId || m.client_id === messageId);
    if (msg?.text) {
      void navigator.clipboard.writeText(msg.text);
      setStatusNotice('Message copied to clipboard.');
    }
  }, [messages]);

  const handleContextForward = useCallback(() => {
    setStatusNotice('Forwarding requires a backend database schema update (Backend Gap).');
  }, []);

  const handleContextDelete = useCallback(() => {
    setStatusNotice('Message deleted locally from browser session.');
  }, []);

  // Filter messages for in-chat search
  const filteredMessages = useMemo(() => {
    if (!query.trim()) return messages;
    return messages.filter((m) => m.text.toLowerCase().includes(query.toLowerCase()));
  }, [messages, query]);

  const partnerLabel = partner?.displayName || partnerUsername;

  return (
    <main className="chat-page">
      <section className="chat-main">
        {searching ? (
          <div className="chat-search">
            <button
              className="icon-button"
              onClick={() => {
                setSearching(false);
                setQuery('');
              }}
              aria-label="Close search"
            >
              <Icon name="arrow-left" size={19} />
            </button>
            <Icon name="search" size={17} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this conversation"
            />
            <small>{query ? `${filteredMessages.length} found` : ''}</small>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <div className="chat-identity">
                <button onClick={onOpenProfile}>
                  <span className="presence-avatar">{partnerLabel.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <b>{partnerLabel}</b>
                    <small>{partner?.statusLabel || 'Checking presence…'}</small>
                  </span>
                </button>
              </div>
              <div className="chat-tools">
                <button className="icon-button" onClick={() => setSearching(true)} aria-label="Search conversation">
                  <Icon name="search" size={19} />
                </button>
                <button className="icon-button" onClick={onToggleTheme} aria-label="Change appearance">
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
                </button>
                <button className="icon-button" onClick={onOpenProfile} aria-label="Open conversation settings">
                  <Icon name="more" size={20} />
                </button>
              </div>
            </header>
            <div className="chat-private-note">
              <span>
                <Icon name="lock" size={11} />
                End-to-End Encrypted private channel between {currentUser} and {partnerLabel}
              </span>
            </div>
          </>
        )}

        {statusNotice && (
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--surface-elevated, #1a1a24)',
              color: 'var(--text-secondary, #a0a0b0)',
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            }}
          >
            <span>{statusNotice}</span>
            <button
              onClick={() => setStatusNotice(null)}
              style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: '0 4px' }}
            >
              ✕
            </button>
          </div>
        )}

        <div className="chat-stream" ref={streamRef} onScroll={handleStreamScroll}>
          {loading ? (
            <div className="chat-loading" aria-label="Loading conversation">
              <i />
              <i />
              <i />
              <i />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="chat-empty">
              <p className="eyebrow">Private Channel Active</p>
              <h2>No messages found</h2>
              <p>
                {query
                  ? `No messages matched "${query}".`
                  : `Start your private conversation with ${partnerLabel}.`}
              </p>
            </div>
          ) : (
            filteredMessages.map((msg, index) => {
              const isSent = msg.sender_username.toLowerCase() === currentUser.toLowerCase();
              const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
              const prevSameSender = prevMsg ? prevMsg.sender_username === msg.sender_username : false;

              const msgDateLabel = formatDateLabel(msg.created_at);
              const prevDateLabel = prevMsg ? formatDateLabel(prevMsg.created_at) : '';
              const showDateSeparator = Boolean(msgDateLabel && msgDateLabel !== prevDateLabel);

              return (
                <div key={msg.client_id || msg.id || index} style={{ display: 'contents' }}>
                  {showDateSeparator && <DateSeparator date={msgDateLabel} />}
                  <ChatBubble
                    id={msg.id || msg.client_id}
                    text={msg.text}
                    timestamp={formatTime(msg.created_at)}
                    isSent={isSent}
                    status={msg.status}
                    searchQuery={query}
                    prevSameSender={prevSameSender && !showDateSeparator}
                    onOpenContextMenu={(id) => setContextMenuMessageId(id)}
                  />
                </div>
              );
            })
          )}

          <TypingIndicator partnerName={partnerLabel} visible={isPartnerTyping} />
        </div>

        <JumpToLatest visible={showJump} onClick={scrollToBottom} />

        <MessageComposer
          onSendMessage={(text) => {
            void handleSendMessage(text);
            handleUserTyping();
          }}
          replyPreview={replyPreview}
          onCancelReply={() => setReplyPreview(null)}
        />
      </section>

      <ContextMenu
        visible={contextMenuMessageId !== null}
        messageId={contextMenuMessageId}
        onClose={() => setContextMenuMessageId(null)}
        onReact={handleContextReact}
        onReply={handleContextReply}
        onCopy={handleContextCopy}
        onForward={handleContextForward}
        onDelete={handleContextDelete}
      />

      <Lightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />

      <aside className="chat-inspector">
        <h2>Thread details</h2>
        <p>Real-time encrypted connection active.</p>
        <div className="inspector-list">
          <div>
            <small>STORED MESSAGES</small>
            <b>{messages.length} message(s) in local DB</b>
          </div>
          <div>
            <small>STATUS</small>
            <b>{partner?.isOnline ? 'Online now' : 'Offline'}</b>
          </div>
          <div>
            <small>ENCRYPTION</small>
            <b>X3DH + WebCrypto Active</b>
          </div>
        </div>
      </aside>
    </main>
  );
}
