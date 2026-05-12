// D6 Flow10 — Legal section. Terms + Privacy text (read-only) and the
// acceptance record (date + version) from users.terms_accepted_at /
// terms_version.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { useAuthContext } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Acceptance {
  acceptedAt: string;
  version: string;
}

export default function LegalScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuthContext();
  const [acceptance, setAcceptance] = useState<Acceptance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('terms_accepted_at, terms_version')
        .eq('id', user.id)
        .single();
      if (data) {
        setAcceptance({
          acceptedAt: data.terms_accepted_at,
          version: data.terms_version,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="pt-12 px-5 pb-10">
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => nav.goBack()}>
          <Text className="text-brand text-base">← Back</Text>
        </Pressable>
        <Text className="text-base font-semibold">Legal</Text>
        <View className="w-12" />
      </View>

      {acceptance && (
        <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <Text className="text-sm font-semibold text-green-800">
            Accepted on {new Date(acceptance.acceptedAt).toLocaleDateString()}
          </Text>
          <Text className="text-xs text-green-700">
            Version {acceptance.version} · legal record locked
          </Text>
        </View>
      )}

      <Text className="text-lg font-bold text-gray-900 mb-2">Terms of Use</Text>
      <Text className="text-sm text-gray-700 leading-5 mb-4">
        TradesBrain is an AI co-pilot for licensed trade professionals. Rex
        provides guidance; final professional judgement and on-site liability
        rest with the licensed worker. Use of TradesBrain assumes the worker is
        appropriately licensed and insured for the work performed.
      </Text>
      <Text className="text-sm text-gray-700 leading-5 mb-4">
        Subscription billing is handled by Stripe. Subscriptions auto-renew
        until cancelled. Cancellation grants access until the end of the current
        billing period.
      </Text>
      <Text className="text-sm text-gray-700 leading-5 mb-4">
        VAT and license details are permanently locked after sign-up for
        compliance integrity. Contact support to correct a verified document.
      </Text>
      <Text className="text-sm text-gray-700 leading-5 mb-4">
        Downgrading from Team plan to Solo plan permanently deletes all team
        member accounts and their data. This is irreversible.
      </Text>

      <Text className="text-lg font-bold text-gray-900 mb-2">Privacy Policy</Text>
      <Text className="text-sm text-gray-700 leading-5 mb-4">
        TradesBrain stores jobsite photos, voice transcripts and conversation
        history solely to provide Rex's service. Your data is never sold.
        Aggregated, anonymised usage telemetry may be used to improve the
        product.
      </Text>
      <Text className="text-sm text-gray-700 leading-5 mb-4">
        Identity documents are stored in encrypted Supabase Storage and visible
        only to you. Identity verification is performed by Stripe Identity per
        their privacy policy.
      </Text>

      <Text className="text-xs text-gray-400 text-center mt-4">
        Full legal text is available at tradesbrain.app/legal.
      </Text>
    </ScrollView>
  );
}
