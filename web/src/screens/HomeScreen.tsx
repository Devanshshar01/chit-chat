import { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../api/client';
import { Icon } from '../components/Icon';

interface HomeScreenProps {
  currentUser: string;
  accessToken: string;
  onOpenChat: () => void;
  onOpenProfile: () => void;
  onNavigateTab: (tab: 'memories' | 'vault') => void;
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
  if (hours < 24) return `Last active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Last active ${days}d ago`;
}

export function HomeScreen({ currentUser, accessToken, onOpenChat, onOpenProfile }: HomeScreenProps) {
  const partnerUsername = useMemo(() => getPartnerUsername(currentUser), [currentUser]);
  const [partner, setPartner] = useState<PartnerProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPartnerState() {
      setLoading(true);
      setError(null);

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
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Presence is unavailable right now.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPartnerState();
    return () => {
      active = false;
    };
  }, [accessToken, partnerUsername]);

  const partnerLabel = partner?.displayName || partnerUsername;
  const statusText = loading ? 'Checking connection state…' : error ? error : partner?.statusLabel || 'Status unavailable';

  return (
    <main className="app-page home-page">
      <header className="page-topline">
        <button className="home-greeting" onClick={onOpenProfile} aria-label={`Open ${partnerLabel}'s profile`}>
          <span className="presence-avatar">{partnerLabel.slice(0, 1).toUpperCase()}</span>
          <span>
            <small>private space for two</small>
            <b>{partnerLabel} + {currentUser}</b>
          </span>
        </button>
        <button className="icon-button" onClick={onOpenProfile} aria-label="Open settings"><Icon name="settings" size={19} /></button>
      </header>

      <section className="home-hero" aria-labelledby="home-quote">
        <div>
          <p className="eyebrow">Private channel ready</p>
          <blockquote id="home-quote" className="home-quote">Your conversation stays private and updates from the server when it is available.</blockquote>
          <p className="home-quote-author">{statusText}</p>
        </div>
        <button className="primary-button home-open-chat" onClick={onOpenChat}>
          <Icon name="message" size={17} />Open conversation
        </button>
      </section>

      <div className="home-dashboard">
        <section>
          <div className="home-section-heading">
            <h2>Right now</h2>
            <span>{partner?.isOnline ? 'Live' : 'Away'}</span>
          </div>
          {partner ? (
            <div className="partner-status">
              <i aria-hidden="true" />
              <p>
                <b>{partnerLabel} is here</b>
                <br />
                <small>{partner.statusLabel}</small>
              </p>
              <Icon name="shield" size={17} aria-label="Encrypted" />
            </div>
          ) : (
            <div className="home-empty">Presence details are unavailable yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}
