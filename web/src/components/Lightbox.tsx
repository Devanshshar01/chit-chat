import { useEffect } from 'react';
import { Icon } from './Icon';
import type { MediaItem } from './ChatBubble';

interface LightboxProps {
  media: MediaItem | null;
  onClose: () => void;
  onDownload?: (media: MediaItem) => void;
}

export function Lightbox({ media, onClose, onDownload }: LightboxProps) {
  useEffect(() => {
    if (!media) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [media, onClose]);

  if (!media) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="lightbox__bar">
        <button onClick={onClose} aria-label="Close media viewer">
          <Icon name="close" size={20} />
        </button>
        <div className="lightbox-actions">
          {onDownload && (
            <button onClick={() => onDownload(media)} aria-label="Download media">
              <Icon name="download" size={18} /> Save
            </button>
          )}
        </div>
      </div>
      <div className="lightbox__content">
        {media.type === 'image' && <img src={media.url} alt={media.name || 'Shared image'} />}
        {media.type === 'video' && (
          <video src={media.url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%' }}>
            <track kind="captions" />
          </video>
        )}
        {media.type === 'document' && (
          <div style={{ textAlign: 'center', color: '#ecf2ec' }}>
            <Icon name="file" size={48} />
            <p style={{ marginTop: 12 }}>{media.name || 'Shared document'}</p>
            {media.size && <small>{media.size}</small>}
          </div>
        )}
      </div>
    </div>
  );
}
