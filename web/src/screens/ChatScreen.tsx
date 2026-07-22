import { useEffect, useRef, useState } from 'react';
import { ChatBubble, type MediaItem, type ReactionItem } from '../components/ChatBubble';
import { Icon } from '../components/Icon';
import { MessageComposer } from '../components/MessageComposer';

interface Message {
  id: string; text: string; timestamp: string; isSent: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: ReactionItem[]; replyTo?: { id?: string; sender: string; text: string };
  isVoiceNote?: boolean; voiceDuration?: string; media?: MediaItem[]; isNew?: boolean;
}

interface ChatScreenProps { currentUser: string; onOpenProfile: () => void; onToggleTheme: () => void; theme: 'light' | 'dark'; }

const sharedPhotos = [
  'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80',
];

export function ChatScreen({ currentUser, onOpenProfile, onToggleTheme, theme }: ChatScreenProps) {
  const partnerName = currentUser.toLowerCase() === 'devansh' ? 'Swarnima' : 'Devansh';
  const stream = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [replying, setReplying] = useState<Message | null>(null);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);
  const [scrolledUp, setScrolledUp] = useState(false);
  const [newMessages, setNewMessages] = useState(0);
  const [highlighted, setHighlighted] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMessages([
        { id: '1', text: 'I saved that place from last weekend. It still feels a little unreal.', timestamp: '10:42 AM', isSent: false, status: 'read' },
        { id: '2', text: 'The light was doing most of the work.', timestamp: '10:43 AM', isSent: true, status: 'read', reactions: [{ emoji: '♡', count: 1 }] },
        { id: '3', text: '', timestamp: '10:44 AM', isSent: false, status: 'read', isVoiceNote: true, voiceDuration: '0:42' },
        { id: '4', text: 'One of the photos turned out better than I expected.', timestamp: '10:46 AM', isSent: false, status: 'read', media: [{ type: 'image', url: sharedPhotos[0], thumbnail: sharedPhotos[0] }] },
        { id: '5', text: 'We should print it for the kitchen.', timestamp: '10:48 AM', isSent: true, status: 'read', replyTo: { id: '4', sender: partnerName, text: 'One of the photos turned out better than I expected.' } },
        { id: '6', text: 'That is exactly where it belongs.', timestamp: '10:49 AM', isSent: false, status: 'read' },
      ]);
      setLoading(false);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [partnerName]);

  const results = query ? messages.filter((message) => message.text.toLowerCase().includes(query.toLowerCase())) : [];
  const jumpTo = (id: string) => { document.getElementById(`bubble-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlighted(id); window.setTimeout(() => setHighlighted(null), 1300); };
  const jumpToLatest = () => { if (stream.current) stream.current.scrollTop = stream.current.scrollHeight; setScrolledUp(false); setNewMessages(0); };
  const send = (text: string) => {
    const message: Message = { id: String(Date.now()), text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isSent: true, status: 'sending', isNew: true, replyTo: replying ? { id: replying.id, sender: replying.isSent ? 'You' : partnerName, text: replying.text || 'Voice note' } : undefined };
    setMessages((current) => [...current, message]); setReplying(null); window.requestAnimationFrame(jumpToLatest);
    window.setTimeout(() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, status: 'delivered', isNew: false } : item)), 600);
  };
  const addReaction = (id: string, emoji: string) => setMessages((current) => current.map((message) => {
    if (message.id !== id) return message;
    const currentReactions = message.reactions ?? [];
    const same = currentReactions.find((reaction) => reaction.emoji === emoji);
    return { ...message, reactions: same ? currentReactions.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: Math.min(2, reaction.count + 1) } : reaction) : [...currentReactions, { emoji, count: 1 }] };
  }));

  return <main className="chat-page">
    <section className="chat-main">
      {searching ? <div className="chat-search"><button className="icon-button" onClick={() => { setSearching(false); setQuery(''); }} aria-label="Close search"><Icon name="arrow-left" size={19} /></button><Icon name="search" size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this conversation" /><small>{query ? `${results.length} found` : ''}</small>{results[0] && <button className="icon-button" onClick={() => jumpTo(results[0].id)} aria-label="Go to result"><Icon name="chevron-down" size={18} /></button>}</div> : <><header className="chat-header"><div className="chat-identity"><button onClick={onOpenProfile}><span className="presence-avatar">{partnerName.slice(0, 1)}</span><span><b>{partnerName}</b><small>Here with you</small></span></button></div><div className="chat-tools"><button className="icon-button" onClick={() => setSearching(true)} aria-label="Search conversation"><Icon name="search" size={19} /></button><button className="icon-button" onClick={onToggleTheme} aria-label="Change appearance"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button><button className="icon-button" onClick={onOpenProfile} aria-label="Open conversation settings"><Icon name="more" size={20} /></button></div></header><div className="chat-private-note"><span><Icon name="lock" size={11} />Only you and {partnerName} can read what is said here.</span></div></>}
      <div className="chat-stream" ref={stream} onScroll={(event) => { const element = event.currentTarget; const away = element.scrollHeight - element.scrollTop - element.clientHeight > 140; setScrolledUp(away); if (!away) setNewMessages(0); }}>
        {loading ? <div className="chat-loading" aria-label="Loading conversation"><i /><i /><i /><i /></div> : <><div className="date-stamp">Today</div>{messages.map((message, index) => <ChatBubble key={message.id} {...message} prevSameSender={messages[index - 1]?.isSent === message.isSent} searchQuery={query} highlighted={highlighted === message.id} onOpenContextMenu={(id) => setMenuMessage(messages.find((item) => item.id === id) ?? null)} onReactionAdd={addReaction} onScrollToOriginal={jumpTo} onSwipeReply={(id) => setReplying(messages.find((item) => item.id === id) ?? null)} onRetry={(id) => setMessages((current) => current.map((item) => item.id === id ? { ...item, status: 'delivered' } : item))} onMediaClick={setLightbox} />)}</>}
      </div>
      {scrolledUp && (newMessages ? <button className="chat-unread" onClick={jumpToLatest}>{newMessages} new</button> : <button className="chat-jump" onClick={jumpToLatest} aria-label="Jump to latest"><Icon name="chevron-down" size={18} /></button>)}
      <MessageComposer onSendMessage={send} replyPreview={replying ? { id: replying.id, sender: replying.isSent ? 'You' : partnerName, text: replying.text || 'Voice note' } : null} onCancelReply={() => setReplying(null)} />
    </section>
    <aside className="chat-inspector"><h2>Shared in this thread</h2><p>A living shelf of the things you send each other.</p><div className="inspector-media">{sharedPhotos.map((photo) => <img key={photo} src={photo} alt="" />)}</div><div className="inspector-list"><div><small>KEPT CLOSE</small><b>3 saved notes</b></div><div><small>LAST SHARED</small><b>Photo · 10:46 AM</b></div><div><small>SECURITY</small><b>Identity verified</b></div></div></aside>
    {menuMessage && <div className="chat-menu-backdrop" onClick={() => setMenuMessage(null)}><div className="chat-menu" onClick={(event) => event.stopPropagation()}><div className="chat-menu__reactions">{['♡', '!', '✦', '☺', '…'].map((emoji) => <button key={emoji} onClick={() => { addReaction(menuMessage.id, emoji); setMenuMessage(null); }} aria-label={`React ${emoji}`}>{emoji}</button>)}</div><button onClick={() => { setReplying(menuMessage); setMenuMessage(null); }}>Reply</button><button onClick={() => setMenuMessage(null)}>Copy message</button><button onClick={() => setMenuMessage(null)}>Keep in memories</button><button className="danger" onClick={() => { setMessages((current) => current.filter((message) => message.id !== menuMessage.id)); setMenuMessage(null); }}>Delete for me</button></div></div>}
    {lightbox && <div className="lightbox"><header className="lightbox__bar"><button onClick={() => setLightbox(null)} aria-label="Close media"><Icon name="close" size={21} /></button><div className="lightbox-actions"><button><Icon name="bookmark" size={16} />Keep</button><button><Icon name="download" size={16} />Save</button></div></header><div className="lightbox__content">{lightbox.type === 'image' ? <img src={lightbox.url} alt="Shared in this conversation" /> : <Icon name="file" size={48} />}</div></div>}
  </main>;
}
