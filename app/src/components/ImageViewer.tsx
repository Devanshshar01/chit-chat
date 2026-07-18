/**
 * Full-screen modal viewer for images/GIF previews tapped in the chat.
 */
import React, { useState } from 'react';
import { Modal, View, Image, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  url: string | null;
  onClose: () => void;
}

export default function ImageViewer({ url, onClose }: Props) {
  const [loading, setLoading] = useState(true);

  return (
    <Modal visible={url !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.closeButton} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        {url && (
          <>
            {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" size="large" />}
            <Image
              source={{ uri: url }}
              style={styles.image}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  image: { width: '100%', height: '80%' },
  closeButton: {
    position: 'absolute', top: 48, right: 20, zIndex: 2,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
