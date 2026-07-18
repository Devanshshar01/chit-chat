/**
 * Top-level React error boundary: a render-time crash anywhere in the
 * tree shows a recoverable "something went wrong" screen instead of a
 * white screen / hard crash. "Try again" remounts the tree - safe
 * because all real state lives in SQLite/Keychain, not component state.
 */
import React, { Component, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { log } from '../logging/logger';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error('error-boundary', error.message, { componentStack: info.componentStack ?? undefined });
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.detail}>{this.state.error.message}</Text>
        <Pressable style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

// Deliberately theme-independent: if the theme provider itself is what
// crashed, this screen still has to render.
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0b0b0f' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  detail: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
