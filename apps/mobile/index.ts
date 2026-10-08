import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// Cast to expo's expected ComponentType due to duplicate React types in pnpm store
registerRootComponent(App as Parameters<typeof registerRootComponent>[0]);
