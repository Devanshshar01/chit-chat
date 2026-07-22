import { useState } from 'react';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';

interface DeviceSetupScreenProps { onCompleteSetup: (deviceName: string) => void; }

export function DeviceSetupScreen({ onCompleteSetup }: DeviceSetupScreenProps) {
  const [deviceName, setDeviceName] = useState('This web browser');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  return <main className="auth-shell">
    <section className="auth-intro"><div className="auth-wordmark"><BrandMark compact />chit-chat</div><div className="auth-statement"><p className="eyebrow">One last step</p><h1>Make this<br />device yours.</h1><p>Give this browser a name so it is easy to recognize later.</p></div></section>
    <section className="auth-form-panel"><h1>Set up this device</h1><p>It will be added to the private space you share.</p><form className="form-stack" onSubmit={(event) => { event.preventDefault(); onCompleteSetup(deviceName); }}><div className="field"><label htmlFor="device-name">Device name</label><input id="device-name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} /></div><label className="device-choice"><span><Icon name="bell" size={16} /></span><span><b>Keep in touch</b><small>Get an alert when a new message arrives.</small></span><input type="checkbox" checked={notificationsEnabled} onChange={(event) => setNotificationsEnabled(event.target.checked)} aria-label="Enable notifications" /></label><button className="primary-button" type="submit">Finish setup <Icon name="arrow-up-right" size={17} /></button></form></section>
  </main>;
}
