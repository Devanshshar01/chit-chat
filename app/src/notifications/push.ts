/**
 * FCM push notifications, client half of step 9.
 *
 * The backend sends DATA-ONLY messages (see backend/app/push.py) with no
 * message content - just {type, sender_username, message_id}. That has
 * two consequences handled here:
 *
 *   1. Display is entirely our job (notifee), for foreground, background
 *      AND killed states - which is exactly what lets us suppress the
 *      popup when the chat with that sender is already open on screen.
 *   2. Nothing sensitive can leak through a lock screen, because nothing
 *      sensitive is ever in the payload. The real ciphertext arrives via
 *      the same /messages/sync path the outbox already uses.
 *
 * Dedup: notifee notifications use the message_id as their id, so FCM
 * retrying a delivery replaces the existing notification instead of
 * stacking a duplicate. Message insertion is separately deduped by the
 * outbox's INSERT OR IGNORE on client_id - a push can never double-insert.
 */
import { AppState } from 'react-native';
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

import { registerPushToken, unregisterPushToken } from '../api/client';
import { withRetry } from '../api/retry';
import { getSetting, setSetting } from '../outbox/db';
import { log } from '../logging/logger';

const CHANNEL_ID = 'messages';
const GROUP_ID = 'chat-messages';
const SETTING_LAST_TOKEN = 'push.last_registered_token';
const SETTING_MUTED = 'notifications.muted';

// The chat screen sets this while it's mounted and foregrounded, so a
// push for the conversation you're literally looking at refreshes the UI
// (the socket does that) without also popping a notification.
let activeChatPeer: string | null = null;

export function setActiveChatPeer(username: string | null): void {
  activeChatPeer = username;
}

export function notificationsMuted(): boolean {
  return getSetting(SETTING_MUTED) === 'true';
}

export function setNotificationsMuted(muted: boolean): void {
  setSetting(SETTING_MUTED, muted ? 'true' : 'false');
}

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Messages',
    importance: AndroidImportance.HIGH,
  });
}

/**
 * Renders (or updates) the on-device notification for one push payload.
 * Shared by the foreground and background/killed handlers.
 */
export async function displayMessageNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const data = remoteMessage.data ?? {};
  if (data.type !== 'new_message') return;

  const sender = String(data.sender_username ?? 'New message');
  const messageId = String(data.message_id ?? Date.now());

  if (notificationsMuted()) {
    log.info('push', 'notification suppressed (muted)', { sender });
    return;
  }

  // chat already open in the foreground -> the live socket/sync updates
  // the UI; a popup on top of the visible conversation is just noise
  if (AppState.currentState === 'active' && activeChatPeer === sender) {
    log.info('push', 'notification suppressed (chat open)', { sender });
    return;
  }

  await ensureChannel();
  await notifee.displayNotification({
    id: messageId, // FCM redelivery replaces, never duplicates
    title: sender,
    body: 'New message',
    data: { sender_username: sender, message_id: messageId },
    android: {
      channelId: CHANNEL_ID,
      groupId: GROUP_ID,
      smallIcon: 'ic_notification',
      pressAction: { id: 'default', launchActivity: 'default' },
    },
  });
}

export interface PushManagerOptions {
  accessToken: string;
  /** Called when a tapped notification should open the conversation with this user. */
  onOpenConversation: (senderUsername: string) => void;
}

/**
 * Full foreground push lifecycle. Call after login; returns a cleanup
 * function that unsubscribes every listener (call it on logout/unmount).
 */
export async function startPushNotifications(options: PushManagerOptions): Promise<() => void> {
  const { accessToken, onOpenConversation } = options;

  // Android 13+ needs runtime POST_NOTIFICATIONS consent; earlier
  // versions and iOS resolve through the same call.
  const permission = await messaging().requestPermission();
  if (permission === messaging.AuthorizationStatus.DENIED) {
    log.warn('push', 'notification permission denied - push disabled on this device');
    return () => {};
  }

  await ensureChannel();

  // register the current token (retried - registration failing right
  // after login must not lose the device silently)
  try {
    const token = await messaging().getToken();
    await withRetry('push-register', () => registerPushToken(accessToken, token, 'phone'));
    setSetting(SETTING_LAST_TOKEN, token);
    log.info('push', 'FCM token registered');
  } catch (error) {
    log.error('push', 'failed to register FCM token', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
    try {
      await withRetry('push-reregister', () => registerPushToken(accessToken, token, 'phone'));
      setSetting(SETTING_LAST_TOKEN, token);
      log.info('push', 'rotated FCM token re-registered');
    } catch (error) {
      log.error('push', 'failed to re-register rotated FCM token', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // foreground pushes: data-only messages land here while the app is open
  const unsubscribeForeground = messaging().onMessage(displayMessageNotification);

  // notification tapped while the app is running (foreground/background)
  const unsubscribeNotifeeEvents = notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS) {
      const sender = detail.notification?.data?.sender_username;
      if (typeof sender === 'string') onOpenConversation(sender);
    }
  });

  // app launched from a killed state by tapping a notification
  const initial = await notifee.getInitialNotification();
  const initialSender = initial?.notification.data?.sender_username;
  if (typeof initialSender === 'string') onOpenConversation(initialSender);

  return () => {
    unsubscribeTokenRefresh();
    unsubscribeForeground();
    unsubscribeNotifeeEvents();
  };
}

/**
 * Logout half of the token lifecycle: tells the backend to drop this
 * device's token so a signed-out phone stops getting pushes.
 */
export async function stopPushNotifications(accessToken: string): Promise<void> {
  const lastToken = getSetting(SETTING_LAST_TOKEN);
  if (!lastToken) return;
  try {
    await withRetry('push-unregister', () => unregisterPushToken(accessToken, lastToken));
    setSetting(SETTING_LAST_TOKEN, '');
    log.info('push', 'FCM token unregistered');
  } catch (error) {
    // backend logout also clears the token tied to the refresh token, so
    // a failed explicit unregister still gets cleaned up server-side
    log.warn('push', 'failed to unregister FCM token', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
