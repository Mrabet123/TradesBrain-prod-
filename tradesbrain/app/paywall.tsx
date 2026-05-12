// D6 Flow09 / D3 F6 — Paywall.
// 3 plan cards (Solo / Pro / Team), monthly/annual toggle (20% off annual).
// KYC gate: subscribe blocked if national_id or license not 'verified'.
// PaymentSheet flow via services/payments.purchaseSubscription.
// On success: optimisticActivate + dismiss. The session underneath is preserved
// because Paywall is presented as a modal (RULE 8).

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './_layout';
import { PRICING } from '../constants/pricing';
import { useSubscriptionContext } from '../context/SubscriptionContext';
import { useAuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { purchaseSubscription, type BillingCycle, type PlanType } from '../services/payments';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface PlanCardSpec {
  value: PlanType;
  label: string;
  tagline: string;
  perks: string[];
}

const PLANS: PlanCardSpec[] = [
  {
    value: 'solo',
    label: 'Solo',
    tagline: 'For independent pros.',
    perks: ['1 user', 'Unlimited Rex queries', 'Reports + quotes', 'Trade code lookup'],
  },
  {
    value: 'pro',
    label: 'Pro',
    tagline: 'Heavy daily use.',
    perks: ['1 user', 'Unlimited Rex queries', 'Priority responses', 'Reports + quotes'],
  },
  {
    value: 'team',
    label: 'Team',
    tagline: 'Owner + crew.',
    perks: [
      'Owner + 2 members (base)',
      'Per-seat scaling',
      'Team KPI dashboard',
      'All Solo + Pro features',
    ],
  },
];

export default function PaywallScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Paywall'>>();
  const { user } = useAuthContext();
  const { optimisticActivate, refreshSubscription } = useSubscriptionContext();

  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [busyPlan, setBusyPlan] = useState<PlanType | null>(null);
  const [kycReady, setKycReady] = useState<boolean | null>(null);
  const [kycMessage, setKycMessage] = useState<string>('Checking verification status…');

  // Highlight the preselected plan card (D6 Flow10_S7 — upgrade path lands on
  // paywall with Team pre-selected).
  const preselectedPlan = route.params?.preselectedPlan ?? null;

  // KYC gate check
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('national_id_kyc_status, license_kyc_status')
        .eq('id', user.id)
        .single();
      if (!data) {
        setKycReady(false);
        setKycMessage('Could not load verification status.');
        return;
      }
      const nid = data.national_id_kyc_status;
      const lic = data.license_kyc_status;
      if (nid === 'verified' && lic === 'verified') {
        setKycReady(true);
        setKycMessage('Identity verified.');
      } else if (nid === 'rejected' || lic === 'rejected') {
        setKycReady(false);
        setKycMessage(
          `${nid === 'rejected' ? 'National ID' : 'License'} rejected — re-upload from Settings.`,
        );
      } else if (nid === 'pending' || lic === 'pending') {
        setKycReady(false);
        setKycMessage('Documents under review — usually within 24 hours.');
      } else {
        setKycReady(false);
        setKycMessage('Documents required before subscribing.');
      }
    })();
  }, [user]);

  async function onSubscribe(plan: PlanType) {
    if (busyPlan) return;
    setBusyPlan(plan);
    const result = await purchaseSubscription(plan, cycle);
    setBusyPlan(null);

    if (result.ok) {
      // RULE 6 — optimistic activation, webhook reconciles
      optimisticActivate(plan);
      refreshSubscription();
      Alert.alert('Welcome aboard', 'Your subscription is active. Rex is unlocked.', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
      return;
    }

    switch (result.reason) {
      case 'kyc_required':
        Alert.alert(
          'Verification needed',
          'Your KYC documents must be verified before subscribing.',
        );
        break;
      case 'already_subscribed':
        Alert.alert('Already subscribed', 'You already have an active subscription.');
        refreshSubscription();
        nav.goBack();
        break;
      case 'declined':
        Alert.alert(
          'Payment declined',
          'Your card was declined. Try a different card or contact your bank.',
        );
        break;
      case 'network':
        Alert.alert('No connection', 'Check your network and try again.');
        break;
      default:
        if (result.message && result.message !== 'Cancelled') {
          Alert.alert('Could not start checkout', result.message);
        }
    }
  }

  return (
    <View className="flex-1 bg-white pt-12">
      <View className="px-5 pb-3 flex-row items-center justify-between">
        <Pressable onPress={() => nav.goBack()}>
          <Text className="text-gray-500 text-base">Close</Text>
        </Pressable>
        <Text className="text-base font-semibold">Choose your plan</Text>
        <View className="w-12" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* Billing cycle toggle — inline styles to avoid NativeWind shadow-sm crash on new arch */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#F3F4F6',
            borderRadius: 12,
            padding: 4,
            marginBottom: 16,
            alignSelf: 'center',
          }}
        >
          {(['monthly', 'annual'] as BillingCycle[]).map((c) => {
            const active = cycle === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCycle(c)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: active ? '#2E75B6' : '#4B5563',
                    fontWeight: active ? '600' : '400',
                  }}
                >
                  {c === 'monthly' ? 'Monthly' : 'Annual · 20% off'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* KYC gate banner */}
        {kycReady === false && (
          <View className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
            <Text className="text-sm text-amber-800 font-semibold">
              Verification required
            </Text>
            <Text className="text-xs text-amber-700">{kycMessage}</Text>
          </View>
        )}
        {kycReady === null && (
          <View className="flex-row items-center justify-center mb-4">
            <ActivityIndicator size="small" />
            <Text className="text-xs text-gray-500 ml-2">Checking verification…</Text>
          </View>
        )}

        {/* Plan cards */}
        {PLANS.map((p) => {
          const price = PRICING[p.value];
          const display =
            cycle === 'monthly'
              ? `$${price.monthly.toFixed(2)}/month`
              : `$${price.monthlyEquivalent.toFixed(2)}/month`;
          const annualTotal =
            cycle === 'annual' ? `Billed $${price.annual.toFixed(2)}/year` : null;
          const busy = busyPlan === p.value;
          const disabled = !kycReady || busy;
          const highlighted = preselectedPlan === p.value;
          return (
            <View
              key={p.value}
              className={`rounded-2xl p-4 mb-3 bg-white border ${
                highlighted ? 'border-brand border-2' : 'border-gray-200'
              }`}
            >
              <View className="flex-row items-baseline justify-between mb-1">
                <Text className="text-xl font-bold text-gray-900">{p.label}</Text>
                <Text className="text-base font-semibold text-brand">{display}</Text>
              </View>
              <Text className="text-xs text-gray-500 mb-2">{p.tagline}</Text>
              {annualTotal && (
                <Text className="text-xs text-green-700 mb-2">{annualTotal}</Text>
              )}
              {p.perks.map((perk) => (
                <Text key={perk} className="text-sm text-gray-700">
                  • {perk}
                </Text>
              ))}
              <Pressable
                onPress={() => onSubscribe(p.value)}
                disabled={disabled}
                className={`mt-4 py-3 rounded-xl ${disabled ? 'bg-gray-300' : 'bg-brand'}`}
              >
                <Text className="text-center text-white font-semibold">
                  {busy ? 'Opening checkout…' : `Subscribe to ${p.label}`}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {/* Team seat note */}
        <Text className="text-xs text-gray-500 text-center mt-2">
          Team plan adds seats at ${PRICING.seat.monthly.toFixed(2)}/month
          (${PRICING.seat.monthlyEquivalent.toFixed(2)} on annual) beyond the base of 3.
        </Text>

        <Text className="text-xs text-gray-400 text-center mt-6">
          Apple Pay and Google Pay available at checkout. Cancel any time — access
          continues until the end of the period.
        </Text>
      </ScrollView>
    </View>
  );
}

