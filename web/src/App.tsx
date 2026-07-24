import { useState, useEffect } from 'react';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { DeviceSetupScreen } from './screens/DeviceSetupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ChatScreen } from './screens/ChatScreen';
import { MemoriesScreen } from './screens/MemoriesScreen';
import { VaultScreen } from './screens/VaultScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { BottomNav, type TabType } from './components/BottomNav';
import { DesktopNavigation } from './components/DesktopNavigation';
import { wsService } from './services/websocket';

interface UserSession {
  username: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  deviceName?: string;
}

type AuthStep = 'welcome' | 'login' | 'loading' | 'setup' | 'authenticated';

export function App() {
  const [authStep, setAuthStep] = useState<AuthStep>('welcome');
  const [pendingSession, setPendingSession] = useState<UserSession | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showProfile, setShowProfile] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('chit_chat_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chit_chat_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLoginSuccess = (
    username: string,
    tokens: { access_token: string; refresh_token: string; token_type: string }
  ) => {
    setPendingSession({
      username,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
    });
    setAuthStep('loading');
  };

  const handleLoadingComplete = () => {
    setAuthStep('setup');
  };

  const handleCompleteSetup = (deviceName: string) => {
    if (pendingSession) {
      setSession({
        ...pendingSession,
        deviceName,
      });
      setAuthStep('authenticated');
      setActiveTab('home');
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      wsService.connect(session.accessToken);
    }
  }, [session?.accessToken]);

  const handleLogout = () => {
    wsService.disconnect();
    setSession(null);
    setPendingSession(null);
    setAuthStep('welcome');
    setShowProfile(false);
  };

  if (authStep === 'welcome') {
    return <WelcomeScreen onStartLogin={() => setAuthStep('login')} />;
  }

  if (authStep === 'login') {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onBack={() => setAuthStep('welcome')}
      />
    );
  }

  if (authStep === 'loading' && pendingSession) {
    return (
      <LoadingScreen
        partnerName={
          pendingSession.username.toLowerCase() === 'devansh' ? 'Swarnima' : 'Devansh'
        }
        onComplete={handleLoadingComplete}
      />
    );
  }

  if (authStep === 'setup') {
    return <DeviceSetupScreen onCompleteSetup={handleCompleteSetup} />;
  }

  if (!session) {
    return <WelcomeScreen onStartLogin={() => setAuthStep('login')} />;
  }

  return (
    <div className="app-shell">
      <DesktopNavigation
        activeTab={activeTab}
        currentUser={session.username}
        onTabChange={setActiveTab}
        onOpenProfile={() => setShowProfile(true)}
      />
      <div className="app-content">
        {activeTab === 'home' && (
          <HomeScreen
            currentUser={session.username}
            accessToken={session.accessToken}
            onOpenChat={() => setActiveTab('chat')}
            onOpenProfile={() => setShowProfile(true)}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'chat' && (
          <ChatScreen
            currentUser={session.username}
            accessToken={session.accessToken}
            onOpenProfile={() => setShowProfile(true)}
            onToggleTheme={toggleTheme}
            theme={theme}
          />
        )}

        {activeTab === 'memories' && <MemoriesScreen accessToken={session.accessToken} />}

        {activeTab === 'vault' && <VaultScreen accessToken={session.accessToken} />}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {showProfile && (
        <ProfileScreen
          currentUser={session.username}
          accessToken={session.accessToken}
          onClose={() => setShowProfile(false)}
          onLogout={handleLogout}
          onToggleTheme={toggleTheme}
          theme={theme}
        />
      )}
    </div>
  );
}

export default App;
