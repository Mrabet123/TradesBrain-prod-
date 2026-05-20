// Splash / launch screen — shown by RootLayout while the session check and
// first profile lookup resolve (D6 Flow01/Flow02 S1).
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export default function SplashScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center">
      <Text className="text-3xl font-bold text-brand mb-1">TradesBrain</Text>
      <Text className="text-sm text-gray-500 mb-8">Your AI co-pilot on the job</Text>
      <ActivityIndicator />
    </View>
  );
}
