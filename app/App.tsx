/**
 * @format
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { logout as apiLogout, type TokenPair } from './src/api/client';
import {
  loadSession, saveSession, clearSession, refreshSession, type StoredSession,
} from './src/auth/session';
import { startPushNotifications, stopPushNotifications } from './src/notifications/push';
import { log } from './src/logging/logger';

// Only two accounts exist (see backend/app/seed.py) - the peer is just
// "whichever of the two you didn't log in as." No contact list needed
// yet; that's not a real requirement until there's a third user.
const OTHER_USER: Record<string, string> = {
  devansh: 'swarnima',
  swarnima: 'devansh',
};

type Screen = 'chat' | 'settings';

function Root() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [screen, setScreen] = useState<Screen>('chat');
  const pushCleanupRef = useRef<(() => void) | null>(null);
  const { colors, isDark } = useTheme();

  // Crash/restart recovery: restore the stored session and proactively
  // refresh it (which also validates it) so the user lands straight back
  // in the chat with a token that's good for a while.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadSession();
        if (!stored) return;
        try {
          const refreshed = await refreshSession(stored);
          if (!cancelled) setSession(refreshed);
        } catch (error) {
          // refresh token expired/revoked - back to login, cleanly
          log.warn('app', 'stored session no longer valid', {
            error: error instanceof Error ? error.message : String(error),
          });
          await clearSession();
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Push notification lifecycle follows the session: register after
  // login/restore, clean up listeners when the session ends.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const cleanup = await startPushNotifications({
          accessToken: session.accessToken,
          // single-conversation app: any notification opens the one chat
          onOpenConversation: () => setScreen('chat'),
        });
        if (cancelled) cleanup();
        else pushCleanupRef.current = cleanup;
      } catch (error) {
        // push failing to start must never block the app itself
        log.error('app', 'push notification startup failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return () => {
      cancelled = true;
      pushCleanupRef.current?.();
      pushCleanupRef.current = null;
    };
  }, [session]);

  const handleLoggedIn = useCallback(async (username: string, tokens: TokenPair) => {
    const next: StoredSession = {
      username,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    };
    await saveSession(next);
    setSession(next);
    setScreen('chat');
  }, []);

  const handleLogout = useCallback(async () => {
    if (!session) return;
    // best effort, in order: drop the push token, revoke the refresh
    // token, then clear local state - local logout always succeeds even
    // if the network calls don't.
    try {
      await stopPushNotifications(session.accessToken);
    } catch (error) {
      log.warn('app', 'push unregister on logout failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      await apiLogout(session.accessToken, session.refreshToken);
    } catch (error) {
      log.warn('app', 'server-side logout failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await clearSession();
    setSession(null);
    setScreen('chat');
  }, [session]);

  if (restoring) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {!session ? (
        <LoginScreen onLoggedIn={handleLoggedIn} />
      ) : screen === 'settings' ? (
        <SettingsScreen
          username={session.username}
          onBack={() => setScreen('chat')}
          onLogout={handleLogout}
        />
      ) : (
        <ChatScreen
          peerUsername={OTHER_USER[session.username]}
          accessToken={session.accessToken}
          onOpenSettings={() => setScreen('settings')}
        />
      )}
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default App;
