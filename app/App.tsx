/**
 * @format
 */
import React, { useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import ChatScreen from './src/screens/ChatScreen';

// Only two accounts exist (see backend/app/seed.py) - the peer is just
// "whichever of the two you didn't log in as." No contact list needed
// yet; that's not a real requirement until there's a third user.
const OTHER_USER: Record<string, string> = {
  devansh: 'swarnima',
  swarnima: 'devansh',
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [session, setSession] = useState<{ username: string; accessToken: string } | null>(null);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {session ? (
        <ChatScreen
          myUsername={session.username}
          peerUsername={OTHER_USER[session.username]}
          accessToken={session.accessToken}
        />
      ) : (
        <LoginScreen
          onLoggedIn={(username, accessToken) => setSession({ username, accessToken })}
        />
      )}
    </SafeAreaProvider>
  );
}

export default App;
