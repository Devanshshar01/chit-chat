import { useCallback, useEffect, useMemo, useState } from 'react';
import { authFetch } from '../api/client';
import { Icon } from '../components/Icon';
import { getDB } from '../db';

interface ProfileScreenProps {
  currentUser: string;
  accessToken: string;
  onClose: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
}

interface PartnerProfileState {
  username: string;
  displayName: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  statusLabel: string;
}

function getPartnerUsername(currentUser: string) {
  return currentUser.toLowerCase() === 'devansh' ? 'swarnima' : 'devansh';
}

function formatLastSeen(lastSeenAt: string | null | undefined) {
  if (!lastSeenAt) return 'Status unavailable yet';
  const parsed = new Date(lastSeenAt);
  if (Number.isNaN(parsed.getTime())) return 'Status unavailable yet';
  const diff = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  const minutes = Math.floor(diff / 60);
  if (minutes < 1) return 'Active just now';
  if (minutes < 60) return `Last active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Last active ${hours}h ago` : `Last active ${Math.floor(hours / 24)}d ago`;
}

export function ProfileScreen({ currentUser, accessToken, onClose, onLogout, onToggleTheme, theme }: ProfileScreenProps) {
  const partnerUsername = useMemo(() => getPartnerUsername(currentUser), [currentUser]);
  const [partner, setPartner] = useState<PartnerProfileState | null>(null);

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  const [cacheMetrics, setCacheMetrics] = useState<{ messageCount: number; sizeBytes: number | null }>({
    messageCount: 0,
    sizeBytes: null,
  });

  const [clearStatus, setClearStatus] = useState<string | null>(null);

  // Load partner presence & info
  useEffect(() => {
    let active = true;

    async function loadPartnerState() {
      try {
        const [partnerUser, presence] = await Promise.all([
          authFetch<{ username: string; display_name: string }>(`/users/${partnerUsername}`, accessToken, { method: 'GET' }),
          authFetch<{ username: string; is_online: boolean; last_seen_at: string | null }>(`/users/${partnerUsername}/presence`, accessToken, { method: 'GET' }),
        ]);

        if (!active) return;
        setPartner({
          username: presence.username || partnerUser.username,
          displayName: partnerUser.display_name || partnerUser.username,
          isOnline: presence.is_online,
          lastSeenAt: presence.last_seen_at,
          statusLabel: presence.is_online ? 'Active now' : formatLastSeen(presence.last_seen_at),
        });
      } catch {
        if (active) setPartner(null);
      }
    }

    void loadPartnerState();
    return () => {
      active = false;
    };
  }, [accessToken, partnerUsername]);

  // Load storage & cache size
  const updateCacheMetrics = useCallback(async () => {
    try {
      const db = await getDB();
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const countReq = store.count();

      countReq.onsuccess = async () => {
        let size: number | null = null;
        if (navigator.storage && navigator.storage.estimate) {
          try {
            const estimate = await navigator.storage.estimate();
            size = estimate.usage || null;
          } catch {
            size = null;
          }
        }
        setCacheMetrics({ messageCount: countReq.result, sizeBytes: size });
      };
    } catch (err) {
      console.warn('Failed to estimate storage metrics:', err);
    }
  }, []);

  useEffect(() => {
    void updateCacheMetrics();
  }, [updateCacheMetrics]);

  const handleRequestPushPermission = async () => {
    if (!('Notification' in window)) {
      setClearStatus('Push notifications are not supported in this browser environment.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      setClearStatus('Push notification permission granted.');
    } else if (permission === 'denied') {
      setClearStatus('Push notification permission denied by user.');
    }
  };

  const handleClearCache = async () => {
    try {
      const db = await getDB();
      const tx = db.transaction(['messages', 'outbox'], 'readwrite');
      tx.objectStore('messages').clear();
      tx.objectStore('outbox').clear();

      tx.oncomplete = () => {
        setClearStatus('Local message cache cleared successfully.');
        void updateCacheMetrics();
      };
    } catch {
      setClearStatus('Failed to clear local storage cache.');
    }
  };

  const partnerLabel = partner?.displayName || partnerUsername;

  const formatSize = (bytes: number | null) => {
    if (bytes === null) return 'Calculated per device';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <aside className="profile-overlay" role="dialog" aria-modal="true" aria-label="Account and privacy">
      <header className="profile-header">
        <button className="icon-button" onClick={onClose} aria-label="Close settings"><Icon name="close" size={19} /></button>
        <h1>Account & privacy</h1>
        <span style={{ width: 38 }} />
      </header>

      <div className="profile-content">
        {clearStatus && (
          <div style={{ padding: '8px 12px', background: 'var(--accent-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span>{clearStatus}</span>
            <button onClick={() => setClearStatus(null)} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
          </div>
        )}

        <section className="profile-person">
          <span className="presence-avatar">{partnerLabel.slice(0, 1).toUpperCase()}</span>
          <h2>{partnerLabel}</h2>
          <p>{partner ? `${partner.statusLabel} · private space for two` : 'Presence is loading…'}</p>
        </section>

        {/* Identity Section — Zero fake data */}
        <section className="profile-block">
          <h3><Icon name="shield" size={16} />Identity & Session</h3>
          <p>You are authenticated as <strong>{currentUser}</strong> in a private 1-on-1 space with <strong>{partnerLabel}</strong>.</p>
          <div className="profile-row" style={{ marginTop: 8 }}>
            <span><b>Account ID</b><small>{currentUser}</small></span>
            <span style={{ fontSize: 12, color: 'var(--semantic-success)' }}>Active</span>
          </div>
        </section>

        {/* Settings & Preferences */}
        <section className="profile-block">
          <h3>Preferences</h3>
          <div className="profile-row">
            <span><b>Appearance</b><small>{theme === 'dark' ? 'Dark, low-light friendly' : 'Light, paper-like'}</small></span>
            <button className="text-button" onClick={onToggleTheme}>{theme === 'dark' ? 'Use light mode' : 'Use dark mode'}</button>
          </div>
          <div className="profile-row">
            <span>
              <b>Push notifications</b>
              <small>State: <strong>{notificationPermission}</strong></small>
            </span>
            {notificationPermission !== 'granted' ? (
              <button className="text-button" onClick={handleRequestPushPermission}>Enable notifications</button>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--semantic-success)' }}>Enabled</span>
            )}
          </div>
        </section>

        {/* Storage & Privacy Settings */}
        <section className="profile-block">
          <h3>Storage & Cache</h3>
          <div className="profile-row">
            <span>
              <b>IndexedDB cache</b>
              <small>{cacheMetrics.messageCount} stored message(s) · {formatSize(cacheMetrics.sizeBytes)}</small>
            </span>
            <button className="text-button" onClick={handleClearCache} style={{ color: 'var(--semantic-error)' }}>Clear cache</button>
          </div>
          <div className="profile-row">
            <span><b>Backup & Export</b><small>Not yet built (backend endpoint required)</small></span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Unavailable</span>
          </div>
        </section>

        {/* Profile Details — Backend Gap Disclosure */}
        <section className="profile-block">
          <h3>Profile details</h3>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Custom profile editing (bio, avatar upload, favorite emoji) is flagged as unavailable pending backend database schema migration.
          </div>
        </section>

        <button className="logout-button" onClick={onLogout}>Log out of this device</button>
      </div>
    </aside>
  );
}
