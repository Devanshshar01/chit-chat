import React from 'react';

export type TabType = 'home' | 'chat' | 'memories' | 'vault';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
}) => {
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'memories', label: 'Memories', icon: '✨' },
    { id: 'vault', label: 'Vault', icon: '🖼️' },
  ];

  return (
    <div
      style={{
        height: '64px',
        backgroundColor: 'var(--surface-overlay)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        position: 'sticky',
        bottom: 0,
        width: '100%',
        zIndex: 50,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              background: 'none',
              border: 'none',
              padding: '6px 16px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: '18px' }}>{tab.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500 }}>
              {tab.label}
            </span>

            {tab.id === 'chat' && unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '12px',
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--text-inverse)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
