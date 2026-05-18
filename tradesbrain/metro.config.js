const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Stub @stripe/stripe-react-native on web — it imports native-only APIs and
// has no web counterpart. Native bundles resolve it normally.
const stripeStub = path.resolve(__dirname, 'stubs/stripe-web.js');
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName.startsWith('@stripe/stripe-react-native')) {
    return { type: 'sourceFile', filePath: stripeStub };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
