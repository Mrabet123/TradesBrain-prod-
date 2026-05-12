// D3 F6 / BuildGuide M6 RULE 4 — Trial banner with three colour states.
// Never shows the exact remaining count (no "10", no "2"). The colour and the
// CTA text shift as the trial runs out; the actual number lives only in the DB.
//   • subscription_status === 'trial' && remaining ≥ 3  → blue, neutral copy
//   • subscription_status === 'trial' && remaining ≤ 2  → orange, urgency copy
//   • subscription_status === 'trial' && remaining = 0  → renders nothing (the
//     paywall is fired by SubscriptionGate before any feature opens)
//   • Any other status                                  → renders nothing

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../app/_layout';
import { useSubscriptionContext } from '../../context/SubscriptionContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function TrialBanner() {
  const nav = useNavigation<Nav>();
  const { subscriptionStatus, trialQueriesRemaining } = useSubscriptionContext();
  const [dismissed, setDismissed] = useState(false);

  if (subscriptionStatus !== 'trial') return null;
  if (trialQueriesRemaining <= 0) return null;
  if (dismissed) return null;

  const urgent = trialQueriesRemaining <= 2;

  const tone = urgent
    ? {
        wrapper: 'bg-orange-50 border-orange-300',
        title: 'text-orange-800',
        cta: 'bg-orange-500',
      }
    : {
        wrapper: 'bg-brand/10 border-brand/30',
        title: 'text-brand',
        cta: 'bg-brand',
      };

  return (
    <View
      className={`rounded-lg p-3 mb-4 border flex-row items-center justify-between ${tone.wrapper}`}
    >
      <View className="flex-1 mr-3">
        <Text className={`text-sm font-semibold ${tone.title}`}>
          {urgent ? 'Trial ending soon' : 'Free trial active'}
        </Text>
        <Text className={`text-xs ${tone.title}`}>
          {urgent
            ? 'Subscribe to keep Rex on every job.'
            : 'No card needed. Rex stays available.'}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => nav.navigate('Paywall')}
          className={`px-3 py-2 rounded-lg ${tone.cta}`}
        >
          <Text className="text-white text-xs font-semibold">
            {urgent ? 'Subscribe' : 'See plans'}
          </Text>
        </Pressable>
        {!urgent && (
          <Pressable onPress={() => setDismissed(true)}>
            <Text className={`${tone.title} font-semibold text-xs`}>Dismiss</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
