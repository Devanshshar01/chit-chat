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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Apply theme data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
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

  const handleLogout = () => {
    setSession(null);
    setPendingSession(null);
    setAuthStep('welcome');
    setShowProfile(false);
  };

  // 1. Welcome Screen
  if (authStep === 'welcome') {
    return <WelcomeScreen onStartLogin={() => setAuthStep('login')} />;
  }

  // 2. Login Screen
  if (authStep === 'login') {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onBack={() => setAuthStep('welcome')}
      />
    );
  }

  // 3. Cryptographic Loading Transition
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

  // 4. First-Time Device Setup
  if (authStep === 'setup') {
    return <DeviceSetupScreen onCompleteSetup={handleCompleteSetup} />;
  }

  // 5. Main Application Shell
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
      {/* Active Screen Area */}
      <div className="app-content">
        {activeTab === 'home' && (
          <HomeScreen
            currentUser={session.username}
            onOpenChat={() => setActiveTab('chat')}
            onOpenProfile={() => setShowProfile(true)}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'chat' && (
          <ChatScreen
            currentUser={session.username}
            onOpenProfile={() => setShowProfile(true)}
            onToggleTheme={toggleTheme}
            theme={theme}
          />
        )}

        {activeTab === 'memories' && <MemoriesScreen />}

        {activeTab === 'vault' && <VaultScreen />}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Partner & Settings Profile Overlay */}
      {showProfile && (
        <ProfileScreen
          currentUser={session.username}
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
