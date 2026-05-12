// D3 F2 Path B / D6 Flow05 — Report tab entry.
// Tapping Generate report opens the builder with no sessionId (standalone).
// SubscriptionGate is enforced: paywall navigation when no access.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { useSubscriptionContext } from '../../context/SubscriptionContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ReportScreen() {
  const nav = useNavigation<Nav>();
  const { subscriptionStatus, trialQueriesRemaining } = useSubscriptionContext();
  const hasAccess =
    subscriptionStatus === 'active' ||
    (subscriptionStatus === 'trial' && trialQueriesRemaining > 0);

  function go() {
    if (!hasAccess) nav.navigate('Paywall');
    else nav.navigate('ReportBuilder', {});
  }

  return (
    <View className="flex-1 bg-white pt-12 px-5">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Reports</Text>
      <Text className="text-sm text-gray-600 mb-6">
        Generate a standalone report — Rex will ask for the full job description.
      </Text>

      <Pressable onPress={go} className="bg-brand py-4 rounded-xl">
        <Text className="text-center text-white font-semibold text-base">
          Generate new report
        </Text>
      </Pressable>
      <Text className="text-xs text-gray-500 text-center mt-2">
        Reports from active jobs are available after you close them in Rex.
      </Text>
    </View>
  );
}
