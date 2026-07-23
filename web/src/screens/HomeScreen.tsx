import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../api/client';
import { Icon } from '../components/Icon';
import { wsService } from '../services/websocket';

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

const PRESENCE_POLL_INTERVAL = 30_000;

export function HomeScreen({ currentUser, accessToken, onOpenChat, onOpenProfile, onNavigateTab }: HomeScreenProps) {
  const partnerUsername = useMemo(() => getPartnerUsername(currentUser), [currentUser]);
  const [partner, setPartner] = useState<PartnerProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const loadPartnerState = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }

    try {
      const [partnerUser, presence] = await Promise.all([
        authFetch<{ username: string; display_name: string }>(`/users/${partnerUsername}`, accessToken, { method: 'GET' }),
        authFetch<{ username: string; is_online: boolean; last_seen_at: string | null }>(`/users/${partnerUsername}/presence`, accessToken, { method: 'GET' }),
      ]);

      setPartner({
        username: presence.username || partnerUser.username,
        displayName: partnerUser.display_name || partnerUser.username,
        isOnline: presence.is_online,
        lastSeenAt: presence.last_seen_at,
        statusLabel: presence.is_online ? 'Active now' : formatLastSeen(presence.last_seen_at),
      });
    } catch (err) {
      if (isInitial) {
        setError(err instanceof Error ? err.message : 'Presence is unavailable right now.');
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [accessToken, partnerUsername]);

  useEffect(() => {
    let active = true;

    async function init() {
      if (!active) return;
      await loadPartnerState(true);
    }

    void init();

    const handlePresence = (event: { username: string; is_online: boolean; last_seen_at: string }) => {
      if (!active) return;
      if (event.username?.toLowerCase() === partnerUsername.toLowerCase()) {
        setPartner((prev) => ({
          username: event.username,
          displayName: prev?.displayName || event.username,
          isOnline: event.is_online,
          lastSeenAt: event.last_seen_at,
          statusLabel: event.is_online ? 'Active now' : formatLastSeen(event.last_seen_at),
        }));
      }
    };

    wsService.on('presence', handlePresence);

    pollRef.current = window.setInterval(() => {
      if (active) void loadPartnerState(false);
    }, PRESENCE_POLL_INTERVAL);

    return () => {
      active = false;
      wsService.off('presence', handlePresence);
      if (pollRef.current !== null) clearInterval(pollRef.current);
    };
  }, [loadPartnerState, partnerUsername]);

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
              <i aria-hidden="true" style={{ background: partner.isOnline ? 'var(--semantic-success)' : 'var(--text-tertiary)' }} />
              <p>
                <b>{partnerLabel} {partner.isOnline ? 'is here' : 'is away'}</b>
                <br />
                <small>{partner.statusLabel}</small>
              </p>
              <Icon name="shield" size={17} aria-label="Encrypted" />
            </div>
          ) : (
            <div className="home-empty" style={{ padding: '13px 0', color: 'var(--text-secondary)', fontSize: 13 }}>Presence details are unavailable yet.</div>
          )}
        </section>

        <section>
          <div className="home-section-heading">
            <h2>Quick actions</h2>
          </div>
          <div className="activity-list">
            <button className="activity-row" onClick={onOpenChat} style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
              <span><Icon name="message" size={14} /></span>
              <span style={{ flex: 1 }}>
                <b>Open conversation</b>
                <small>Continue your private thread</small>
              </span>
            </button>
            <button className="activity-row" onClick={() => onNavigateTab('memories')} style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
              <span><Icon name="bookmark" size={14} /></span>
              <span style={{ flex: 1 }}>
                <b>Saved memories</b>
                <small>Notes and moments you kept</small>
              </span>
            </button>
            <button className="activity-row" onClick={() => onNavigateTab('vault')} style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
              <span><Icon name="archive" size={14} /></span>
              <span style={{ flex: 1 }}>
                <b>Shared library</b>
                <small>Photos, documents, and voice notes</small>
              </span>
            </button>
          </div>
        </section>

        {/* DEFERRED: Streak counters — no backend endpoint */}
        {/* DEFERRED: Shared music status — no backend endpoint */}
        {/* DEFERRED: Memory of the day — no backend endpoint */}
        {/* DEFERRED: Activity feed — messages are encrypted ciphertext, can't render without decryption */}
      </div>
    </main>
  );
}
