import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../api/client';
import { Icon } from '../components/Icon';

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

  const partnerLabel = partner?.displayName || partnerUsername;

  return (
    <aside className="profile-overlay" role="dialog" aria-modal="true" aria-label="Account and privacy">
      <header className="profile-header">
        <button className="icon-button" onClick={onClose} aria-label="Close settings"><Icon name="close" size={19} /></button>
        <h1>Account & privacy</h1>
        <span style={{ width: 38 }} />
      </header>
      <div className="profile-content">
        <section className="profile-person">
          <span className="presence-avatar">{partnerLabel.slice(0, 1).toUpperCase()}</span>
          <h2>{partnerLabel}</h2>
          <p>{partner ? `${partner.statusLabel} · private channel connected` : 'Presence is loading…'}</p>
        </section>
        <section className="profile-block">
          <h3><Icon name="shield" size={16} />Identity verified</h3>
          <p>This fingerprint helps you confirm that this private channel belongs to the two of you.</p>
          <div className="fingerprint">4A82 9F01 B3C7 8890<br />E51A 224F 991B 73CC</div>
        </section>
        <section className="profile-block">
          <h3>Preferences</h3>
          <div className="profile-row">
            <span><b>Appearance</b><small>{theme === 'dark' ? 'Dark, low-light friendly' : 'Light, paper-like'}</small></span>
            <button onClick={onToggleTheme}>{theme === 'dark' ? 'Use light' : 'Use dark'}</button>
          </div>
          <div className="profile-row">
            <span><b>Signed in as</b><small>{currentUser}</small></span>
            <Icon name="user" size={17} aria-label="User" />
          </div>
        </section>
        <button className="logout-button" onClick={onLogout}>Log out of this device</button>
      </div>
    </aside>
  );
}
