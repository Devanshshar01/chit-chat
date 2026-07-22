export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`} aria-label="Chit-Chat">
      <svg viewBox="0 0 40 40" role="img" aria-hidden="true">
        <path d="M8 12.5C8 7.8 11.8 4 16.5 4c4.1 0 7.5 2.7 8.3 6.5" />
        <path d="M32 27.5c0 4.7-3.8 8.5-8.5 8.5-4.1 0-7.5-2.7-8.3-6.5" />
        <path d="M32 12.5C32 7.8 28.2 4 23.5 4c-4.1 0-7.5 2.7-8.3 6.5" />
        <path d="M8 27.5C8 32.2 11.8 36 16.5 36c4.1 0 7.5-2.7 8.3-6.5" />
        <circle cx="20" cy="20" r="2.5" />
      </svg>
    </div>
  );
}
