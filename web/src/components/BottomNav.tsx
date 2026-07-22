import { Icon } from './Icon';

export type TabType = 'home' | 'chat' | 'memories' | 'vault';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadCount?: number;
}

const tabs: { id: TabType; label: string; icon: 'home' | 'message' | 'bookmark' | 'archive' }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'chat', label: 'Chat', icon: 'message' },
  { id: 'memories', label: 'Saved', icon: 'bookmark' },
  { id: 'vault', label: 'Library', icon: 'archive' },
];

export function BottomNav({ activeTab, onTabChange, unreadCount = 0 }: BottomNavProps) {
  return <nav className="mobile-navigation" aria-label="Primary navigation">
    {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => onTabChange(tab.id)} aria-current={activeTab === tab.id ? 'page' : undefined}>
      <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        <Icon name={tab.icon} size={19} />
        {tab.id === 'chat' && unreadCount > 0 && <i className="nav-unread">{unreadCount}</i>}
      </span>
      <span>{tab.label}</span>
    </button>)}
  </nav>;
}
