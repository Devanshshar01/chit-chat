import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

import { login, type TokenPair } from '../api/client';
import { generateAndStoreIdentity, hasStoredIdentity } from '../crypto/identity';
import { uploadKeyBundle } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/theme';

interface Props {
  onLoggedIn: (username: string, tokens: TokenPair) => void;
}

export default function LoginScreen({ onLoggedIn }: Props) {
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { colors, fontFactor } = useTheme();
  const styles = useMemo(() => createStyles(colors, fontFactor), [colors, fontFactor]);

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

      onLoggedIn(username.trim().toLowerCase(), tokens);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'login failed');
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
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="passcode"
        placeholderTextColor={colors.textSecondary}
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

function createStyles(colors: ThemeColors, fontFactor: number) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    title: {
      fontSize: 28 * fontFactor, fontWeight: '700', color: colors.textPrimary,
      marginBottom: 32, textAlign: 'center',
    },
    input: {
      borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 10, padding: 14,
      marginBottom: 12, color: colors.textPrimary, backgroundColor: colors.surface,
      fontSize: 15 * fontFactor,
    },
    button: { backgroundColor: colors.accent, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
    buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 * fontFactor },
    error: { color: colors.danger, marginBottom: 12, textAlign: 'center', fontSize: 14 * fontFactor },
  });
}
