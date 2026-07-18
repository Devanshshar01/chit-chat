/**
 * Persistent auth session: tokens live in the OS keystore (same
 * react-native-keychain the crypto identity already uses), so a killed
 * or crashed app restores straight into the chat instead of the login
 * screen - and an expired access token is refreshed transparently
 * instead of kicking the user out.
 *
 * Refresh tokens rotate on every use (backend revokes the old one), so
 * the stored pair is always the newest one.
 */
import * as Keychain from 'react-native-keychain';

import { refreshTokens, type TokenPair } from '../api/client';
import { log } from '../logging/logger';

const KEYCHAIN_SERVICE = 'unnamed-chat.session';

export interface StoredSession {
  username: string;
  accessToken: string;
  refreshToken: string;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await Keychain.setInternetCredentials(KEYCHAIN_SERVICE, session.username, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const creds = await Keychain.getInternetCredentials(KEYCHAIN_SERVICE);
    if (creds === false) return null;
    return JSON.parse(creds.password) as StoredSession;
  } catch (error) {
    // corrupted storage must never brick startup - treat as logged out
    log.warn('session', 'failed to load stored session, treating as logged out', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Keychain.resetInternetCredentials({ server: KEYCHAIN_SERVICE });
}

let refreshInFlight: Promise<StoredSession> | null = null;

/**
 * Exchanges the stored refresh token for a fresh token pair and persists
 * it. Concurrent callers share one in-flight refresh - the backend
 * revokes a refresh token the moment it's used, so two parallel
 * refreshes with the same token would log the user out.
 */
export async function refreshSession(current: StoredSession): Promise<StoredSession> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const tokens: TokenPair = await refreshTokens(current.refreshToken);
        const updated: StoredSession = {
          username: current.username,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        };
        await saveSession(updated);
        log.info('session', 'access token refreshed');
        return updated;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}
