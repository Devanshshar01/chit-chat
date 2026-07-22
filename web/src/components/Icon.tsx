import type { SVGProps } from 'react';

type IconName =
  | 'arrow-left' | 'chevron-down' | 'chevron-left' | 'chevron-right'
  | 'close' | 'copy' | 'image' | 'mic' | 'more' | 'paperclip' | 'play'
  | 'plus' | 'reply' | 'search' | 'send' | 'smile' | 'sparkle' | 'check'
  | 'trash' | 'download' | 'home' | 'message' | 'archive' | 'bookmark'
  | 'settings' | 'lock' | 'eye' | 'eye-off' | 'bell' | 'monitor'
  | 'arrow-up-right' | 'file' | 'clock' | 'moon' | 'sun' | 'menu'
  | 'link' | 'grid' | 'user' | 'shield' | 'camera';

const paths: Record<IconName, React.ReactNode> = {
  'arrow-left': <path d="M19 12H5m6 6-6-6 6-6" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-left': <path d="m15 18-6-6 6-6" />,
  'chevron-right': <path d="m9 18 6-6-6-6" />,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-4-4L5 20" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  paperclip: <path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.1-9.1a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5" />,
  play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
  plus: <path d="M12 5v14M5 12h14" />,
  reply: <path d="m9 17-5-5 5-5M4 12h9a7 7 0 0 1 7 7" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></>,
  send: <path d="m21 3-7.5 18-3.9-7.6L3 9.5 21 3Z" />,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.3 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>,
  sparkle: <path d="m12 3 .9 5.1L18 9l-5.1.9L12 15l-.9-5.1L6 9l5.1-.9L12 3Zm6 12 .45 2.55L21 18l-2.55.45L18 21l-.45-2.55L15 18l2.55-.45L18 15Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  trash: <><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" /></>,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" /><path d="M9 21v-7h6v7" /></>,
  message: <path d="M20 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v8Z" />,
  archive: <><path d="M3 6h18v14H3z" /><path d="M3 10h18M9 14h6" /><path d="m5 3 1-1h12l1 1" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5.3v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1A1.7 1.7 0 0 0 19 10a1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.1 1Z" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  'eye-off': <><path d="m3 3 18 18M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 3.9M6.2 6.2C3.7 8.1 2 12 2 12s3.5 7 10 7a10.6 10.6 0 0 0 3.4-.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  'arrow-up-right': <><path d="M7 17 17 7M8 7h9v9" /></>,
  file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 13h6M9 17h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  link: <><path d="M10 13a5 5 0 0 0 7.1.1l2.8-2.8A5 5 0 0 0 12.8 3L11.2 4.6" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2.8 2.8A5 5 0 1 0 11.2 21l1.6-1.6" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  shield: <path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-3Z" />,
  camera: <><path d="M4 7h4l1.5-2h5L16 7h4v13H4z" /><circle cx="12" cy="13" r="3.5" /></>,
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
