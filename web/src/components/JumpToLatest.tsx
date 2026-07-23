import { Icon } from './Icon';

interface JumpToLatestProps {
  visible: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export function JumpToLatest({ visible, onClick, unreadCount = 0 }: JumpToLatestProps) {
  if (!visible) return null;

  if (unreadCount > 0) {
    return (
      <button className="chat-unread" onClick={onClick} aria-label={`${unreadCount} new message${unreadCount === 1 ? '' : 's'} — jump to latest`}>
        {unreadCount} new message{unreadCount === 1 ? '' : 's'} ↓
      </button>
    );
  }

  return (
    <button className="chat-jump" onClick={onClick} aria-label="Jump to latest messages">
      <Icon name="chevron-down" size={17} />
    </button>
  );
}
