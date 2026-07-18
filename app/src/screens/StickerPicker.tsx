import React from "react";
import { View, Text, Pressable, FlatList, StyleSheet, Modal } from "react-native";

import { STICKER_PACK } from "../media/stickers";

interface Props {
  visible: boolean;
  onSelect: (stickerId: string) => void;
  onClose: () => void;
}

export default function StickerPicker({ visible, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Stickers</Text>
          <FlatList
            data={STICKER_PACK}
            numColumns={4}
            keyExtractor={(s) => s.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.stickerButton}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <Text style={styles.stickerEmoji}>{item.emoji}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#151519", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: "50%" },
  title: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  stickerButton: { flex: 1, aspectRatio: 1, justifyContent: "center", alignItems: "center" },
  stickerEmoji: { fontSize: 40 },
});
