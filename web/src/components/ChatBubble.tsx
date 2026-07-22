import { useRef, useState } from 'react';
import { Icon } from './Icon';

export interface ReactionItem { emoji: string; count: number; }
export interface MediaItem {
  type: 'image' | 'video' | 'document';
  url: string;
  thumbnail?: string;
  name?: string;
  size?: string;
  duration?: string;
}

export interface ChatBubbleProps {
  id: string; text: string; timestamp: string; isSent: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyTo?: { id?: string; sender: string; text: string };
  reactions?: ReactionItem[]; isVoiceNote?: boolean; voiceDuration?: string;
  media?: MediaItem[]; highlighted?: boolean; isNew?: boolean; searchQuery?: string;
  prevSameSender?: boolean; onReactionAdd?: (id: string, emoji: string) => void;
  onOpenContextMenu?: (id: string) => void; onScrollToOriginal?: (replyId: string) => void;
  onSwipeReply?: (id: string) => void; onRetry?: (id: string) => void;
  onMediaClick?: (media: MediaItem) => void;
}

export function ChatBubble(props: ChatBubbleProps) {
  const { id, text, timestamp, isSent, status = 'read', replyTo, reactions = [], isVoiceNote,
    voiceDuration = '0:42', media, highlighted, isNew, searchQuery, prevSameSender,
    onReactionAdd, onOpenContextMenu, onScrollToOriginal, onSwipeReply, onRetry, onMediaClick } = props;
  const touchStart = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('1x');
  const bubbleClass = [
    'chat-message', isSent ? 'chat-message--sent' : 'chat-message--received',
    prevSameSender ? 'chat-message--grouped' : '', highlighted ? 'chat-message--highlighted' : '',
    isNew ? (isSent ? 'animate-message-send' : 'animate-message-receive') : '',
  ].filter(Boolean).join(' ');

  const highlightText = (value: string) => {
    if (!searchQuery) return value;
    const parts = value.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, index) => part.toLowerCase() === searchQuery.toLowerCase()
      ? <mark key={index} className="search-highlight">{part}</mark> : part);
  };

  const receipt = () => {
    if (!isSent) return null;
    if (status === 'failed') return <button className="message-retry" onClick={() => onRetry?.(id)}>Retry</button>;
    if (status === 'sending') return <span className="message-status">Sending</span>;
    return <span className={`message-checks ${status === 'read' ? 'message-checks--read' : ''}`} aria-label={status}>
      <Icon name="check" size={13} /><Icon name="check" size={13} />
    </span>;
  };

  const waveform = [20, 42, 30, 66, 38, 76, 56, 29, 52, 72, 43, 58, 27, 45, 68, 35, 48];
  return (
    <article id={`bubble-${id}`} className={bubbleClass}
      style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined }}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }}
      onTouchMove={(event) => setSwipeOffset(Math.max(0, Math.min(64, (event.touches[0].clientX - touchStart.current) * 0.45)))}
      onTouchEnd={() => { if (swipeOffset > 42) onSwipeReply?.(id); setSwipeOffset(0); }}>
      {swipeOffset > 24 && <span className="reply-swipe-cue"><Icon name="reply" size={15} /></span>}
      <div className="message-bubble" onDoubleClick={() => onReactionAdd?.(id, '❤')} onContextMenu={(event) => { event.preventDefault(); onOpenContextMenu?.(id); }}>
        {replyTo && <button className="message-quote" onClick={() => replyTo.id && onScrollToOriginal?.(replyTo.id)}>
          <span>{replyTo.sender}</span><b>{replyTo.text}</b>
        </button>}
        {media?.length ? <div className={`message-media message-media--${media.length > 1 ? 'grid' : 'single'}`}>
          {media.map((item, index) => <button key={`${item.type}-${index}`} className={`media-tile media-tile--${item.type}`} onClick={() => onMediaClick?.(item)}>
            {item.type === 'image' && <img src={item.thumbnail || item.url} alt="Shared in conversation" />}
            {item.type === 'video' && <><img src={item.thumbnail || item.url} alt="Video preview" /><span className="media-play"><Icon name="play" size={18} /></span><small>{item.duration}</small></>}
            {item.type === 'document' && <><span className="document-mark">PDF</span><span><b>{item.name || 'Shared document'}</b><small>{item.size || '1.4 MB'}</small></span></>}
          </button>)}
        </div> : isVoiceNote ? <div className="voice-note">
          <button className="voice-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause voice note' : 'Play voice note'}><Icon name={playing ? 'close' : 'play'} size={16} /></button>
          <div className="voice-wave" aria-hidden="true">{waveform.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
          <button className="voice-speed" onClick={() => setSpeed(speed === '1x' ? '1.5x' : speed === '1.5x' ? '2x' : '1x')}>{speed}</button>
        </div> : <p className="message-text">{highlightText(text)}</p>}
        <footer className="message-meta"><time>{timestamp}</time>{isVoiceNote && <span>{voiceDuration}</span>}{receipt()}</footer>
      </div>
      {reactions.length > 0 && <div className="message-reactions">{reactions.map((reaction) => <span key={reaction.emoji}>{reaction.emoji}{reaction.count > 1 && <b>{reaction.count}</b>}</span>)}</div>}
    </article>
  );
}
