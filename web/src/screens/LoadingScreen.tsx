import React, { useEffect } from 'react';

interface LoadingScreenProps {
  partnerName: string;
  onComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ partnerName, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: '24px', position: 'relative' }}>
        <div
          style={{
            fontSize: '42px',
            animation: 'pulseGlow 2s infinite',
          }}
        >
          🔒
        </div>
      </div>

      <h2
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.5rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
        }}
      >
        Decrypting Private Channel...
      </h2>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Performing End-to-End Cryptographic Key Exchange for {partnerName}
      </p>

      {/* Progress Micro Bar */}
      <div
        style={{
          width: '200px',
          height: '3px',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-pill)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: 'var(--accent-primary)',
            borderRadius: 'var(--radius-pill)',
            animation: 'slideUpFade 1.2s ease-out forwards',
            width: '100%',
          }}
        />
      </div>
    </div>
  );
};
