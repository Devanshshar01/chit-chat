import { Icon } from '../components/Icon';

interface HomeScreenProps {
  currentUser: string;
  onOpenChat: () => void;
  onOpenProfile: () => void;
  onNavigateTab: (tab: 'memories' | 'vault') => void;
}

const memories = [
  { title: 'After the rain', image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=700&q=85' },
  { title: 'Saturday table', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=85' },
  { title: 'Long way home', image: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=700&q=85' },
];

export function HomeScreen({ currentUser, onOpenChat, onOpenProfile, onNavigateTab }: HomeScreenProps) {
  const partnerName = currentUser.toLowerCase() === 'devansh' ? 'Swarnima' : 'Devansh';
  return <main className="app-page home-page">
    <header className="page-topline">
      <button className="home-greeting" onClick={onOpenProfile} aria-label={`Open ${partnerName}'s profile`}>
        <span className="presence-avatar">{partnerName.slice(0, 1)}</span>
        <span><small>private space for two</small><b>{partnerName} + {currentUser}</b></span>
      </button>
      <button className="icon-button" onClick={onOpenProfile} aria-label="Open settings"><Icon name="settings" size={19} /></button>
    </header>

    <section className="home-hero" aria-labelledby="home-quote">
      <div>
        <p className="eyebrow">A note from last night</p>
        <blockquote id="home-quote" className="home-quote">“I like that this is where the ordinary things get to matter.”</blockquote>
        <p className="home-quote-author">From {partnerName}, 11:15 PM</p>
      </div>
      <button className="primary-button home-open-chat" onClick={onOpenChat}><Icon name="message" size={17} />Open conversation</button>
    </section>

    <div className="home-dashboard">
      <section>
        <div className="home-section-heading"><h2>Recently kept</h2><button className="text-button" onClick={() => onNavigateTab('memories')}>See all</button></div>
        <div className="memory-ribbon">
          {memories.map((memory) => <button className="memory-tile" key={memory.title} onClick={() => onNavigateTab('vault')}><img src={memory.image} alt="" /><span>{memory.title}</span></button>)}
        </div>
      </section>

      <section>
        <div className="home-section-heading"><h2>Right now</h2><span>Live</span></div>
        <div className="partner-status"><i aria-hidden="true" /><p><b>{partnerName} is here</b><br /><small>Both of you are in the app</small></p><Icon name="shield" size={17} aria-label="Encrypted" /></div>
      </section>

      <section>
        <div className="home-section-heading"><h2>Since you last looked</h2></div>
        <div className="activity-list">
          <div className="activity-row"><span><Icon name="mic" size={14} /></span><div><b>Voice note saved</b><small>0:42 from {partnerName}</small></div></div>
          <div className="activity-row"><span><Icon name="bookmark" size={14} /></span><div><b>One message was kept close</b><small>Yesterday evening</small></div></div>
        </div>
      </section>
    </div>
  </main>;
}
