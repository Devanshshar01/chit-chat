import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar } from '../components/Avatar';
import { ChatBubble, type ReactionItem, type MediaItem } from '../components/ChatBubble';
import { MessageComposer } from '../components/MessageComposer';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isSent: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: ReactionItem[];
  replyTo?: { id?: string; sender: string; text: string };
  isVoiceNote?: boolean;
  voiceDuration?: string;
  media?: MediaItem[];
  isNew?: boolean;
}

interface ChatScreenProps {
  currentUser: string;
  onOpenProfile: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
}

type ChatState = 'loading' | 'empty' | 'ready';

export const ChatScreen: React.FC<ChatScreenProps> = ({
  currentUser,
  onOpenProfile,
  onToggleTheme,
  theme,
}) => {
  const partnerName = currentUser.toLowerCase() === 'devansh' ? 'Swarnima' : 'Devansh';

  const [chatState, setChatState] = useState<ChatState>('loading');
  const [messages, setMessages] = useState<Message[]>([]);

  // UI state
  const [isTyping, setIsTyping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Sheet states
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);

  // New message indicator & scroll
  const [hasScrolledUp, setHasScrolledUp] = useState(false);
  const [unreadIncoming, setUnreadIncoming] = useState(0);
  const messageStreamRef = useRef<HTMLDivElement>(null);

  // Lightbox state
  const [lightboxMedia, setLightboxMedia] = useState<MediaItem | null>(null);

  // Simulate loading → ready with demo data
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages([
        {
          id: '1',
          text: 'Hey! Glad our private sanctuary is ready ✨',
          timestamp: '10:42 AM',
          isSent: false,
          status: 'read',
          reactions: [{ emoji: '❤️', count: 1 }],
        },
        {
          id: '2',
          text: 'Me too. It feels so quiet and personal compared to everything else.',
          timestamp: '10:43 AM',
          isSent: true,
          status: 'read',
        },
        {
          id: '3',
          text: 'Recorded a quick note for you earlier!',
          timestamp: '10:44 AM',
          isSent: false,
          status: 'read',
          isVoiceNote: true,
          voiceDuration: '0:42',
        },
        {
          id: '4',
          text: 'Absolutely. No noise, just us two in this channel.',
          timestamp: '10:45 AM',
          isSent: true,
          status: 'read',
          replyTo: {
            id: '1',
            sender: partnerName,
            text: 'Hey! Glad our private sanctuary is ready ✨',
          },
          reactions: [{ emoji: '✨', count: 1 }],
        },
        {
          id: '5',
          text: '',
          timestamp: '10:46 AM',
          isSent: false,
          status: 'read',
          media: [
            { type: 'image', url: '', thumbnail: '' },
          ],
        },
        {
          id: '6',
          text: 'Look at this view from the cafe today!',
          timestamp: '10:46 AM',
          isSent: false,
          status: 'read',
        },
        {
          id: '7',
          text: 'Beautiful! We should go back there this weekend.',
          timestamp: '10:48 AM',
          isSent: true,
          status: 'read',
        },
        {
          id: '8',
          text: 'Planning something special for us ❤️',
          timestamp: '10:50 AM',
          isSent: true,
          status: 'delivered',
        },
      ]);
      setChatState('ready');
    }, 1500);
    return () => clearTimeout(timer);
  }, [partnerName]);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (chatState === 'ready' && messageStreamRef.current) {
      requestAnimationFrame(() => {
        if (messageStreamRef.current) {
          messageStreamRef.current.scrollTop = messageStreamRef.current.scrollHeight;
        }
      });
    }
  }, [chatState]);

  const handleSendMessage = useCallback(
    (text: string) => {
      const newMessage: Message = {
        id: Date.now().toString(),
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSent: true,
        status: 'sending',
        isNew: true,
        replyTo: replyingMessage
          ? {
              id: replyingMessage.id,
              sender: replyingMessage.isSent ? 'You' : partnerName,
              text: replyingMessage.text,
            }
          : undefined,
      };

      setMessages((prev) => [...prev, newMessage]);
      setReplyingMessage(null);

      // Auto-scroll to bottom on send
      requestAnimationFrame(() => {
        if (messageStreamRef.current) {
          messageStreamRef.current.scrollTop = messageStreamRef.current.scrollHeight;
        }
      });

      // Simulate delivery confirmation
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === newMessage.id ? { ...m, status: 'delivered' as const, isNew: false } : m))
        );
      }, 600);

      // Simulate partner typing & response
      setTimeout(() => setIsTyping(true), 1200);
      setTimeout(() => {
        setIsTyping(false);
        const responses = [
          'Received your message in our encrypted sanctuary ❤️',
          'I love this. Just us, no noise.',
          'Can\'t wait for the weekend together!',
          'You always know the right things to say.',
          'This app feels like our little secret world.',
        ];
        const incoming: Message = {
          id: (Date.now() + 1).toString(),
          text: responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSent: false,
          status: 'read',
          isNew: true,
        };
        setMessages((prev) => [...prev, incoming]);

        // Mark sent messages as read
        setMessages((prev) =>
          prev.map((m) => (m.isSent && m.status === 'delivered' ? { ...m, status: 'read' as const } : m))
        );

        if (hasScrolledUp) {
          setUnreadIncoming((prev) => prev + 1);
        } else {
          // Auto-scroll for new message
          requestAnimationFrame(() => {
            if (messageStreamRef.current) {
              messageStreamRef.current.scrollTop = messageStreamRef.current.scrollHeight;
            }
          });
        }

        // Clear isNew flag after animation completes
        setTimeout(() => {
          setMessages((prev) => prev.map((m) => (m.id === incoming.id ? { ...m, isNew: false } : m)));
        }, 400);
      }, 3000);
    },
    [replyingMessage, partnerName, hasScrolledUp]
  );

  const handleReactionAdd = (id: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const currentReactions = m.reactions || [];
        const existing = currentReactions.find((r) => r.emoji === emoji);
        let updatedReactions: ReactionItem[];
        if (existing) {
          updatedReactions = currentReactions.map((r) =>
            r.emoji === emoji ? { ...r, count: Math.min(r.count + 1, 2) } : r
          );
        } else {
          updatedReactions = [...currentReactions, { emoji, count: 1 }];
        }
        return { ...m, reactions: updatedReactions };
      })
    );
  };

  const handleScrollToOriginal = (targetId: string) => {
    const element = document.getElementById(`bubble-${targetId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(targetId);
      setTimeout(() => setHighlightedId(null), 1500);
    }
  };

  const handleSwipeReply = (id: string) => {
    const msg = messages.find((m) => m.id === id);
    if (msg) {
      setReplyingMessage(msg);
    }
  };

  const handleRetry = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'sending' as const } : m))
    );
    // Simulate re-delivery
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'delivered' as const } : m))
      );
    }, 800);
  };

  const scrollToBottom = () => {
    if (messageStreamRef.current) {
      messageStreamRef.current.scrollTop = messageStreamRef.current.scrollHeight;
    }
    setHasScrolledUp(false);
    setUnreadIncoming(0);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const isUp = distanceFromBottom > 150;
    setHasScrolledUp(isUp);
    if (!isUp) setUnreadIncoming(0);
  };

  // Search functionality
  const searchResults = searchQuery
    ? messages.filter((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const navigateSearch = (direction: 'up' | 'down') => {
    if (searchResults.length === 0) return;
    let newIndex = searchResultIndex;
    if (direction === 'up') {
      newIndex = (searchResultIndex + 1) % searchResults.length;
    } else {
      newIndex = (searchResultIndex - 1 + searchResults.length) % searchResults.length;
    }
    setSearchResultIndex(newIndex);
    const targetMsg = searchResults[newIndex];
    if (targetMsg) {
      handleScrollToOriginal(targetMsg.id);
    }
  };

  const activeMessage = messages.find((m) => m.id === activeMenuId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ====== Top Header / Search Overlay ====== */}
      {isSearching ? (
        <div
          style={{
            height: '64px',
            padding: '0 16px',
            backgroundColor: 'var(--surface-card)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 30,
          }}
        >
          <button
            onClick={() => {
              setIsSearching(false);
              setSearchQuery('');
              setSearchResultIndex(0);
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              padding: '4px',
            }}
          >
            ←
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchResultIndex(0);
            }}
            placeholder="Search in conversation..."
            autoFocus
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '0.95rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                {searchResults.length > 0
                  ? `${searchResultIndex + 1} of ${searchResults.length}`
                  : '0 of 0'}
              </span>
              <button
                onClick={() => navigateSearch('down')}
                disabled={searchResults.length === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '4px',
                  opacity: searchResults.length === 0 ? 0.3 : 1,
                }}
              >
                ▲
              </button>
              <button
                onClick={() => navigateSearch('up')}
                disabled={searchResults.length === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: '4px',
                  opacity: searchResults.length === 0 ? 0.3 : 1,
                }}
              >
                ▼
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            height: '64px',
            padding: '0 16px',
            backgroundColor: 'var(--surface-overlay)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 20,
          }}
        >
          <div
            onClick={onOpenProfile}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
            <Avatar size="sm" name={partnerName} showPresence={true} isOnline={true} />
            <div>
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {partnerName}
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--accent-primary)',
                  fontWeight: 500,
                }}
              >
                {isTyping
                  ? `${partnerName} is typing...`
                  : 'Together in app • E2EE'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setIsSearching(true)}
              title="Search messages"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              🔍
            </button>
            <button
              onClick={onToggleTheme}
              title="Toggle theme"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={onOpenProfile}
              title="View partner profile"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              ⚙️
            </button>
          </div>
        </div>
      )}

      {/* Security Chip */}
      <div
        style={{
          padding: '6px 12px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--text-secondary)',
        }}
      >
        🔒 End-to-end encrypted sanctuary • Visible only to you and {partnerName}
      </div>

      {/* ====== Message Stream Area ====== */}
      <div
        ref={messageStreamRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Loading Skeleton State */}
        {chatState === 'loading' && (
          <>
            {[
              { w: '65%', align: 'flex-start', h: 52 },
              { w: '55%', align: 'flex-end', h: 40 },
              { w: '70%', align: 'flex-start', h: 64 },
              { w: '45%', align: 'flex-end', h: 36 },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: s.align === 'flex-end' ? 'flex-end' : 'flex-start',
                  marginBottom: '12px',
                }}
              >
                <div
                  className="skeleton-bubble"
                  style={{
                    width: s.w,
                    height: `${s.h}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              </div>
            ))}
          </>
        )}

        {/* Empty State */}
        {chatState === 'ready' && messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              padding: '40px 30px',
              textAlign: 'center',
            }}
          >
            {/* Geometric emblem */}
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                border: '2px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                color: 'var(--accent-primary)',
                opacity: 0.7,
              }}
            >
              🔐
            </div>
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '15px',
                lineHeight: '1.6',
                color: 'var(--text-secondary)',
                maxWidth: '280px',
                fontStyle: 'italic',
              }}
            >
              This is the beginning of your private sanctuary. Every message sent here
              is end-to-end encrypted and visible only to you and {partnerName}.
            </p>
          </div>
        )}

        {/* Happy Path: Message Stream */}
        {chatState === 'ready' && messages.length > 0 && (
          <>
            {/* Date Separator */}
            <div style={{ textAlign: 'center', margin: '8px 0 12px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-tertiary)',
                }}
              >
                Today
              </span>
            </div>

            {messages.map((m, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const prevSameSender = prevMsg ? prevMsg.isSent === m.isSent : false;

              return (
                <ChatBubble
                  key={m.id}
                  id={m.id}
                  text={m.text}
                  timestamp={m.timestamp}
                  isSent={m.isSent}
                  status={m.status}
                  reactions={m.reactions}
                  replyTo={m.replyTo}
                  isVoiceNote={m.isVoiceNote}
                  voiceDuration={m.voiceDuration}
                  media={m.media}
                  highlighted={highlightedId === m.id}
                  isNew={m.isNew}
                  searchQuery={searchQuery}
                  prevSameSender={prevSameSender}
                  onReactionAdd={handleReactionAdd}
                  onOpenContextMenu={(id) => setActiveMenuId(id)}
                  onScrollToOriginal={handleScrollToOriginal}
                  onSwipeReply={handleSwipeReply}
                  onRetry={handleRetry}
                  onMediaClick={setLightboxMedia}
                />
              );
            })}
          </>
        )}
      </div>

      {/* ====== Typing Indicator Pill (above composer) ====== */}
      {isTyping && (
        <div
          className="animate-typing-pulse"
          style={{
            textAlign: 'center',
            padding: '6px 0',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              fontSize: '12px',
              fontWeight: 500,
              padding: '4px 14px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {partnerName} is typing...
          </span>
        </div>
      )}

      {/* ====== Floating New Message Pill / Jump-to-Bottom ====== */}
      {hasScrolledUp && (
        <div
          style={{
            position: 'absolute',
            bottom: '90px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
          }}
        >
          {unreadIncoming > 0 ? (
            <button
              onClick={scrollToBottom}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                boxShadow: 'var(--shadow-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ↓ {unreadIncoming} New Message from {partnerName}
            </button>
          ) : (
            <button
              onClick={scrollToBottom}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--surface-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '16px',
                boxShadow: 'var(--shadow-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ↓
            </button>
          )}
        </div>
      )}

      {/* ====== Composer ====== */}
      <MessageComposer
        onSendMessage={handleSendMessage}
        replyPreview={
          replyingMessage
            ? {
                id: replyingMessage.id,
                sender: replyingMessage.isSent ? 'You' : partnerName,
                text: replyingMessage.text || '[Media]',
              }
            : null
        }
        onCancelReply={() => setReplyingMessage(null)}
      />

      {/* ====== Unified Long-Press Context Menu Bottom Sheet ====== */}
      {activeMenuId && activeMessage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
          onClick={() => setActiveMenuId(null)}
        >
          <div
            className="animate-context-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--surface-card)',
              borderTopLeftRadius: 'var(--radius-lg)',
              borderTopRightRadius: 'var(--radius-lg)',
              padding: '24px 20px',
              paddingBottom: '32px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Drag Handle */}
            <div
              style={{
                width: '36px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: 'var(--border-strong)',
                margin: '0 auto 16px',
              }}
            />

            {/* Quick Reaction Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-around',
                padding: '10px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-pill)',
                marginBottom: '20px',
              }}
            >
              {['❤️', '🤗', '😂', '✨', '🔥'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleReactionAdd(activeMenuId, emoji);
                    setActiveMenuId(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                    padding: '4px',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.3)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                onClick={() => {
                  setReplyingMessage(activeMessage);
                  setActiveMenuId(null);
                }}
                style={sheetButtonStyle}
              >
                <span style={{ width: '28px' }}>💬</span> Reply
              </button>
              <button
                onClick={() => {
                  setForwardingMessage(activeMessage);
                  setActiveMenuId(null);
                }}
                style={sheetButtonStyle}
              >
                <span style={{ width: '28px' }}>↗️</span> Forward to {partnerName}
              </button>
              <button
                onClick={() => {
                  alert('Pinned to Relationship Memories');
                  setActiveMenuId(null);
                }}
                style={sheetButtonStyle}
              >
                <span style={{ width: '28px' }}>✨</span> Pin to Memories
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeMessage.text);
                  setActiveMenuId(null);
                }}
                style={sheetButtonStyle}
              >
                <span style={{ width: '28px' }}>📋</span> Copy Text
              </button>

              {/* Separator */}
              <div
                style={{
                  height: '1px',
                  backgroundColor: 'var(--border-subtle)',
                  margin: '8px 0',
                }}
              />

              <button
                onClick={() => {
                  setMessages((prev) => prev.filter((m) => m.id !== activeMenuId));
                  setActiveMenuId(null);
                }}
                style={{ ...sheetButtonStyle, color: 'var(--semantic-error)' }}
              >
                <span style={{ width: '28px' }}>🗑️</span> Delete for Both
              </button>
              <button
                onClick={() => {
                  setMessages((prev) => prev.filter((m) => m.id !== activeMenuId));
                  setActiveMenuId(null);
                }}
                style={{ ...sheetButtonStyle, color: 'var(--text-tertiary)' }}
              >
                <span style={{ width: '28px' }}>🗑️</span> Delete for Me
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Two-Person Forward Confirmation Sheet ====== */}
      {forwardingMessage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setForwardingMessage(null)}
        >
          <div
            className="animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '360px',
              backgroundColor: 'var(--surface-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              textAlign: 'center',
            }}
          >
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '8px',
              }}
            >
              Forward to {partnerName}?
            </h3>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '20px',
                fontStyle: 'italic',
              }}
            >
              "{forwardingMessage.text || '[Media attachment]'}"
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setForwardingMessage(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSendMessage(`[Forwarded]: ${forwardingMessage.text || '[Media]'}`);
                  setForwardingMessage(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--text-inverse)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                }}
              >
                Send to {partnerName}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Fullscreen Media Lightbox ====== */}
      {lightboxMedia && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#000000',
            zIndex: 120,
            display: 'flex',
            flexDirection: 'column',
            animation: 'lightboxBackdropFade 0.3s ease forwards',
          }}
          onClick={() => setLightboxMedia(null)}
        >
          {/* Top Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
            }}
          >
            <button
              onClick={() => setLightboxMedia(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  alert('Pinned to Memories');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ✨ Pin to Memories
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  alert('Saved');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                💾 Save
              </button>
            </div>
          </div>

          {/* Media View */}
          <div
            className="animate-lightbox-open"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '500px',
                aspectRatio: '4/3',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                color: '#666',
                backgroundImage: lightboxMedia.url ? `url(${lightboxMedia.url})` : undefined,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
            >
              {!lightboxMedia.url && (lightboxMedia.type === 'video' ? '🎬' : '🖼️')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const sheetButtonStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  fontSize: '0.95rem',
  fontWeight: 500,
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontFamily: 'var(--font-sans)',
  transition: 'background-color 0.15s',
};
