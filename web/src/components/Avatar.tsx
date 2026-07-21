import React from 'react';

interface AvatarProps {
  size?: 'sm' | 'md' | 'lg';
  src?: string;
  name: string;
  showPresence?: boolean;
  isOnline?: boolean;
  onClick?: () => void;
}

export const Avatar: React.FC<AvatarProps> = ({
  size = 'md',
  src,
  name,
  showPresence = false,
  isOnline = true,
  onClick,
}) => {
  const sizeMap = {
    sm: 36,
    md: 52,
    lg: 88,
  };

  const pxSize = sizeMap[size];

  const getInitial = (n: string) => (n ? n.charAt(0).toUpperCase() : '?');

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: `${pxSize}px`,
        height: `${pxSize}px`,
        borderRadius: 'var(--radius-pill)',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 'var(--radius-pill)',
            objectFit: 'cover',
            border: '1.5px solid var(--border-subtle)',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: 'var(--accent-subtle)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: size === 'sm' ? '14px' : size === 'md' ? '20px' : '32px',
            border: '1.5px solid var(--border-subtle)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {getInitial(name)}
        </div>
      )}

      {showPresence && (
        <span
          title={isOnline ? "Together in app" : "Offline"}
          style={{
            position: 'absolute',
            bottom: size === 'sm' ? 0 : 2,
            right: size === 'sm' ? 0 : 2,
            width: size === 'sm' ? '10px' : '14px',
            height: size === 'sm' ? '10px' : '14px',
            borderRadius: '50%',
            backgroundColor: isOnline ? 'var(--semantic-success)' : 'var(--text-tertiary)',
            border: '2px solid var(--bg-primary)',
            boxShadow: isOnline ? '0 0 8px var(--semantic-success)' : 'none',
            animation: isOnline ? 'pulseGlow 2.5s infinite' : 'none',
          }}
        />
      )}
    </div>
  );
};
