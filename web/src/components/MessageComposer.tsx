import React, { useState, useRef } from 'react';

interface ReplyPreview {
  id: string;
  sender: string;
  text: string;
}

interface MessageComposerProps {
  onSendMessage: (text: string) => void;
  replyPreview?: ReplyPreview | null;
  onCancelReply?: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  replyPreview,
  onCancelReply,
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [slideCancel, setSlideCancel] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef(0);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto grow height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    setSlideCancel(0);
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (slideCancel < -80) {
      // Cancelled
      setRecordingDuration(0);
      setSlideCancel(0);
    } else {
      // Send voice note
      onSendMessage(`[Voice Note: ${formatDuration(recordingDuration)}]`);
      setRecordingDuration(0);
      setSlideCancel(0);
    }
  };

  const handleRecordingTouchMove = (e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - touchStartXRef.current;
    if (diff < 0) {
      setSlideCancel(diff);
    }
  };

  const handleRecordingTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    startRecording();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ position: 'sticky', bottom: 0, width: '100%', boxSizing: 'border-box' }}>
      {/* Reply Preview Bar */}
      {replyPreview && (
        <div
          className="animate-reply-bar"
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--surface-card)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              flex: 1,
              padding: '6px 10px',
              borderLeft: '3px solid var(--accent-primary)',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--bg-tertiary)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--accent-primary)',
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                marginBottom: '2px',
              }}
            >
              {replyPreview.sender}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {replyPreview.text}
            </div>
          </div>
          <button
            onClick={onCancelReply}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Recording Mode */}
      {isRecording ? (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--surface-overlay)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: 'var(--semantic-error)',
              animation: 'pulseGlow 1.5s infinite',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDuration(recordingDuration)}
          </span>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span
              style={{
                fontSize: '13px',
                color: 'var(--text-tertiary)',
                opacity: Math.min(1, 1 + slideCancel / 40),
              }}
            >
              {slideCancel < -60 ? 'Release to cancel' : '← Slide to cancel'}
            </span>
          </div>
          <button
            onClick={stopRecording}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--text-inverse)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ➔
          </button>
        </div>
      ) : (
        /* Standard Composer */
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--surface-overlay)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
          }}
        >
          {/* Attachment Button */}
          <button
            type="button"
            title="Share photo or document"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background-color 0.2s',
            }}
            onClick={() =>
              alert('Attachment drawer (Photos, Camera, Audio) ready for integration.')
            }
          >
            +
          </button>

          {/* Input Field Area */}
          <div
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '22px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              minHeight: '44px',
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Write a message..."
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '15px',
                fontFamily: 'var(--font-sans)',
                resize: 'none',
                lineHeight: '1.4',
                maxHeight: '120px',
              }}
            />
          </div>

          {/* Action Button: Voice Mic or Send Arrow */}
          {text.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              title="Send message"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--text-inverse)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'transform 0.1s, background-color 0.2s',
              }}
            >
              ➔
            </button>
          ) : (
            <button
              type="button"
              onTouchStart={handleRecordingTouchStart}
              onTouchMove={handleRecordingTouchMove}
              onTouchEnd={stopRecording}
              onClick={() => {
                // Desktop fallback: toggle recording
                if (!isRecording) startRecording();
                else stopRecording();
              }}
              title="Hold for voice note"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              🎙️
            </button>
          )}
        </div>
      )}
    </div>
  );
};
