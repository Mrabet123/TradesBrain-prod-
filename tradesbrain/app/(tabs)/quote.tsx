// D3 F3 Path B / D6 Flow06 — Quote tab entry.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { useSubscriptionContext } from '../../context/SubscriptionContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function QuoteScreen() {
  const nav = useNavigation<Nav>();
  const { subscriptionStatus, trialQueriesRemaining } = useSubscriptionContext();
  const hasAccess =
    subscriptionStatus === 'active' ||
    (subscriptionStatus === 'trial' && trialQueriesRemaining > 0);

  function go() {
    if (!hasAccess) nav.navigate('Paywall');
    else nav.navigate('QuoteBuilder', {});
  }

  return (
    <View className="flex-1 bg-white pt-12 px-5">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Quotes</Text>
      <Text className="text-sm text-gray-600 mb-6">
        Generate a standalone quote with line items, labour, and payment methods.
      </Text>

      <Pressable onPress={go} className="bg-brand py-4 rounded-xl">
        <Text className="text-center text-white font-semibold text-base">
          Generate new quote
        </Text>
      </Pressable>
      <Text className="text-xs text-gray-500 text-center mt-2">
        Quotes from active jobs are available after you close them in Rex.
      </Text>
    </View>
  );
}
