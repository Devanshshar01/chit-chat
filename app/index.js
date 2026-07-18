/**
 * @format
 */

// crypto.getRandomValues polyfill - must load before ANYTHING that pulls
// in libsodium (crypto/identity, messages/content), or the release bundle
// aborts module init with "getRandomValues is not available".
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandlers } from './src/notifications/background';
import { installGlobalErrorHandlers } from './src/logging/logger';

installGlobalErrorHandlers();
registerBackgroundHandlers();

AppRegistry.registerComponent(appName, () => App);
