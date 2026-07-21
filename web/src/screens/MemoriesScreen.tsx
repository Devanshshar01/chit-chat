import React, { useState } from 'react';

interface MemoryItem {
  id: string;
  type: 'quote' | 'milestone' | 'voicenote';
  title: string;
  content: string;
  date: string;
  author: string;
}

export const MemoriesScreen: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'quote' | 'milestone'>('all');

  const memories: MemoryItem[] = [
    {
      id: '1',
      type: 'milestone',
      title: 'Our First Conversation',
      content: 'The day we started using our private E2EE channel.',
      date: 'July 21, 2026',
      author: 'System',
    },
    {
      id: '2',
      type: 'quote',
      title: 'Favorite Quote',
      content: '"You are my favorite notification every single day."',
      date: 'Yesterday',
      author: 'Swarnima',
    },
    {
      id: '3',
      type: 'quote',
      title: 'Late Night Thought',
      content: '"Glad we have this space that belongs exclusively to us."',
      date: '2 days ago',
      author: 'Devansh',
    },
  ];

  const filteredMemories =
    filter === 'all' ? memories : memories.filter((m) => m.type === filter);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        overflowY: 'auto',
        padding: '20px 16px 80px 16px',
      }}
    >
      {/* Screen Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.75rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 4px 0',
          }}
        >
          Memories & Moments
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Your shared history, quotes, and relationship milestones
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'quote', label: 'Saved Quotes' },
          { id: 'milestone', label: 'Milestones' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: filter === f.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: filter === f.id ? 'var(--text-inverse)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredMemories.map((m) => (
          <div
            key={m.id}
            style={{
              backgroundColor: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {m.type === 'milestone' ? '🎉 Milestone' : '💬 Saved Quote'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{m.date}</span>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {m.title}
            </h3>

            <p
              style={{
                fontFamily: m.type === 'quote' ? 'var(--font-serif)' : 'var(--font-sans)',
                fontStyle: m.type === 'quote' ? 'italic' : 'normal',
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                lineHeight: '1.5',
                marginBottom: '12px',
              }}
            >
              {m.content}
            </p>

            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'right' }}>
              — {m.author}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
