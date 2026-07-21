import React, { useState } from 'react';

interface DeviceSetupScreenProps {
  onCompleteSetup: (deviceName: string) => void;
}

export const DeviceSetupScreen: React.FC<DeviceSetupScreenProps> = ({ onCompleteSetup }) => {
  const [deviceName, setDeviceName] = useState('Pixel 8 Pro (Web PWA)');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCompleteSetup(deviceName);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        padding: '24px 20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px 28px',
          boxShadow: 'var(--shadow-lg)',
          animation: 'slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📱</div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.75rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}
          >
            New Device Setup
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Authorize and name this device for your private channel
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Device Name Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Device Name
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Pixel 8 Pro (Web PWA)"
              style={{
                padding: '14px 16px',
                fontSize: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-strong)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Notification Permission Primer Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                🔔 Enable Push Notifications
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Receive instant alerts when your partner messages
              </div>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                accentColor: 'var(--accent-primary)',
                cursor: 'pointer',
              }}
            />
          </div>

          {/* Complete Button */}
          <button
            type="submit"
            style={{
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-inverse)',
              backgroundColor: 'var(--accent-primary)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)',
              transition: 'background-color 0.2s',
            }}
          >
            Complete Setup & Enter Sanctuary
          </button>
        </form>
      </div>
    </div>
  );
};
