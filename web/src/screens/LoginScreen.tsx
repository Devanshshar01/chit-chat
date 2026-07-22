import { useState } from 'react';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { API_BASE_URL } from '../config';

const DEFAULT_DEVICE_NAME = 'web-browser';
interface LoginScreenProps { onLoginSuccess: (username: string, tokens: { access_token: string; refresh_token: string; token_type: string }) => void; onBack?: () => void; }

export function LoginScreen({ onLoginSuccess, onBack }: LoginScreenProps) {
  const [username, setUsername] = useState('devansh');
  const [passcode, setPasscode] = useState('DEVANSH');
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || !username.trim() || !passcode.trim()) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim(), passcode, device_name: DEFAULT_DEVICE_NAME }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) { setError(typeof payload?.detail === 'string' ? payload.detail : 'We could not open your space. Check your details and try again.'); return; }
      onLoginSuccess(username.trim(), { access_token: payload.access_token, refresh_token: payload.refresh_token, token_type: payload.token_type || 'bearer' });
    } catch { setError('We could not reach the service. Check your connection and try again.'); } finally { setLoading(false); }
  };
  return <main className="auth-shell">
    <section className="auth-intro"><div className="auth-wordmark"><BrandMark compact />chit-chat</div><div className="auth-statement"><p className="eyebrow">Welcome back</p><h1>Your shared<br />space is still<br />right here.</h1></div></section>
    <section className="auth-form-panel"><button className="auth-back" onClick={onBack} aria-label="Back to welcome"><Icon name="arrow-left" size={15} />Back</button><h1>Sign in</h1><p>Use the details for this private space.</p><form className="form-stack" onSubmit={submit}><div className="field"><label htmlFor="username-input">Username</label><input id="username-input" value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" autoComplete="username" disabled={loading} /></div><div className="field"><label htmlFor="passcode-input">Passcode</label><div className="password-field"><input id="passcode-input" type={showPasscode ? 'text' : 'password'} value={passcode} onChange={(event) => setPasscode(event.target.value)} autoComplete="current-password" disabled={loading} /><button className="icon-button" type="button" onClick={() => setShowPasscode(!showPasscode)} aria-label={showPasscode ? 'Hide passcode' : 'Show passcode'}><Icon name={showPasscode ? 'eye-off' : 'eye'} size={18} /></button></div></div>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button" type="submit" disabled={loading || !username.trim() || !passcode.trim()}>{loading ? 'Opening your space…' : 'Continue'}</button></form></section>
  </main>;
}
