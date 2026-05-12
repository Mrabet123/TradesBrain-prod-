// D6 Flow12 S19 — Force upgrade.
// Full-screen blocker. RULE 6: no dismiss option. Only the App Store deep link.
// Triggered when the current bundle version is below the required minimum.

import React from 'react';
import { View, Text, Pressable, Linking, Platform } from 'react-native';

const APP_STORE_URL = 'https://apps.apple.com/app/tradesbrain';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.tradesbrain';

export default function ForceUpgradeScreen({
  currentVersion,
  requiredVersion,
}: {
  currentVersion: string;
  requiredVersion: string;
}) {
  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <Text className="text-6xl mb-4">📲</Text>
      <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
        Update required
      </Text>
      <Text className="text-sm text-gray-600 text-center mb-6">
        TradesBrain {currentVersion} is no longer supported. Please update to
        version {requiredVersion} or later to continue.
      </Text>
      <Pressable
        onPress={() =>
          Linking.openURL(Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL)
        }
        className="bg-brand py-4 px-8 rounded-xl"
      >
        <Text className="text-white font-semibold text-base">
          Open {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}
        </Text>
      </Pressable>
    </View>
  );
}
