/**
 * Settings: theme (light/dark/system), font size, notification mute,
 * and logout. Every choice persists in the local settings table and is
 * applied live through the theme context.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeContext';
import { notificationsMuted, setNotificationsMuted } from '../notifications/push';
import type { FontScale, ThemeMode } from '../theme/theme';

interface Props {
  username: string;
  onBack: () => void;
  onLogout: () => Promise<void>;
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const FONT_OPTIONS: { value: FontScale; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export default function SettingsScreen({ username, onBack, onLogout }: Props) {
  const { colors, fontFactor, mode, setMode, fontScale, setFontScale } = useTheme();
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(notificationsMuted());
  const [loggingOut, setLoggingOut] = useState(false);

  const toggleMuted = () => {
    const next = !muted;
    setNotificationsMuted(next);
    setMuted(next);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  const sectionTitleStyle = [styles.sectionTitle, { color: colors.textSecondary, fontSize: 13 * fontFactor }];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.headerWrap, { borderBottomColor: colors.surfaceBorder }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={[styles.backArrow, { color: colors.accent, fontSize: 22 * fontFactor }]}>{'‹'}</Text>
        </Pressable>
        <Text style={[styles.header, { color: colors.textPrimary, fontSize: 18 * fontFactor }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={sectionTitleStyle}>SIGNED IN AS</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.value, { color: colors.textPrimary, fontSize: 16 * fontFactor }]}>{username}</Text>
        </View>

        <Text style={sectionTitleStyle}>THEME</Text>
        <SegmentedControl options={THEME_OPTIONS} selected={mode} onSelect={setMode} />

        <Text style={sectionTitleStyle}>FONT SIZE</Text>
        <SegmentedControl options={FONT_OPTIONS} selected={fontScale} onSelect={setFontScale} />

        <Text style={sectionTitleStyle}>NOTIFICATIONS</Text>
        <Pressable
          style={[styles.card, styles.row, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
          onPress={toggleMuted}
        >
          <Text style={[styles.value, { color: colors.textPrimary, fontSize: 16 * fontFactor }]}>Mute notifications</Text>
          <View style={[styles.toggle, { backgroundColor: muted ? colors.accent : colors.surfaceBorder }]}>
            <View style={[styles.toggleKnob, muted ? styles.toggleKnobOn : null]} />
          </View>
        </Pressable>

        <Pressable
          style={[styles.logoutButton, { backgroundColor: colors.danger }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut
            ? <ActivityIndicator color="#fff" />
            : <Text style={[styles.logoutText, { fontSize: 16 * fontFactor }]}>Log out</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}

function SegmentedControl<T extends string>({ options, selected, onSelect }: SegmentedProps<T>) {
  const { colors, fontFactor } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
      {options.map((option) => {
        const active = option.value === selected;
        const textColor = active ? '#fff' : colors.textPrimary;
        return (
          <Pressable
            key={option.value}
            style={[styles.segment, active && { backgroundColor: colors.accent }]}
            onPress={() => onSelect(option.value)}
          >
            <Text style={[styles.segmentText, { color: textColor, fontSize: 14 * fontFactor }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backArrow: { fontWeight: '700' },
  header: { fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48 },
  sectionTitle: { fontWeight: '700', marginTop: 20, marginBottom: 8, letterSpacing: 0.5 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { fontWeight: '500' },
  segmented: {
    flexDirection: 'row', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  segment: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  segmentText: { fontWeight: '600' },
  toggle: { width: 46, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleKnobOn: { alignSelf: 'flex-end' },
  logoutButton: { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 32 },
  logoutText: { color: '#fff', fontWeight: '700' },
});
