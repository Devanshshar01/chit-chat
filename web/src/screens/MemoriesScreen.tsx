import { useState } from 'react';

type MemoryType = 'all' | 'quote' | 'milestone';
interface Memory { id: string; type: Exclude<MemoryType, 'all'>; title: string; content: string; date: string; }

const memories: Memory[] = [
  { id: 'first', type: 'milestone', title: 'The first conversation', content: 'The beginning of this shared thread.', date: 'July 21, 2026' },
  { id: 'quote', type: 'quote', title: 'A note from Swarnima', content: '“You are my favorite notification every single day.”', date: 'Yesterday' },
  { id: 'night', type: 'quote', title: 'A late-night thought', content: '“Glad we have this small place that belongs exclusively to us.”', date: 'July 19, 2026' },
  { id: 'coffee', type: 'milestone', title: 'Coffee after rain', content: 'Pinned from a photo shared on a quiet Saturday.', date: 'July 18, 2026' },
];

export function MemoriesScreen() {
  const [filter, setFilter] = useState<MemoryType>('all');
  const visible = filter === 'all' ? memories : memories.filter((memory) => memory.type === filter);
  return <main className="app-page memory-page">
    <header className="memory-header">
      <div><p className="eyebrow">Shared archive</p><h1 className="page-title">Things worth<br />returning to.</h1><p className="page-intro">A small, intentional record of what the two of you chose to keep.</p></div>
      <div className="memory-filter" aria-label="Filter memories">
        {([{ id: 'all', label: 'Everything' }, { id: 'quote', label: 'Notes' }, { id: 'milestone', label: 'Moments' }] as const).map((item) => <button key={item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
    </header>

    {filter !== 'milestone' && <section className="memory-feature"><blockquote>“The ordinary things get to matter here.”</blockquote><p>Kept from a message on July 20</p></section>}
    <section className="memory-timeline" aria-label="Saved memories">
      {visible.map((memory) => <article className={`memory-entry ${memory.type === 'quote' ? 'memory-entry--quote' : ''}`} key={memory.id}>
        <div className="memory-entry__line" aria-hidden="true" />
        <div><time>{memory.date}</time><h2>{memory.title}</h2><p>{memory.content}</p></div>
      </article>)}
    </section>
  </main>;
}
