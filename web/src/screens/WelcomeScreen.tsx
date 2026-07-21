import React from 'react';

interface WelcomeScreenProps {
  onStartLogin: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartLogin }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '100vh',
        padding: '60px 24px 40px 24px',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        textAlign: 'center',
      }}
    >
      {/* Top Brand Hero */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 'auto',
          marginBottom: 'auto',
        }}
      >
        {/* Interlocking Cryptographic Dual-Ring Vector Icon */}
        <div style={{ marginBottom: '24px', position: 'relative' }}>
          <svg width="84" height="84" viewBox="0 0 84 84" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="34" cy="42" r="24" stroke="var(--accent-primary)" strokeWidth="3.5" strokeOpacity="0.8" />
            <circle cx="50" cy="42" r="24" stroke="var(--accent-primary)" strokeWidth="3.5" />
            <circle cx="42" cy="42" r="6" fill="var(--accent-primary)" />
          </svg>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2.5rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Chit-Chat
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-secondary)',
            maxWidth: '280px',
            lineHeight: '1.5',
            letterSpacing: '0.01em',
          }}
        >
          An Exclusive Private Sanctuary for Two
        </p>
      </div>

      {/* Action Footer */}
      <div style={{ width: '100%', maxWidth: '360px', marginTop: 'auto' }}>
        <button
          onClick={onStartLogin}
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
            boxShadow: 'var(--shadow-md)',
            transition: 'transform 0.15s, background-color 0.2s',
            marginBottom: '16px',
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Log In to Your Channel
        </button>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          🔒 End-to-End Encrypted & Strictly Private
        </p>
      </div>
    </div>
  );
};
