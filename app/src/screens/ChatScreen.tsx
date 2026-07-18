import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image,
  Modal, AppState,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutboxManager } from '../outbox/outboxManager';
import {
  getAllMessages, setMessageStarred, deleteMessageLocally, type LocalMessage,
} from '../outbox/db';
import { fetchLinkPreview, fetchPresence } from '../api/client';
import { encodeContent, decodeContent, extractFirstUrl, type MessageContent } from '../messages/content';
import { findSticker } from '../media/stickers';
import { setActiveChatPeer } from '../notifications/push';
import { useTheme } from '../theme/ThemeContext';
import ConnectionBanner from '../components/ConnectionBanner';
import ImageViewer from '../components/ImageViewer';
import StickerPicker from './StickerPicker';
import GifPicker from './GifPicker';
import type { GifResult } from '../media/gifSearch';
import type { ThemeColors } from '../theme/theme';

interface Props {
  peerUsername: string;
  accessToken: string;
  onOpenSettings: () => void;
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
export default function ChatScreen({ peerUsername, accessToken, onOpenSettings }: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>(getAllMessages());
  const [draft, setDraft] = useState('');
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [presence, setPresence] = useState<PeerPresence | null>(null);
  const [connected, setConnected] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<LocalMessage | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const managerRef = useRef<OutboxManager | null>(null);
  const { colors, fontFactor } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, fontFactor), [colors, fontFactor]);

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
      onConnectionChange: setConnected,
    });
    managerRef.current = manager;
    manager.start();

    // initial presence snapshot - the live push above only fires on
    // future changes, so fetch current state once up front too
    fetchPresence(accessToken, peerUsername)
      .then((p) => setPresence({ isOnline: p.is_online, lastSeenAt: p.last_seen_at }))
      .catch(() => {});

    return () => {
      managerRef.current = null;
      manager.stop();
    };
  }, [accessToken, peerUsername, refresh]);

  // Tell the push layer this conversation is on screen (and whether the
  // app is foregrounded) so its notifications are suppressed while the
  // user is literally looking at it.
  useEffect(() => {
    setActiveChatPeer(peerUsername);
    const subscription = AppState.addEventListener('change', (state) => {
      setActiveChatPeer(state === 'active' ? peerUsername : null);
    });
    return () => {
      subscription.remove();
      setActiveChatPeer(null);
    };
  }, [peerUsername]);

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

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setSearchQuery('');
      return !open;
    });
  };

  // Search/star filtering happens over the DECODED text, so it has to be
  // async - decoded results are cached per ciphertext by MessageBubble's
  // decode path below; here a light decoded-text map is maintained.
  const [decodedText, setDecodedText] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        messages.map(async (m) => [m.client_id, contentSearchText(await decodeContent(m.ciphertext))] as const),
      );
      if (!cancelled) setDecodedText(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  const visibleMessages = useMemo(() => {
    let result = messages;
    if (starredOnly) result = result.filter((m) => m.starred === 1);
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((m) => (decodedText[m.client_id] ?? '').toLowerCase().includes(query));
    }
    return result;
  }, [messages, starredOnly, searchQuery, decodedText]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headerWrap}>
        <View style={styles.headerLeft}>
          <Text style={styles.header}>{peerUsername}</Text>
          <Text style={styles.presenceText}>{formatPresence(presence)}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setStarredOnly((v) => !v)} hitSlop={8} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, starredOnly && { color: colors.starAccent }]}>★</Text>
          </Pressable>
          <Pressable onPress={toggleSearch} hitSlop={8} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>🔍</Text>
          </Pressable>
          <Pressable onPress={onOpenSettings} hitSlop={8} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>⚙︎</Text>
          </Pressable>
        </View>
      </View>

      <ConnectionBanner connected={connected} />

      {searchOpen && (
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search messages"
            placeholderTextColor={colors.textSecondary}
            autoFocus
          />
        </View>
      )}

      <FlatList
        data={visibleMessages}
        keyExtractor={(item) => item.client_id}
        contentContainerStyle={styles.list}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={11}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {searchQuery
                ? 'No messages match your search'
                : starredOnly
                  ? 'No starred messages yet - long-press a message to star it'
                  : `No messages yet - say hi to ${peerUsername}!`}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            styles={styles}
            colors={colors}
            highlight={searchQuery.trim()}
            onLongPress={() => setSelectedMessage(item)}
            onImagePress={setViewerUrl}
          />
        )}
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
          placeholderTextColor={colors.textSecondary}
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
      <MessageActionSheet
        message={selectedMessage}
        styles={styles}
        colors={colors}
        onClose={() => setSelectedMessage(null)}
        onChanged={refresh}
      />
      <ImageViewer url={viewerUrl} onClose={() => setViewerUrl(null)} />
    </KeyboardAvoidingView>
  );
}

/** The plain text a message contributes to search - stickers/gifs match on nothing. */
function contentSearchText(content: MessageContent): string {
  switch (content.type) {
    case 'text':
      return content.text;
    case 'link':
      return `${content.text} ${content.title ?? ''} ${content.description ?? ''}`;
    case 'sticker':
    case 'gif':
      return '';
  }
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

type Styles = ReturnType<typeof createStyles>;

interface BubbleProps {
  message: LocalMessage;
  styles: Styles;
  colors: ThemeColors;
  highlight: string;
  onLongPress: () => void;
  onImagePress: (url: string) => void;
}

const MessageBubble = React.memo(function MessageBubbleInner({
  message, styles, colors, highlight, onLongPress, onImagePress,
}: BubbleProps) {
  const [content, setContent] = useState<MessageContent | null>(null);

  useEffect(() => {
    let cancelled = false;
    decodeContent(message.ciphertext).then((decoded) => {
      if (!cancelled) setContent(decoded);
    });
    return () => {
      cancelled = true;
    };
  }, [message.ciphertext]);

  if (!content) return null;

  const outgoing = message.direction === 'outgoing';
  const align = outgoing ? styles.outgoing : styles.incoming;
  const textStyle = outgoing ? styles.bubbleTextOutgoing : styles.bubbleTextIncoming;
  const meta = (
    <View style={styles.metaRow}>
      {message.starred === 1 && <Text style={[styles.star, { color: colors.starAccent }]}>★</Text>}
      {outgoing && <DeliveryTick message={message} styles={styles} colors={colors} />}
    </View>
  );

  if (content.type === 'sticker') {
    const sticker = findSticker(content.stickerId);
    return (
      <Pressable onLongPress={onLongPress} style={[styles.stickerWrap, align]}>
        <Text style={styles.stickerEmoji}>{sticker?.emoji ?? '❓'}</Text>
        {meta}
      </Pressable>
    );
  }

  if (content.type === 'gif') {
    const gifUrl = content.url;
    return (
      <Pressable
        onLongPress={onLongPress}
        onPress={() => onImagePress(gifUrl)}
        style={[styles.bubble, align, styles.mediaBubble]}
      >
        <Image
          source={{ uri: content.previewUrl }}
          style={[styles.gifImage, { height: (200 * content.height) / content.width }]}
          resizeMode="cover"
        />
        {meta}
      </Pressable>
    );
  }

  if (content.type === 'link') {
    const linkImage = content.imageUrl;
    return (
      <Pressable onLongPress={onLongPress} style={[styles.bubble, align]}>
        <HighlightedText text={content.text} highlight={highlight} style={textStyle} highlightColor={colors.starAccent} />
        {content.title && (
          <View style={styles.linkCard}>
            {linkImage && (
              <Pressable onPress={() => onImagePress(linkImage)}>
                <Image source={{ uri: linkImage }} style={styles.linkImage} resizeMode="cover" />
              </Pressable>
            )}
            <Text style={styles.linkTitle} numberOfLines={2}>{content.title}</Text>
            {content.description && (
              <Text style={styles.linkDescription} numberOfLines={2}>{content.description}</Text>
            )}
          </View>
        )}
        {meta}
      </Pressable>
    );
  }

  // 'text' and legacy-fallback both land here
  return (
    <Pressable onLongPress={onLongPress} style={[styles.bubble, align]}>
      <HighlightedText text={content.text} highlight={highlight} style={textStyle} highlightColor={colors.starAccent} />
      {meta}
    </Pressable>
  );
});

/** Renders `text` with case-insensitive occurrences of `highlight` emphasized. */
function HighlightedText({
  text, highlight, style, highlightColor,
}: { text: string; highlight: string; style: object; highlightColor: string }) {
  if (!highlight) return <Text style={style}>{text}</Text>;

  const lowerText = text.toLowerCase();
  const lowerQuery = highlight.toLowerCase();
  const parts: { chunk: string; match: boolean }[] = [];
  let index = 0;
  while (index < text.length) {
    const found = lowerText.indexOf(lowerQuery, index);
    if (found === -1) {
      parts.push({ chunk: text.slice(index), match: false });
      break;
    }
    if (found > index) parts.push({ chunk: text.slice(index, found), match: false });
    parts.push({ chunk: text.slice(found, found + highlight.length), match: true });
    index = found + highlight.length;
  }

  return (
    <Text style={style}>
      {parts.map((part, i) => (
        <Text key={i} style={part.match ? [highlightStyles.match, { backgroundColor: highlightColor }] : undefined}>
          {part.chunk}
        </Text>
      ))}
    </Text>
  );
}

const highlightStyles = StyleSheet.create({
  match: { color: '#000' },
});

interface ActionSheetProps {
  message: LocalMessage | null;
  styles: Styles;
  colors: ThemeColors;
  onClose: () => void;
  onChanged: () => void;
}

/** Long-press actions: copy, star/unstar, delete-for-me, message info. */
function MessageActionSheet({ message, styles, colors, onClose, onChanged }: ActionSheetProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  const close = () => {
    setInfoOpen(false);
    onClose();
  };

  const copy = async () => {
    if (!message) return;
    const content = await decodeContent(message.ciphertext);
    Clipboard.setString(contentSearchText(content) || `[${content.type}]`);
    close();
  };

  const toggleStar = () => {
    if (!message) return;
    setMessageStarred(message.id, message.starred !== 1);
    onChanged();
    close();
  };

  const deleteForMe = () => {
    if (!message) return;
    deleteMessageLocally(message.id);
    onChanged();
    close();
  };

  return (
    <Modal visible={message !== null} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.sheetBackdrop} onPress={close}>
        <View style={styles.sheet}>
          {infoOpen && message ? (
            <View style={styles.infoWrap}>
              <Text style={styles.infoTitle}>Message info</Text>
              <InfoRow label="Sent" value={new Date(message.created_at).toLocaleString()} styles={styles} />
              {message.direction === 'outgoing' && (
                <>
                  <InfoRow
                    label="Delivered"
                    value={message.delivered_at ? new Date(message.delivered_at).toLocaleString() : 'not yet'}
                    styles={styles}
                  />
                  <InfoRow
                    label="Read"
                    value={message.read_at ? new Date(message.read_at).toLocaleString() : 'not yet'}
                    styles={styles}
                  />
                </>
              )}
            </View>
          ) : (
            <>
              <SheetAction label="Copy" onPress={copy} styles={styles} />
              <SheetAction label={message?.starred === 1 ? 'Unstar' : 'Star'} onPress={toggleStar} styles={styles} />
              <SheetAction label="Message info" onPress={() => setInfoOpen(true)} styles={styles} />
              <SheetAction label="Delete for me" onPress={deleteForMe} styles={styles} color={colors.danger} />
            </>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

function SheetAction({ label, onPress, styles, color }: { label: string; onPress: () => void; styles: Styles; color?: string }) {
  return (
    <Pressable style={styles.sheetAction} onPress={onPress}>
      <Text style={[styles.sheetActionText, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/** ✓ sent, ✓✓ delivered, ✓✓ (blue) read - only rendered on outgoing messages. */
function DeliveryTick({ message, styles, colors }: { message: LocalMessage; styles: Styles; colors: ThemeColors }) {
  let symbol = '✓';
  let color = colors.tickDefault;
  if (message.read_at) {
    symbol = '✓✓';
    color = colors.tickRead;
  } else if (message.delivered_at) {
    symbol = '✓✓';
    color = colors.tickDefault;
  }
  return <Text style={[styles.tick, { color }]}>{symbol}</Text>;
}

function createStyles(colors: ThemeColors, fontFactor: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerWrap: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceBorder,
    },
    headerLeft: { flexShrink: 1 },
    headerActions: { flexDirection: 'row', gap: 4 },
    headerButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    headerButtonText: { fontSize: 17 * fontFactor, color: colors.textSecondary },
    header: { color: colors.textPrimary, fontSize: 18 * fontFactor, fontWeight: '600' },
    presenceText: { color: colors.textSecondary, fontSize: 12 * fontFactor, marginTop: 2 },
    searchWrap: { paddingHorizontal: 12, paddingVertical: 8 },
    searchInput: {
      backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
      color: colors.textPrimary, borderWidth: 1, borderColor: colors.surfaceBorder, fontSize: 14 * fontFactor,
    },
    list: { padding: 12, gap: 8, flexGrow: 1 },
    emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    emptyStateText: { color: colors.textSecondary, fontSize: 14 * fontFactor, textAlign: 'center' },
    bubble: { maxWidth: '80%', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginVertical: 4 },
    mediaBubble: { padding: 4, overflow: 'hidden' },
    gifImage: { width: 200 },
    outgoing: { backgroundColor: colors.bubbleOutgoing, alignSelf: 'flex-end' },
    incoming: { backgroundColor: colors.bubbleIncoming, alignSelf: 'flex-start' },
    bubbleTextOutgoing: { color: colors.bubbleTextOutgoing, fontSize: 15 * fontFactor },
    bubbleTextIncoming: { color: colors.bubbleTextIncoming, fontSize: 15 * fontFactor },
    stickerWrap: { alignSelf: 'flex-start', marginVertical: 4, backgroundColor: 'transparent' },
    stickerEmoji: { fontSize: 56 * fontFactor },
    metaRow: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center', gap: 4, marginTop: 2 },
    star: { fontSize: 11 * fontFactor },
    tick: { fontSize: 11 * fontFactor },
    linkCard: {
      marginTop: 8, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.2)',
    },
    linkImage: { width: '100%', height: 120 },
    linkTitle: { color: colors.bubbleTextOutgoing, fontWeight: '600', padding: 8, paddingBottom: 0, fontSize: 14 * fontFactor },
    linkDescription: { color: '#ccc', fontSize: 12 * fontFactor, padding: 8, paddingTop: 4 },
    toolbar: {
      flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder,
    },
    toolbarButton: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface,
      justifyContent: 'center', alignItems: 'center',
    },
    toolbarButtonText: { fontSize: 18 * fontFactor, color: colors.textPrimary },
    input: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16,
      color: colors.textPrimary, borderWidth: 1, borderColor: colors.surfaceBorder, fontSize: 15 * fontFactor,
    },
    sendButton: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 18, justifyContent: 'center' },
    sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 * fontFactor },
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
      paddingVertical: 8, paddingBottom: 24,
    },
    sheetAction: { paddingVertical: 14, paddingHorizontal: 24 },
    sheetActionText: { color: colors.textPrimary, fontSize: 16 * fontFactor, fontWeight: '500' },
    infoWrap: { padding: 24 },
    infoTitle: { color: colors.textPrimary, fontSize: 16 * fontFactor, fontWeight: '700', marginBottom: 12 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    infoLabel: { color: colors.textSecondary, fontSize: 14 * fontFactor },
    infoValue: { color: colors.textPrimary, fontSize: 14 * fontFactor },
  });
}
