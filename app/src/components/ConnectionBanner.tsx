/**
 * Slim banner under the header while the WebSocket is down. Messages
 * typed while it's visible are queued by the outbox and flush on
 * reconnect - the banner is honest about state, not a blocker.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

interface Props {
  connected: boolean;
}

export default function ConnectionBanner({ connected }: Props) {
  const { colors, fontFactor } = useTheme();
  if (connected) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.danger }]}>
      <Text style={[styles.text, { fontSize: 12 * fontFactor }]}>
        Offline - reconnecting… messages will send automatically
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 4, paddingHorizontal: 12, alignItems: 'center' },
  text: { color: '#fff', fontWeight: '600' },
});
