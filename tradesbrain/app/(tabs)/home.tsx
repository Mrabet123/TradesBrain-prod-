// D2 Step 7, D6 Flow03 + Flow12 S10-S11 — Home with trial banner and the
// session-restoration amber banner (D6 Flow12 S10-S11). "Start a new job"
// CTA is the second Rex entry point per D6 Flow04 ENTRY POINTS.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { supabase } from '../../services/supabase';
import { useAuthContext } from '../../context/AuthContext';
import { useSubscriptionContext } from '../../context/SubscriptionContext';
import TrialBanner from '../../components/shared/TrialBanner';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ActiveSession {
  id: string;
  updated_at: string;
  message_count: number;
  job_name: string | null;
}

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuthContext();
  const { subscriptionStatus, trialQueriesRemaining } = useSubscriptionContext();
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('job_sessions')
        .select('id, updated_at, message_count, job_name')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActive(data ?? null);
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

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="pt-12 px-5 pb-6">
        <TrialBanner />

        {!loading && active && (
          <View className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
            <Text className="text-sm text-amber-800 font-semibold mb-1">
              Active session — {active.message_count} messages
            </Text>
            <Text className="text-xs text-amber-700 mb-3">
              {active.job_name ?? 'Untitled job'} · last updated{' '}
              {new Date(active.updated_at).toLocaleString()}
            </Text>
            <Pressable
              onPress={() => nav.navigate('Job', { sessionId: active.id })}
              className="bg-amber-500 py-3 rounded-lg"
            >
              <Text className="text-center text-white font-semibold">Continue session</Text>
            </Pressable>
          </View>
        )}

        <Text className="text-2xl font-bold text-gray-900">Welcome back</Text>
        <Text className="text-sm text-gray-500 mt-1">{user?.email}</Text>

        <View className="mt-6">
          <Pressable onPress={startNewJob} className="bg-brand py-4 rounded-xl mb-3">
            <Text className="text-center text-white font-semibold">Start a new job</Text>
          </Pressable>
          <Text className="text-xs text-gray-400 text-center">
            Rex tab also opens a new job session.
          </Text>
        </View>

        {loading && (
          <View className="mt-6 items-center">
            <ActivityIndicator />
          </View>
        )}

        <Pressable
          onPress={() => nav.navigate('Settings')}
          className="mt-10 py-3 rounded-xl border border-gray-300"
        >
          <Text className="text-center text-gray-700 font-semibold">Settings</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
