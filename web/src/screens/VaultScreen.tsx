import { useEffect, useState } from 'react';
import { authFetch } from '../api/client';
import { Icon } from '../components/Icon';

type Category = 'photos' | 'documents' | 'audio';

interface VaultScreenProps {
  accessToken: string;
}

export function VaultScreen({ accessToken }: VaultScreenProps) {
  const [category, setCategory] = useState<Category>('photos');
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
        setError(err instanceof Error ? err.message : 'Media history is unavailable.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMessages();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const content = loading ? 'Checking the connected media history…' : error ? error : messageCount !== null && messageCount > 0
    ? `${messageCount} message record(s) are available from the server, but no media items are exposed by the existing backend endpoints yet.`
    : 'No shared media items are available yet from the server.';

  return (
    <main className="app-page library-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">Shared library</p>
          <h1 className="page-title">Everything<br />you shared.</h1>
          <p className="page-intro">Media and voice items will appear here once the server exposes them.</p>
        </div>
        <button className="icon-button" aria-label="Search your library"><Icon name="search" size={19} /></button>
      </header>
      <div className="library-tabs" role="tablist" aria-label="Shared media type">
        {([{ id: 'photos', label: 'Photos' }, { id: 'documents', label: 'Documents' }, { id: 'audio', label: 'Voice notes' }] as const).map((item) => (
          <button key={item.id} role="tab" aria-selected={category === item.id} className={category === item.id ? 'is-active' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>
        ))}
      </div>
      <section className="library-empty">
        <div>
          {category === 'documents' ? <Icon name="file" size={28} /> : <Icon name="mic" size={28} />}
          <p>{content}</p>
        </div>
      </section>
    </main>
  );
}
