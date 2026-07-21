import React from 'react';
import { Avatar } from '../components/Avatar';

interface HomeScreenProps {
  currentUser: string;
  onOpenChat: () => void;
  onOpenProfile: () => void;
  onNavigateTab: (tab: 'memories' | 'vault') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentUser,
  onOpenChat,
  onOpenProfile,
  onNavigateTab,
}) => {
  const partnerName = currentUser.toLowerCase() === 'devansh' ? 'Swarnima' : 'Devansh';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        overflowY: 'auto',
        padding: '20px 16px 80px 16px',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div onClick={onOpenProfile} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <Avatar size="md" name={partnerName} showPresence={true} isOnline={true} />
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {partnerName} & {currentUser}
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 500 }}>
              ● Together in app
            </span>
          </div>
        </div>

        <button
          onClick={onOpenProfile}
          title="Security & Profile Settings"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          ⚙️
        </button>
      </div>

      {/* Hero Relationship Card */}
      <div
        style={{
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 24px',
          boxShadow: 'var(--shadow-md)',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
          }}
        >
          ✨ Starred Quote of the Day
        </div>

        <blockquote
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.35rem',
            fontStyle: 'italic',
            color: 'var(--text-primary)',
            lineHeight: '1.4',
            margin: '0 0 16px 0',
          }}
        >
          "You are my favorite notification every single day."
        </blockquote>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
          — {partnerName} (Yesterday at 11:15 PM)
        </div>

        {/* Primary CTA: Open Chat */}
        <button
          onClick={onOpenChat}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--text-inverse)',
            backgroundColor: 'var(--accent-primary)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'transform 0.15s, background-color 0.2s',
          }}
        >
          <span>💬</span>
          <span>Open Private Channel</span>
        </button>
      </div>

      {/* Presence & Local Time Widget */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Partner Status</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
            {partnerName} is Active Now
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 500 }}>
          📍 E2EE Connected
        </div>
      </div>

      {/* Shared Memories Preview Strip */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Recent Shared Memories
          </h3>
          <button
            onClick={() => onNavigateTab('vault')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent-primary)',
              cursor: 'pointer',
            }}
          >
            View All →
          </button>
        </div>

        {/* Horizontal Strip */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '8px',
          }}
        >
          {[
            { id: '1', title: 'Sunset View', color: '#3b82f6', icon: '🖼️' },
            { id: '2', title: 'Voice Note (0:42)', color: '#10b981', icon: '🎙️' },
            { id: '3', title: 'Coffee Date', color: '#f59e0b', icon: '🖼️' },
          ].map((m) => (
            <div
              key={m.id}
              onClick={() => onNavigateTab('vault')}
              style={{
                flexShrink: 0,
                width: '130px',
                height: '110px',
                backgroundColor: m.color,
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '20px' }}>{m.icon}</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{m.title}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
