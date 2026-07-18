/**
 * Jest mocks for native modules (no native runtime exists under Jest).
 */

/* eslint-env jest */

jest.mock('react-native-quick-sqlite', () => {
  // minimal in-memory stand-in: execute() returns empty result sets so
  // the db layer initializes cleanly inside tests
  const connection = {
    execute: jest.fn(() => ({ rows: { _array: [], length: 0 } })),
    close: jest.fn(),
  };
  return { open: jest.fn(() => connection) };
});

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@react-native-firebase/messaging', () => {
  const messaging = () => ({
    requestPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve('test-token')),
    onTokenRefresh: jest.fn(() => () => {}),
    onMessage: jest.fn(() => () => {}),
    setBackgroundMessageHandler: jest.fn(),
  });
  messaging.AuthorizationStatus = { DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 };
  return { __esModule: true, default: messaging };
});

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(() => Promise.resolve('messages')),
    displayNotification: jest.fn(() => Promise.resolve('id')),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
  },
  AndroidImportance: { HIGH: 4 },
  EventType: { DISMISSED: 0, PRESS: 1 },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn(), getString: jest.fn(() => Promise.resolve('')) },
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('uuid', () => ({
  v4: () => '00000000-0000-4000-8000-000000000000',
}));

jest.mock('libsodium-wrappers', () => ({
  ready: Promise.resolve(),
  crypto_sign_keypair: jest.fn(),
  crypto_box_keypair: jest.fn(),
  to_base64: jest.fn(() => ''),
  from_base64: jest.fn(() => new Uint8Array()),
}));
