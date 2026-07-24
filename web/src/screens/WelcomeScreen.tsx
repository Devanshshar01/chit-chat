import { useRef } from 'react';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { VariableProximity } from '../components/VariableProximity';
import { SoftAurora } from '../components/SoftAurora';
import { Galaxy } from '../components/Galaxy';

interface WelcomeScreenProps { onStartLogin: () => void; }

export function WelcomeScreen({ onStartLogin }: WelcomeScreenProps) {
  const statementRef = useRef<HTMLDivElement>(null);
  return <main className="auth-shell auth-shell--welcome"><div className="landing-galaxy"><Galaxy density={0.65} glowIntensity={0.18} saturation={0.35} hueShift={132} starSpeed={0.32} speed={0.55} twinkleIntensity={0.2} rotationSpeed={0.035} repulsionStrength={1.4} /></div>
    <section className="auth-container">
      <header className="auth-intro"><div className="auth-wordmark"><BrandMark compact />chit-chat</div></header>
      <div className="auth-statement" ref={statementRef}><p className="eyebrow">A private correspondence</p><h1><span className="auth-title-line"><VariableProximity label="For the things" containerRef={statementRef} fromFontVariationSettings="'wght' 400, 'opsz' 12" toFontVariationSettings="'wght' 800, 'opsz' 72" radius={170} falloff="gaussian" /></span><span className="auth-title-line"><VariableProximity label="you only say" containerRef={statementRef} fromFontVariationSettings="'wght' 400, 'opsz' 12" toFontVariationSettings="'wght' 800, 'opsz' 72" radius={170} falloff="gaussian" /></span><span className="auth-title-line"><VariableProximity label="to each other." containerRef={statementRef} fromFontVariationSettings="'wght' 400, 'opsz' 12" toFontVariationSettings="'wght' 800, 'opsz' 72" radius={170} falloff="gaussian" /></span></h1><p>A quieter place for one shared conversation, made to stay private.</p></div>
      <footer className="auth-footer"><button className="primary-button" onClick={onStartLogin}>Enter your space <Icon name="arrow-up-right" size={17} /></button><p className="auth-assurance"><Icon name="lock" size={13} />Private two-person space</p></footer>
    </section>
    <aside className="auth-aside" aria-hidden="true"><SoftAurora speed={0.32} scale={1.35} brightness={0.72} color1="#a8d0b7" color2="#315f50" noiseFrequency={2.1} bandHeight={0.52} bandSpread={1.25} colorSpeed={0.7} mouseInfluence={0.18} /><div className="auth-aside__line" /><p>Two people.<br /><em>One ongoing record.</em></p></aside>
  </main>;
}
