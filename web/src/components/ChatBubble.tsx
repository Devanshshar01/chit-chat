import React, { useState, useRef } from 'react';

export interface ReactionItem {
  emoji: string;
  count: number;
}

export interface MediaItem {
  type: 'image' | 'video' | 'document';
  url: string;
  thumbnail?: string;
  name?: string;
  size?: string;
  duration?: string;
}

export interface ChatBubbleProps {
  id: string;
  text: string;
  timestamp: string;
  isSent: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: { id?: string; sender: string; text: string };
  reactions?: ReactionItem[];
  isVoiceNote?: boolean;
  voiceDuration?: string;
  media?: MediaItem[];
  highlighted?: boolean;
  isNew?: boolean;
  searchQuery?: string;
  prevSameSender?: boolean;
  onReactionAdd?: (id: string, emoji: string) => void;
  onOpenContextMenu?: (id: string) => void;
  onScrollToOriginal?: (replyId: string) => void;
  onSwipeReply?: (id: string) => void;
  onRetry?: (id: string) => void;
  onMediaClick?: (media: MediaItem) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  id,
  text,
  timestamp,
  isSent,
  status = 'read',
  replyTo,
  reactions = [],
  isVoiceNote = false,
  voiceDuration = '0:42',
  media,
  highlighted = false,
  isNew = false,
  searchQuery = '',
  prevSameSender = false,
  onReactionAdd,
  onOpenContextMenu,
  onScrollToOriginal,
  onSwipeReply,
  onRetry,
  onMediaClick,
}) => {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<'1x' | '1.5x' | '2x'>('1x');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [reactionsAnimating, setReactionsAnimating] = useState(false);

  // Swipe-to-reply gesture state
  const swipeRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeActive, setIsSwipeActive] = useState(false);

  const handleDoubleClick = () => {
    if (onReactionAdd) {
      setReactionsAnimating(true);
      onReactionAdd(id, '❤️');
      setTimeout(() => setReactionsAnimating(false), 400);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpenContextMenu) {
      onOpenContextMenu(id);
    }
  };

  // Touch gesture handlers for swipe-to-reply
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    // Only allow right swipe for reply
    if (diff > 10) {
      setIsSwipeActive(true);
      setSwipeOffset(Math.min(diff * 0.5, 80));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 50 && onSwipeReply) {
      onSwipeReply(id);
    }
    setSwipeOffset(0);
    setIsSwipeActive(false);
  };

  // Render text with search highlighting
  const renderHighlightedText = (content: string) => {
    if (!searchQuery || !content) return <span>{content}</span>;
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = content.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="search-highlight" style={{ color: 'inherit' }}>
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  // Read receipt icon
  const renderStatus = () => {
    switch (status) {
      case 'sending':
        return <span style={{ fontSize: '12px' }}>🕒</span>;
      case 'sent':
        return <span style={{ fontSize: '12px' }}>✓</span>;
      case 'delivered':
        return <span style={{ fontSize: '12px' }}>✓✓</span>;
      case 'read':
        return (
          <span style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>✓✓</span>
        );
      case 'failed':
        return (
          <span
            onClick={(e) => { e.stopPropagation(); onRetry?.(id); }}
            style={{ color: 'var(--semantic-error)', fontSize: '12px', cursor: 'pointer' }}
            title="Tap to retry"
          >
            ⚠️
          </span>
        );
      default:
        return null;
    }
  };

  // Spacing rhythm: 4px for consecutive same-sender, 14px for alternating
  const topMargin = prevSameSender ? '2px' : '7px';

  // Animation class for new messages
  const animClass = isNew ? (isSent ? 'animate-message-send' : 'animate-message-receive') : '';

  // Waveform bars data — organic amplitude pattern
  const waveformData = [35, 65, 28, 88, 55, 100, 42, 78, 48, 92, 60, 38, 82, 25, 70, 45, 90, 35, 68, 52];

  return (
    <div
      ref={swipeRef}
      id={`bubble-${id}`}
      className={animClass}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSent ? 'flex-end' : 'flex-start',
        marginTop: topMargin,
        marginBottom: '2px',
        position: 'relative',
        transform: isSwipeActive ? `translateX(${swipeOffset}px)` : undefined,
        transition: isSwipeActive ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Swipe reply indicator */}
      {swipeOffset > 30 && (
        <div
          style={{
            position: 'absolute',
            left: '-30px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary)',
            color: 'var(--text-inverse)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            opacity: Math.min(swipeOffset / 60, 1),
          }}
        >
          ↩
        </div>
      )}

      {/* Main Bubble */}
      <div
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{
          maxWidth: '82%',
          padding: media && media.length > 0 ? '4px' : '10px 14px',
          backgroundColor: highlighted
            ? 'var(--accent-subtle)'
            : isSent
            ? 'var(--bubble-sent)'
            : 'var(--bubble-received)',
          color: isSent ? 'var(--text-sent)' : 'var(--text-received)',
          borderRadius: isSent ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          boxShadow: status === 'failed'
            ? `0 0 0 1.5px var(--semantic-error), var(--shadow-sm)`
            : 'var(--shadow-sm)',
          position: 'relative',
          wordBreak: 'break-word',
          fontSize: '15px',
          lineHeight: '1.45',
          fontFamily: 'var(--font-sans)',
          border: highlighted ? '1.5px solid var(--accent-primary)' : 'none',
          transition: 'all 0.3s ease',
          overflow: 'hidden',
        }}
      >
        {/* Quoted Reply Reference */}
        {replyTo && (
          <div
            onClick={() => replyTo.id && onScrollToOriginal && onScrollToOriginal(replyTo.id)}
            style={{
              padding: '6px 10px',
              margin: media && media.length > 0 ? '6px 10px 4px' : '0 0 8px 0',
              backgroundColor: isSent ? 'rgba(255, 255, 255, 0.12)' : 'var(--bg-tertiary)',
              borderLeft: '3px solid var(--accent-primary)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '13px',
              cursor: replyTo.id ? 'pointer' : 'default',
              color: isSent ? 'var(--text-sent)' : 'var(--text-secondary)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                fontSize: '11px',
                marginBottom: '2px',
                color: 'var(--accent-primary)',
                fontStyle: 'italic',
              }}
            >
              {replyTo.sender}
            </div>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {replyTo.text}
            </div>
          </div>
        )}

        {/* Media Attachments (Inline Preview) */}
        {media && media.length > 0 && (
          <div
            style={{
              marginBottom: '4px',
              borderRadius: '14px',
              overflow: 'hidden',
              ...(media.length === 1
                ? {}
                : {
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '2px',
                  }),
            }}
          >
            {media.map((item, i) => (
              <div
                key={i}
                onClick={() => onMediaClick?.(item)}
                style={{
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: media.length === 1 ? '14px' : '0',
                  maxHeight: media.length === 1 ? '260px' : '130px',
                }}
              >
                {item.type === 'image' || item.type === 'video' ? (
                  <>
                    <div
                      style={{
                        width: '100%',
                        height: media.length === 1 ? '200px' : '130px',
                        backgroundColor: 'var(--bg-tertiary)',
                        backgroundImage: item.url ? `url(${item.url})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-tertiary)',
                        fontSize: '24px',
                      }}
                    >
                      {!item.url && (item.type === 'video' ? '🎬' : '🖼️')}
                    </div>
                    {item.type === 'video' && item.duration && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '6px',
                          right: '6px',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-xs)',
                        }}
                      >
                        {item.duration}
                      </div>
                    )}
                  </>
                ) : (
                  /* Document Preview */
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: isSent ? 'rgba(255,255,255,0.08)' : 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '28px' }}>📄</span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name || 'Document'}
                      </div>
                      <div style={{ fontSize: '11px', color: isSent ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)' }}>
                        {item.size || 'Unknown size'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Audio Message — Tactile Dual-Thread Waveform */}
        {isVoiceNote ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: media ? '6px 10px 4px' : '4px 0',
              minWidth: '230px',
            }}
          >
            <button
              onClick={() => {
                setIsPlayingVoice(!isPlayingVoice);
                if (!isPlayingVoice) {
                  // Simulate playback progress
                  let progress = 0;
                  const interval = setInterval(() => {
                    progress += 5;
                    setPlaybackProgress(progress);
                    if (progress >= 100) {
                      clearInterval(interval);
                      setIsPlayingVoice(false);
                      setPlaybackProgress(0);
                    }
                  }, 200);
                }
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                flexShrink: 0,
                transition: 'transform 0.15s',
              }}
            >
              {isPlayingVoice ? '⏸' : '▶'}
            </button>

            {/* Dual-Thread Waveform Bars */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: '32px', position: 'relative' }}>
              {waveformData.map((h, i) => {
                const played = (i / waveformData.length) * 100 < playbackProgress;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      height: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Upper thread */}
                    <div
                      style={{
                        width: '100%',
                        height: `${h * 0.45}%`,
                        backgroundColor: played
                          ? 'var(--accent-primary)'
                          : isSent ? 'rgba(255,255,255,0.35)' : 'var(--border-strong)',
                        borderRadius: '1px',
                        transition: 'background-color 0.15s',
                      }}
                    />
                    {/* Lower thread (mirror, slightly shorter) */}
                    <div
                      style={{
                        width: '100%',
                        height: `${h * 0.3}%`,
                        backgroundColor: played
                          ? 'var(--accent-primary)'
                          : isSent ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                        borderRadius: '1px',
                        transition: 'background-color 0.15s',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                const nextSpeed = playbackSpeed === '1x' ? '1.5x' : playbackSpeed === '1.5x' ? '2x' : '1x';
                setPlaybackSpeed(nextSpeed);
              }}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isSent ? 'var(--text-sent)' : 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                minWidth: '28px',
              }}
            >
              {playbackSpeed}
            </button>
          </div>
        ) : (
          /* Standard Text Message */
          <div style={{ whiteSpace: 'pre-wrap', padding: media && media.length > 0 ? '4px 10px' : undefined }}>
            {searchQuery ? renderHighlightedText(text) : text}
          </div>
        )}

        {/* Footer Meta: Timestamp & Read Receipts */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '4px',
            marginTop: '4px',
            padding: media && media.length > 0 ? '0 10px 6px' : undefined,
            fontSize: '11px',
            color: isSent ? 'rgba(251, 249, 245, 0.65)' : 'var(--text-tertiary)',
            userSelect: 'none',
          }}
        >
          {isVoiceNote && (
            <span style={{ marginRight: 'auto', fontSize: '10px' }}>🎙️ {voiceDuration}</span>
          )}
          {status === 'failed' && (
            <span
              style={{
                marginRight: 'auto',
                fontSize: '11px',
                color: 'var(--semantic-error)',
                cursor: 'pointer',
              }}
              onClick={() => onRetry?.(id)}
            >
              Tap to retry
            </span>
          )}
          <span>{timestamp}</span>
          {isSent && renderStatus()}
        </div>
      </div>

      {/* Two-Person Partner Reaction Pill */}
      {reactions.length > 0 && (
        <div
          className={reactionsAnimating ? 'animate-reaction-pop' : ''}
          style={{
            position: 'relative',
            alignSelf: isSent ? 'flex-start' : 'flex-end',
            marginTop: '-8px',
            marginLeft: isSent ? '8px' : '0',
            marginRight: isSent ? '0' : '8px',
            display: 'flex',
            gap: '4px',
            padding: '2px 8px',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: 'var(--shadow-sm)',
            fontSize: '13px',
            zIndex: 2,
          }}
        >
          {reactions.map((r, i) => (
            <span key={i}>
              {r.emoji} {r.count > 1 && <strong style={{ fontSize: '10px' }}>{r.count}</strong>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
