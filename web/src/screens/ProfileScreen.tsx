import { Icon } from '../components/Icon';

interface ProfileScreenProps {
  currentUser: string;
  onClose: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
}

export function ProfileScreen({ currentUser, onClose, onLogout, onToggleTheme, theme }: ProfileScreenProps) {
  const partnerName = currentUser.toLowerCase() === 'devansh' ? 'Swarnima' : 'Devansh';
  return <aside className="profile-overlay" role="dialog" aria-modal="true" aria-label="Account and privacy">
    <header className="profile-header"><button className="icon-button" onClick={onClose} aria-label="Close settings"><Icon name="close" size={19} /></button><h1>Account & privacy</h1><span style={{ width: 38 }} /></header>
    <div className="profile-content">
      <section className="profile-person"><span className="presence-avatar">{partnerName.slice(0, 1)}</span><h2>{partnerName}</h2><p>Active now · private channel connected</p></section>
      <section className="profile-block"><h3><Icon name="shield" size={16} />Identity verified</h3><p>This fingerprint helps you confirm that this private channel belongs to the two of you.</p><div className="fingerprint">4A82 9F01 B3C7 8890<br />E51A 224F 991B 73CC</div></section>
      <section className="profile-block"><h3>Preferences</h3><div className="profile-row"><span><b>Appearance</b><small>{theme === 'dark' ? 'Dark, low-light friendly' : 'Light, paper-like'}</small></span><button onClick={onToggleTheme}>{theme === 'dark' ? 'Use light' : 'Use dark'}</button></div><div className="profile-row"><span><b>Signed in as</b><small>{currentUser}</small></span><Icon name="user" size={17} aria-label="User" /></div></section>
      <button className="logout-button" onClick={onLogout}>Log out of this device</button>
    </div>
  </aside>;
}
