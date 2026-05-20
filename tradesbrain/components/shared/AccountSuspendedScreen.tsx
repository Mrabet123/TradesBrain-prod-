// D6 Flow12 S20 — Account suspended.
// Blocks all features EXCEPT read-only Job History (reachable via the button
// below — RootLayout renders a restricted History+JobDetail stack while
// suspended) and Sign Out. Also offers a Contact-support action.

import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthContext } from '../../context/AuthContext';
import type { RootStackParamList } from '../../app/_layout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AccountSuspendedScreen() {
  const { signOut } = useAuthContext();
  const nav = useNavigation<Nav>();
  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <Text className="text-6xl mb-4">⛔</Text>
      <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
        Account suspended
      </Text>
      <Text className="text-sm text-gray-600 text-center mb-6">
        Your account has been suspended. Your job history is still available to
        view while this is resolved.
      </Text>
      <Pressable
        onPress={() => nav.navigate('History')}
        className="bg-brand py-4 rounded-xl mb-3 w-full"
      >
        <Text className="text-center text-white font-semibold">Browse job history</Text>
      </Pressable>
      <Pressable
        onPress={() => Linking.openURL('mailto:support@tradesbrain.app')}
        className="border border-gray-300 py-4 rounded-xl mb-3 w-full"
      >
        <Text className="text-center text-gray-800 font-semibold">Contact support</Text>
      </Pressable>
      <Pressable onPress={signOut} className="py-3">
        <Text className="text-center text-gray-500 font-semibold">Sign out</Text>
      </Pressable>
    </View>
  );
}
