import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

interface ContextMenuProps {
  visible: boolean;
  messageId: string | null;
  onClose: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (messageId: string) => void;
  onCopy: (messageId: string) => void;
  onForward: (messageId: string) => void;
  onDelete: (messageId: string) => void;
}

export function ContextMenu({ visible, messageId, onClose, onReact, onReply, onCopy, onForward, onDelete }: ContextMenuProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible, onClose]);

  if (!visible || !messageId) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === backdropRef.current) onClose();
  };

  return (
    <div className="chat-menu-backdrop" ref={backdropRef} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Message actions">
      <div className="chat-menu">
        <div className="chat-menu__reactions" role="group" aria-label="Quick reactions">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} onClick={() => { onReact(messageId, emoji); onClose(); }} aria-label={`React with ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
        <button onClick={() => { onReply(messageId); onClose(); }}>
          <Icon name="reply" size={16} /> Reply
        </button>
        <button onClick={() => { onCopy(messageId); onClose(); }}>
          <Icon name="copy" size={16} /> Copy text
        </button>
        <button onClick={() => { onForward(messageId); onClose(); }}>
          <Icon name="send" size={16} /> Forward
        </button>
        <button className="danger" onClick={() => { onDelete(messageId); onClose(); }}>
          <Icon name="trash" size={16} /> Delete for me
        </button>
      </div>
    </div>
  );
}
