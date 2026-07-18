/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundHandlers } from './src/notifications/background';
import { installGlobalErrorHandlers } from './src/logging/logger';

installGlobalErrorHandlers();
registerBackgroundHandlers();

AppRegistry.registerComponent(appName, () => App);
