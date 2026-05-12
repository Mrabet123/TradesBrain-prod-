// D6 Flow12 S20 — Account suspended.
// Full-screen blocker except for History (read-only) and Sign Out. M10 wires
// this as a top-level gate in App.tsx based on users.is_suspended.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuthContext } from '../../context/AuthContext';

export default function AccountSuspendedScreen() {
  const { signOut } = useAuthContext();
  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <Text className="text-6xl mb-4">⛔</Text>
      <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
        Account suspended
      </Text>
      <Text className="text-sm text-gray-600 text-center mb-6">
        Your account has been suspended. Contact support@tradesbrain.app to
        review your account.
      </Text>
      <Pressable
        onPress={signOut}
        className="border border-gray-300 py-4 px-8 rounded-xl"
      >
        <Text className="text-gray-800 font-semibold">Sign out</Text>
      </Pressable>
    </View>
  );
}
