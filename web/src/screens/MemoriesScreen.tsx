import { useEffect, useState } from 'react';
import { authFetch } from '../api/client';

type MemoryType = 'all' | 'quote' | 'milestone';

interface MemoriesScreenProps {
  accessToken: string;
}

export function MemoriesScreen({ accessToken }: MemoriesScreenProps) {
  const [filter, setFilter] = useState<MemoryType>('all');
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMessages() {
      setLoading(true);
      setError(null);
      try {
        const messages = await authFetch<Array<{ id: string }>>('/messages/sync', accessToken, { method: 'GET' });
        if (!active) return;
        setMessageCount(messages.length);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Message history is unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMessages();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const visible = filter === 'all' ? ['history'] : filter === 'milestone' ? ['history'] : [];

  return (
    <main className="app-page memory-page">
      <header className="memory-header">
        <div>
          <p className="eyebrow">Shared archive</p>
          <h1 className="page-title">Things worth<br />returning to.</h1>
          <p className="page-intro">Saved notes and shared media will appear here once the server-side data is available.</p>
        </div>
        <div className="memory-filter" aria-label="Filter memories">
          {([{ id: 'all', label: 'Everything' }, { id: 'quote', label: 'Notes' }, { id: 'milestone', label: 'Moments' }] as const).map((item) => (
            <button key={item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
      </header>

      <section className="memory-feature">
        <blockquote>Shared history is only visible when the backend has data to surface.</blockquote>
        <p>{loading ? 'Checking the connected message history…' : error ? error : messageCount !== null ? `${messageCount} message record(s) are available from the server.` : 'No history available yet.'}</p>
      </section>

      <section className="memory-timeline" aria-label="Saved memories">
        {visible.length === 0 ? (
          <div className="memory-empty">No saved memories are available from the server yet.</div>
        ) : (
          visible.map((id) => (
            <article className="memory-entry" key={id}>
              <div className="memory-entry__line" aria-hidden="true" />
              <div>
                <time>{messageCount !== null ? 'Synced from the backend' : 'Pending sync'}</time>
                <h2>Message history</h2>
                <p>{messageCount !== null ? `The backend currently reports ${messageCount} message record(s).` : 'The history view is waiting for the first sync.'}</p>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
