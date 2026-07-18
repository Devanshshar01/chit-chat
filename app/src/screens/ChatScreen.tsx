import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image,
} from 'react-native';

import { OutboxManager } from '../outbox/outboxManager';
import { getAllMessages, type LocalMessage } from '../outbox/db';
import { fetchLinkPreview, fetchPresence, type SyncedMessage } from '../api/client';
import { encodeContent, decodeContent, extractFirstUrl, type MessageContent } from '../messages/content';
import { findSticker } from '../media/stickers';
import StickerPicker from './StickerPicker';
import GifPicker from './GifPicker';
import type { GifResult } from '../media/gifSearch';

interface Props {
  myUsername: string;
  peerUsername: string;
  accessToken: string;
}

interface PeerPresence {
  isOnline: boolean;
  lastSeenAt: string | null;
}

/**
 * NOTE ON ENCRYPTION: message content is still base64(JSON), not
 * encrypted - see the top-level README. Step 3 built the identity/
 * key-exchange plumbing; turning that into an actual shared secret +
 * message encryption is separate work that hasn't been built yet.
 */
export default function ChatScreen({ myUsername, peerUsername, accessToken }: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>(getAllMessages());
  const [draft, setDraft] = useState('');
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [presence, setPresence] = useState<PeerPresence | null>(null);
  const managerRef = useRef<OutboxManager | null>(null);

  const refresh = useCallback(() => setMessages(getAllMessages()), []);

  // Mark any unread incoming messages as read whenever the message list
  // changes while this screen is mounted - the simplest correct policy
  // for a single-thread chat screen: if it's visible, its messages are read.
  const markVisibleMessagesRead = useCallback((msgs: LocalMessage[]) => {
    const unreadIncomingIds = msgs
      .filter((m) => m.direction === 'incoming' && m.read_receipt_sent === 0)
      .map((m) => m.id);
    if (unreadIncomingIds.length > 0) {
      managerRef.current?.markAsRead(unreadIncomingIds);
    }
  }, []);

  useEffect(() => {
    const manager = new OutboxManager(accessToken, {
      onIncoming: () => {
        refresh();
      },
      onStatusChange: () => {
        refresh();
      },
      onPresence: (username, isOnline, lastSeenAt) => {
        if (username === peerUsername) {
          setPresence({ isOnline, lastSeenAt });
        }
      },
    });
    managerRef.current = manager;
    manager.start();

    // initial presence snapshot - the live push above only fires on
    // future changes, so fetch current state once up front too
    fetchPresence(accessToken, peerUsername)
      .then((p) => setPresence({ isOnline: p.is_online, lastSeenAt: p.last_seen_at }))
      .catch(() => {});

    return () => manager.stop();
  }, [accessToken, peerUsername, refresh]);

  useEffect(() => {
    markVisibleMessagesRead(messages);
  }, [messages, markVisibleMessagesRead]);

  const sendContent = async (content: MessageContent) => {
    if (!managerRef.current) return;
    const ciphertext = await encodeContent(content);
    managerRef.current.enqueue(peerUsername, ciphertext);
    refresh();
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');

    const url = extractFirstUrl(text);
    if (url) {
      // send the text immediately, don't make the user wait on a network
      // round-trip just to send a message - then upgrade it to a link
      // preview if the fetch succeeds. Simplest correct version: fetch
      // first, since we don't yet have an "edit after send" concept.
      try {
        const preview = await fetchLinkPreview(accessToken, url);
        await sendContent({
          type: 'link',
          url,
          text,
          title: preview.available ? preview.title : null,
          description: preview.available ? preview.description : null,
          imageUrl: preview.available ? preview.image_url : null,
        });
        return;
      } catch {
        // preview fetch failed outright (network etc) - fall through and send as plain text
      }
    }

    await sendContent({ type: 'text', text });
  };

  const sendSticker = (stickerId: string) => sendContent({ type: 'sticker', stickerId });
  const sendGif = (gif: GifResult) =>
    sendContent({ type: 'gif', url: gif.url, previewUrl: gif.previewUrl, width: gif.width, height: gif.height });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headerWrap}>
        <Text style={styles.header}>{peerUsername}</Text>
        <Text style={styles.presenceText}>{formatPresence(presence)}</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.client_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <MessageBubble message={item} />}
      />

      <View style={styles.toolbar}>
        <Pressable style={styles.toolbarButton} onPress={() => setStickerPickerOpen(true)}>
          <Text style={styles.toolbarButtonText}>😊</Text>
        </Pressable>
        <Pressable style={styles.toolbarButton} onPress={() => setGifPickerOpen(true)}>
          <Text style={styles.toolbarButtonText}>GIF</Text>
        </Pressable>

        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor="#666"
          onSubmitEditing={send}
        />
        <Pressable style={styles.sendButton} onPress={send}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>

      <StickerPicker
        visible={stickerPickerOpen}
        onClose={() => setStickerPickerOpen(false)}
        onSelect={sendSticker}
      />
      <GifPicker
        visible={gifPickerOpen}
        onClose={() => setGifPickerOpen(false)}
        onSelect={sendGif}
      />
    </KeyboardAvoidingView>
  );
}

function formatPresence(presence: PeerPresence | null): string {
  if (!presence) return '';
  if (presence.isOnline) return 'online';
  if (!presence.lastSeenAt) return '';
  const diffMs = Date.now() - new Date(presence.lastSeenAt).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'last seen just now';
  if (diffMins < 60) return `last seen ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `last seen ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `last seen ${diffDays}d ago`;
}

function MessageBubble({ message }: { message: LocalMessage }) {
  const [content, setContent] = useState<MessageContent | null>(null);

  useEffect(() => {
    decodeContent(message.ciphertext).then(setContent);
  }, [message.ciphertext]);

  if (!content) return null;

  const align = message.direction === 'outgoing' ? styles.outgoing : styles.incoming;
  const tick = message.direction === 'outgoing' ? <DeliveryTick message={message} /> : null;

  if (content.type === 'sticker') {
    const sticker = findSticker(content.stickerId);
    return (
      <View style={[styles.stickerWrap, align]}>
        <Text style={styles.stickerEmoji}>{sticker?.emoji ?? '❓'}</Text>
        {tick}
      </View>
    );
  }

  if (content.type === 'gif') {
    return (
      <View style={[styles.bubble, align, styles.mediaBubble]}>
        <Image
          source={{ uri: content.previewUrl }}
          style={{ width: 200, height: (200 * content.height) / content.width }}
          resizeMode="cover"
        />
        {tick}
      </View>
    );
  }

  if (content.type === 'link') {
    return (
      <View style={[styles.bubble, align]}>
        <Text style={styles.bubbleText}>{content.text}</Text>
        {content.title && (
          <View style={styles.linkCard}>
            {content.imageUrl && (
              <Image source={{ uri: content.imageUrl }} style={styles.linkImage} resizeMode="cover" />
            )}
            <Text style={styles.linkTitle} numberOfLines={2}>{content.title}</Text>
            {content.description && (
              <Text style={styles.linkDescription} numberOfLines={2}>{content.description}</Text>
            )}
          </View>
        )}
        {tick}
      </View>
    );
  }

  // 'text' and legacy-fallback both land here
  return (
    <View style={[styles.bubble, align]}>
      <Text style={styles.bubbleText}>{content.text}</Text>
      {tick}
    </View>
  );
}

/** ✓ sent, ✓✓ delivered, ✓✓ (blue) read - only rendered on outgoing messages. */
function DeliveryTick({ message }: { message: LocalMessage }) {
  let symbol = '✓';
  let color = '#9ca3af';
  if (message.read_at) {
    symbol = '✓✓';
    color = '#60a5fa';
  } else if (message.delivered_at) {
    symbol = '✓✓';
    color = '#9ca3af';
  }
  return <Text style={[styles.tick, { color }]}>{symbol}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0f' },
  headerWrap: {
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222',
  },
  header: { color: '#fff', fontSize: 18, fontWeight: '600' },
  presenceText: { color: '#888', fontSize: 12, marginTop: 2 },
  list: { padding: 12, gap: 8 },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 4 },
  mediaBubble: { padding: 4, overflow: 'hidden' },
  outgoing: { backgroundColor: '#4f46e5', alignSelf: 'flex-end' },
  incoming: { backgroundColor: '#1f1f26', alignSelf: 'flex-start' },
  bubbleText: { color: '#fff' },
  stickerWrap: { alignSelf: 'flex-start', marginVertical: 4, backgroundColor: 'transparent' },
  stickerEmoji: { fontSize: 56 },
  tick: { fontSize: 11, alignSelf: 'flex-end', marginTop: 2 },
  linkCard: {
    marginTop: 8, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  linkImage: { width: '100%', height: 120 },
  linkTitle: { color: '#fff', fontWeight: '600', padding: 8, paddingBottom: 0 },
  linkDescription: { color: '#ccc', fontSize: 12, padding: 8, paddingTop: 4 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222',
  },
  toolbarButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#151519',
    justifyContent: 'center', alignItems: 'center',
  },
  toolbarButtonText: { fontSize: 18 },
  input: {
    flex: 1, backgroundColor: '#151519', borderRadius: 20, paddingHorizontal: 16,
    color: '#fff', borderWidth: 1, borderColor: '#333',
  },
  sendButton: { backgroundColor: '#4f46e5', borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
  sendButtonText: { color: '#fff', fontWeight: '600' },
});
