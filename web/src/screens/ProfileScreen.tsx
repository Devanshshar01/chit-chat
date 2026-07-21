import React from 'react';
import { Avatar } from '../components/Avatar';

interface ProfileScreenProps {
  currentUser: string;
  onClose: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  currentUser,
  onClose,
  onLogout,
  onToggleTheme,
  theme,
}) => {
  const partnerName = currentUser.toLowerCase() === 'devansh' ? 'Swarnima' : 'Devansh';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-primary)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        animation: 'slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          height: '60px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--surface-overlay)',
          backdropFilter: 'blur(16px)',
          zIndex: 10,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Partner Profile & Security
        </h2>
        <div style={{ width: '20px' }} />
      </div>

      {/* Profile Body */}
      <div style={{ padding: '32px 20px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
        {/* Avatar Hero */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-block', marginBottom: '12px' }}>
            <Avatar size="lg" name={partnerName} showPresence={true} isOnline={true} />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.75rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 4px 0',
            }}
          >
            {partnerName}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Active now • Private E2EE Connected
          </p>
        </div>

        {/* E2EE Cryptographic Safety Numbers Card */}
        <div
          style={{
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔒</span>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Cryptographic Key Fingerprint
            </h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.4' }}>
            End-to-End Encryption safety numbers verifying your private channel identity:
          </p>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-secondary)',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
              textAlign: 'center',
              letterSpacing: '0.1em',
              wordBreak: 'break-all',
            }}
          >
            4A82 9F01 B3C7 8890 E51A 224F 991B 73CC
          </div>
        </div>

        {/* Account Details Card */}
        <div
          style={{
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
            Preferences & Security
          </h3>

          {/* Theme Toggle Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>App Theme</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                {theme === 'dark' ? 'Midnight Slate (Dark)' : 'Warm Alabaster (Light)'}
              </div>
            </div>
            <button
              onClick={onToggleTheme}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? '☀️ Switch Light' : '🌙 Switch Dark'}
            </button>
          </div>

          {/* Logged in User info */}
          <div style={{ padding: '12px 0' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Logged in as</div>
            <div style={{ fontSize: '0.95rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {currentUser}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: 'var(--semantic-error)',
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
};
