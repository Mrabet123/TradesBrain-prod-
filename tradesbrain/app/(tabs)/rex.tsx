// D6 Flow04 — Rex tab entry.
// If there's an active session: amber "Continue session" banner + start new option.
// Otherwise: "Start a new job" button. SubscriptionGate wraps the New Job CTA.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { supabase } from '../../services/supabase';
import { useAuthContext } from '../../context/AuthContext';
import { useSubscriptionContext } from '../../context/SubscriptionContext';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RexScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuthContext();
  const { subscriptionStatus, trialQueriesRemaining } = useSubscriptionContext();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('job_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveSessionId(data?.id ?? null);
      setLoading(false);
    })();
  }, [user]);

  const hasAccess =
    subscriptionStatus === 'active' ||
    (subscriptionStatus === 'trial' && trialQueriesRemaining > 0);

  function startNewJob() {
    if (!hasAccess) {
      nav.navigate('Paywall');
      return;
    }
    nav.navigate('Job', { sessionId: 'new' });
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white pt-12 px-5">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Rex</Text>
      <Text className="text-sm text-gray-600 mb-6">Your AI co-pilot on this job.</Text>

      {activeSessionId && (
        <View className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
          <Text className="text-sm text-amber-800 font-semibold mb-1">
            You have an active session
          </Text>
          <Text className="text-xs text-amber-700 mb-3">
            Rex will recap before continuing.
          </Text>
          <Pressable
            onPress={() => nav.navigate('Job', { sessionId: activeSessionId })}
            className="bg-amber-500 py-3 rounded-lg"
          >
            <Text className="text-center text-white font-semibold">Continue session</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={startNewJob}
        className="bg-brand py-4 rounded-xl"
      >
        <Text className="text-center text-white font-semibold text-base">Start a new job</Text>
      </Pressable>
      {!hasAccess && (
        <Text className="text-xs text-gray-500 text-center mt-2">
          Free trial exhausted — subscribe to continue.
        </Text>
      )}
    </View>
  );
}
