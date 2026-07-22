import { useEffect } from 'react';
import { Icon } from '../components/Icon';

interface LoadingScreenProps { partnerName: string; onComplete: () => void; }

export function LoadingScreen({ partnerName, onComplete }: LoadingScreenProps) {
  useEffect(() => { const timer = window.setTimeout(onComplete, 1200); return () => window.clearTimeout(timer); }, [onComplete]);
  return <main className="loading-screen"><section className="loading-content"><span className="loading-lock"><Icon name="lock" size={21} /></span><p className="eyebrow">Private channel</p><h1>Opening your<br />shared space.</h1><p>Checking the secure connection with {partnerName}.</p><div className="loading-track"><i /></div></section></main>;
}
