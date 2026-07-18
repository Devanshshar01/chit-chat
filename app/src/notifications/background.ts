/**
 * Background/killed-state push handling. MUST be registered from
 * index.js, outside any React component - RN spins up a headless JS
 * context for these, no UI exists yet.
 */
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

import { displayMessageNotification, pushAvailable } from './push';

export function registerBackgroundHandlers(): void {
  if (!pushAvailable()) {
    // no google-services.json in this build -> no [DEFAULT] Firebase app;
    // touching messaging() would throw before the UI even mounts
    return;
  }

  // data-only FCM message arriving while the app is backgrounded/killed
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    await displayMessageNotification(remoteMessage);
  });

  // notification interaction while backgrounded/killed. The PRESS case
  // that launches the app is handled by getInitialNotification() in
  // push.ts once the UI is up; this handler just needs to exist so
  // notifee doesn't warn, and to swallow DISMISSED events cleanly.
  notifee.onBackgroundEvent(async ({ type }) => {
    if (type === EventType.DISMISSED || type === EventType.PRESS) {
      // nothing to do here - state is reconciled on next app open
    }
  });
}
