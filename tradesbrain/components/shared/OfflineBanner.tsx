// D6 Flow12 S4 — App-wide offline banner. Pinned to the top of the screen
// stack so every authenticated screen surfaces the state.

import React from 'react';
import { View, Text } from 'react-native';
import { useNetworkContext } from '../../context/NetworkContext';

export default function OfflineBanner() {
  const { isConnected, initialized } = useNetworkContext();
  if (!initialized || isConnected) return null;
  return (
    <View className="bg-amber-500 px-3 py-1.5">
      <Text className="text-white text-xs font-semibold text-center">
        Offline — Rex messages will queue and auto-send when you reconnect.
      </Text>
    </View>
  );
}
