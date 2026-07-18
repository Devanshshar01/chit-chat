import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import { login } from '../api/client';
import { generateAndStoreIdentity, hasStoredIdentity } from '../crypto/identity';
import { uploadKeyBundle } from '../api/client';

interface Props {
  onLoggedIn: (username: string, accessToken: string) => void;
}

export default function LoginScreen({ onLoggedIn }: Props) {
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const tokens = await login(username.trim().toLowerCase(), passcode, 'phone');

      // first login on this device: generate + publish identity keys.
      // Not yet run against a real device - see README caveat.
      const alreadyHasIdentity = await hasStoredIdentity();
      if (!alreadyHasIdentity) {
        const bundle = await generateAndStoreIdentity();
        await uploadKeyBundle(tokens.access_token, bundle);
      }

      onLoggedIn(username.trim().toLowerCase(), tokens.access_token);
    } catch (e: any) {
      setError(e?.message ?? 'login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>unnamed-chat</Text>

      <TextInput
        style={styles.input}
        placeholder="username"
        placeholderTextColor="#666"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="passcode"
        placeholderTextColor="#666"
        secureTextEntry
        value={passcode}
        onChangeText={setPasscode}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0b0b0f' },
  title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 32, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 14,
    marginBottom: 12, color: '#fff', backgroundColor: '#151519',
  },
  button: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#f87171', marginBottom: 12, textAlign: 'center' },
});
