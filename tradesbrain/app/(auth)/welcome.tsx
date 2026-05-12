// D6 Flow02 S2 — Welcome screen.
// Tagline: 'Your AI co-pilot on every job site.'
// Two buttons: Create Account, Sign In.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WelcomeScreen() {
  const nav = useNavigation<Nav>();

  return (
    <View className="flex-1 bg-white px-6 justify-center">
      <View className="items-center mb-12">
        <Text className="text-4xl font-bold text-brand">TradesBrain</Text>
        <Text className="text-base text-gray-600 mt-2 text-center">
          Your AI co-pilot on every job site.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => nav.navigate('SignUp')}
        className="bg-brand py-4 rounded-xl mb-3"
      >
        <Text className="text-white text-center font-semibold text-base">Create Account</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => nav.navigate('SignIn')}
        className="py-4 rounded-xl border border-gray-300"
      >
        <Text className="text-gray-800 text-center font-semibold text-base">Sign In</Text>
      </Pressable>

      <Text className="text-xs text-gray-400 text-center mt-8">
        By continuing you agree to our Terms of Use and Privacy Policy.
      </Text>
    </View>
  );
}
