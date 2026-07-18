import React, { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Modal, Image, ActivityIndicator } from "react-native";

import { searchGifs, trendingGifs, type GifResult } from "../media/gifSearch";

interface Props {
  visible: boolean;
  onSelect: (gif: GifResult) => void;
  onClose: () => void;
}

export default function GifPicker({ visible, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSearch = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const gifs = q.trim() ? await searchGifs(q) : await trendingGifs();
      setResults(gifs);
    } catch (e: any) {
      setError(e?.message ?? "search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => runSearch("")}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>GIFs</Text>
          <TextInput
            style={styles.input}
            placeholder="Search GIFs"
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
          />
          {loading && <ActivityIndicator color="#fff" style={{ marginTop: 12 }} />}
          {error && <Text style={styles.error}>{error}</Text>}
          <FlatList
            data={results}
            numColumns={2}
            keyExtractor={(g) => g.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.gifButton}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Image source={{ uri: item.previewUrl }} style={styles.gifImage} resizeMode="cover" />
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
  sheet: { backgroundColor: "#151519", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, height: "70%" },
  title: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: "#333", borderRadius: 10, padding: 10,
    color: "#fff", backgroundColor: "#0b0b0f", marginBottom: 12,
  },
  error: { color: "#f87171", marginBottom: 12 },
  gifButton: { flex: 1, aspectRatio: 1, margin: 4, borderRadius: 8, overflow: "hidden", backgroundColor: "#0b0b0f" },
  gifImage: { width: "100%", height: "100%" },
});
