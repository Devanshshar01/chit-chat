import React, { useState } from 'react';

export const VaultScreen: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<'photos' | 'docs' | 'audio'>('photos');

  const photos = [
    { id: '1', title: 'Sunset Memory', date: 'July 20, 2026', color: '#3b82f6' },
    { id: '2', title: 'Coffee Date', date: 'July 18, 2026', color: '#10b981' },
    { id: '3', title: 'Weekend Getaway', date: 'July 12, 2026', color: '#f59e0b' },
    { id: '4', title: 'Evening Walk', date: 'July 05, 2026', color: '#8b5cf6' },
  ];

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
      {/* Header */}
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
          Shared Vault
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Encrypted gallery of photos, documents, and voice notes
        </p>
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { id: 'photos', label: '🖼️ Photos & Videos' },
          { id: 'docs', label: '📄 Documents' },
          { id: 'audio', label: '🎙️ Voice Clips' },
        ].map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id as any)}
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: activeCategory === c.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: activeCategory === c.id ? 'var(--text-inverse)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {activeCategory === 'photos' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          {photos.map((item) => (
            <div
              key={item.id}
              onClick={() => alert(`Opening ${item.title} in zero-distraction Lightbox`)}
              style={{
                height: '140px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: item.color,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '12px',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.title}</div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>{item.date}</div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--surface-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
          <p style={{ fontSize: '0.9rem' }}>No {activeCategory === 'docs' ? 'documents' : 'voice clips'} shared yet.</p>
        </div>
      )}
    </div>
  );
};
