import { useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../api/client';
import { Icon } from '../components/Icon';
import { MessageComposer } from '../components/MessageComposer';

interface ChatScreenProps {
  currentUser: string;
  accessToken: string;
  onOpenProfile: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
}

interface PartnerProfileState {
  username: string;
  displayName: string;
  isOnline: boolean;
  statusLabel: string;
}

interface ChatSnapshot {
  messageCount: number;
  syncedAt: string | null;
}

function getPartnerUsername(currentUser: string) {
  return currentUser.toLowerCase() === 'devansh' ? 'swarnima' : 'devansh';
}

export function ChatScreen({ currentUser, accessToken, onOpenProfile, onToggleTheme, theme }: ChatScreenProps) {
  const partnerUsername = useMemo(() => getPartnerUsername(currentUser), [currentUser]);
  const stream = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [partner, setPartner] = useState<PartnerProfileState | null>(null);
  const [chatSnapshot, setChatSnapshot] = useState<ChatSnapshot | null>(null);
  const [statusNotice, setStatusNotice] = useState('Live message rendering is still pending in Part 2.');

  useEffect(() => {
    let active = true;

    async function loadChatState() {
      setLoading(true);
      try {
        const [partnerUser, presence, messages] = await Promise.all([
          authFetch<{ username: string; display_name: string }>(`/users/${partnerUsername}`, accessToken, { method: 'GET' }),
          authFetch<{ username: string; is_online: boolean; last_seen_at: string | null }>(`/users/${partnerUsername}/presence`, accessToken, { method: 'GET' }),
          authFetch<Array<{ id: string; created_at: string }>>('/messages/sync', accessToken, { method: 'GET' }),
        ]);

        if (!active) return;

        setPartner({
          username: presence.username || partnerUser.username,
          displayName: partnerUser.display_name || partnerUser.username,
          isOnline: presence.is_online,
          statusLabel: presence.is_online ? 'Active now' : 'Away',
        });
        setChatSnapshot({
          messageCount: messages.length,
          syncedAt: messages[0]?.created_at ?? null,
        });
      } catch {
        if (active) {
          setPartner(null);
          setChatSnapshot(null);
          setStatusNotice('The conversation state is not available yet.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadChatState();
    return () => {
      active = false;
    };
  }, [accessToken, partnerUsername]);

  const results = query ? [] : [];
  const partnerLabel = partner?.displayName || partnerUsername;
  const emptyStateText = chatSnapshot && chatSnapshot.messageCount > 0
    ? `${chatSnapshot.messageCount} message record(s) are available from the server. The live UI rendering flow is still pending.`
    : 'No synced messages are available yet for this private channel.';

  return (
    <main className="chat-page">
      <section className="chat-main">
        {searching ? (
          <div className="chat-search">
            <button className="icon-button" onClick={() => { setSearching(false); setQuery(''); }} aria-label="Close search"><Icon name="arrow-left" size={19} /></button>
            <Icon name="search" size={17} />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this conversation" />
            <small>{query ? `${results.length} found` : ''}</small>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <div className="chat-identity">
                <button onClick={onOpenProfile}>
                  <span className="presence-avatar">{partnerLabel.slice(0, 1).toUpperCase()}</span>
                  <span>
                    <b>{partnerLabel}</b>
                    <small>{partner?.statusLabel || 'Checking presence…'}</small>
                  </span>
                </button>
              </div>
              <div className="chat-tools">
                <button className="icon-button" onClick={() => setSearching(true)} aria-label="Search conversation"><Icon name="search" size={19} /></button>
                <button className="icon-button" onClick={onToggleTheme} aria-label="Change appearance"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
                <button className="icon-button" onClick={onOpenProfile} aria-label="Open conversation settings"><Icon name="more" size={20} /></button>
              </div>
            </header>
            <div className="chat-private-note">
              <span><Icon name="lock" size={11} />Only you and {partnerLabel} can read what is said here.</span>
            </div>
          </>
        )}

        <div className="chat-stream" ref={stream}>
          {loading ? (
            <div className="chat-loading" aria-label="Loading conversation"><i /><i /><i /><i /></div>
          ) : (
            <div className="chat-empty">
              <p className="eyebrow">Conversation structure ready</p>
              <h2>The live message stream is still being wired in Part 2.</h2>
              <p>{emptyStateText}</p>
              <small>{statusNotice}</small>
            </div>
          )}
        </div>

        <MessageComposer
          onSendMessage={() => setStatusNotice('Live sending is pending in Part 2.')}
          replyPreview={null}
          onCancelReply={() => undefined}
        />
      </section>

      <aside className="chat-inspector">
        <h2>Shared in this thread</h2>
        <p>Media and message details will appear here once the live data layer is wired.</p>
        <div className="inspector-list">
          <div>
            <small>SERVER STATE</small>
            <b>{chatSnapshot ? `${chatSnapshot.messageCount} synced record(s)` : 'Reviewing connection…'}</b>
          </div>
          <div>
            <small>LAST UPDATE</small>
            <b>{chatSnapshot?.syncedAt ? new Date(chatSnapshot.syncedAt).toLocaleString() : 'Pending'}</b>
          </div>
          <div>
            <small>SECURITY</small>
            <b>Identity verified</b>
          </div>
        </div>
      </aside>
    </main>
  );
}
