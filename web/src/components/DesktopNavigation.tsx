import { BrandMark } from './BrandMark';
import { Icon } from './Icon';
import type { TabType } from './BottomNav';

interface DesktopNavigationProps {
  activeTab: TabType;
  currentUser: string;
  onTabChange: (tab: TabType) => void;
  onOpenProfile: () => void;
}

const navigation: { id: TabType; label: string; icon: 'home' | 'message' | 'bookmark' | 'archive' }[] = [
  { id: 'home', label: 'Overview', icon: 'home' },
  { id: 'chat', label: 'Conversation', icon: 'message' },
  { id: 'memories', label: 'Memories', icon: 'bookmark' },
  { id: 'vault', label: 'Library', icon: 'archive' },
];

export function DesktopNavigation({ activeTab, currentUser, onTabChange, onOpenProfile }: DesktopNavigationProps) {
  return <aside className="desktop-navigation">
    <div className="desktop-navigation__brand"><BrandMark compact /><span>chit-chat</span></div>
    <nav aria-label="Primary navigation" className="desktop-navigation__links">
      {navigation.map((item) => <button key={item.id} className={activeTab === item.id ? 'is-active' : ''} onClick={() => onTabChange(item.id)}>
        <Icon name={item.icon} size={19} /><span>{item.label}</span>
      </button>)}
    </nav>
    <div className="desktop-navigation__private"><Icon name="lock" size={15} /><span>Private space<br />for two</span></div>
    <button className="desktop-navigation__account" onClick={onOpenProfile}>
      <span className="account-avatar">{currentUser.slice(0, 1).toUpperCase()}</span>
      <span><b>{currentUser}</b><small>Account settings</small></span>
      <Icon name="more" size={18} />
    </button>
  </aside>;
}
