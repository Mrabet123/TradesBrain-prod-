// D3 F6 / D6 Flow09 — Subscription settings.
// Current plan + days remaining (calculate-days-remaining Edge Function),
// switch billing cycle, change plan, cancel (continues until end date),
// restore purchase, billing history list.

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';

import { useAuthContext } from '../../context/AuthContext';
import { useSubscriptionContext } from '../../context/SubscriptionContext';
import { supabase } from '../../services/supabase';
import { calculateDaysRemaining } from '../../services/stripe';
import {
  switchBillingCycle,
  changePlan,
  cancelSubscription,
  restoreSubscription,
} from '../../services/payments';
import { PRICING } from '../../constants/pricing';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface DaysRemaining {
  days: number | null;
  endDate: string | null;
  endDateFormatted?: string;
}

interface SubscriptionRow {
  id: string;
  plan_type: 'solo' | 'pro' | 'team';
  status: string;
  billing_cycle: 'monthly' | 'annual';
  seat_count: number;
  monthly_amount: number;
  current_period_end: string;
  cancelled_at: string | null;
}

interface BillingRow {
  id: string;
  stripe_invoice_id: string;
  amount_paid: number;
  plan_type: string;
  billing_period_start: string;
  billing_period_end: string;
  invoice_pdf_url: string | null;
  paid_at: string;
}

export default function SubscriptionSettingsScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuthContext();
  const { subscriptionStatus, planType, refreshSubscription } = useSubscriptionContext();

  const [sub, setSub] = useState<SubscriptionRow | null>(null);
  const [bills, setBills] = useState<BillingRow[]>([]);
  const [days, setDays] = useState<DaysRemaining>({ days: null, endDate: null });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [subRes, billsRes, daysRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('billing_history')
        .select('*')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false }),
      calculateDaysRemaining(),
    ]);

    setSub((subRes.data as SubscriptionRow) ?? null);
    setBills((billsRes.data as BillingRow[]) ?? []);
    if (daysRes.success && daysRes.data) {
      setDays({
        days: daysRes.data.days_remaining ?? null,
        endDate: daysRes.data.end_date ?? null,
        endDateFormatted: daysRes.data.end_date_formatted,
      });
    }
    await refreshSubscription();
    setLoading(false);
  }, [user, refreshSubscription]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  async function withBusy(fn: () => Promise<{ success: boolean; error?: string }>): Promise<void> {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.success) {
      Alert.alert('Could not complete', r.error ?? 'Unknown error');
      return;
    }
    await reload();
  }

  async function onSwitchCycle() {
    if (!sub) return;
    const target = sub.billing_cycle === 'monthly' ? 'annual' : 'monthly';
    Alert.alert(
      target === 'annual' ? 'Switch to annual (20% off)?' : 'Switch to monthly?',
      target === 'annual'
        ? 'Saves about 20% — billing cycle anchors to today.'
        : 'Switches back to monthly at next renewal.',
      [
        { text: 'Cancel' },
        { text: 'Switch', onPress: () => withBusy(() => switchBillingCycle(target)) },
      ],
    );
  }

  async function onCancel() {
    Alert.alert(
      'Cancel subscription?',
      `Access continues until ${days.endDateFormatted ?? 'your period end'}. You can restore anytime before then.`,
      [
        { text: 'Keep subscription' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => withBusy(() => cancelSubscription()),
        },
      ],
    );
  }

  async function onRestore() {
    Alert.alert('Restore subscription?', 'Re-activates your current plan immediately.', [
      { text: 'Cancel' },
      { text: 'Restore', onPress: () => withBusy(() => restoreSubscription()) },
    ]);
  }

  async function onChangePlan(target: 'solo' | 'pro' | 'team') {
    if (!sub || target === sub.plan_type) return;
    Alert.alert(
      'Change plan?',
      `Switches to ${target.toUpperCase()}. Stripe prorates the difference.`,
      [{ text: 'Cancel' }, { text: 'Switch', onPress: () => withBusy(() => changePlan(target)) }],
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pt-12 pb-10">
      <View className="flex-row items-center justify-between mb-2">
        <Pressable onPress={() => nav.goBack()}>
          <Text className="text-brand text-base">← Back</Text>
        </Pressable>
        <Text className="text-base font-semibold">Subscription</Text>
        <View className="w-12" />
      </View>

      {/* No active sub → CTA */}
      {!sub || subscriptionStatus === 'trial' ? (
        <View className="bg-brand/10 border border-brand/30 rounded-xl p-4 mb-4">
          <Text className="text-base font-semibold text-brand mb-1">
            Free trial
          </Text>
          <Text className="text-sm text-brand mb-3">
            Subscribe to keep Rex available beyond your trial.
          </Text>
          <Pressable
            onPress={() => nav.navigate('Paywall')}
            className="bg-brand py-3 rounded-lg"
          >
            <Text className="text-center text-white font-semibold">See plans</Text>
          </Pressable>
        </View>
      ) : (
        <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <Text className="text-xs uppercase text-brand font-medium mb-1">
            Current plan
          </Text>
          <Text className="text-2xl font-bold text-gray-900 mb-1">
            {sub.plan_type.toUpperCase()}
          </Text>
          <Text className="text-sm text-gray-600 mb-1">
            ${sub.monthly_amount.toFixed(2)}/month · {sub.billing_cycle}
            {sub.seat_count > 1 ? ` · ${sub.seat_count} seats` : ''}
          </Text>
          <Text className="text-xs text-gray-500 mb-3">
            {sub.cancelled_at
              ? `Cancelled — access ends ${days.endDateFormatted ?? new Date(sub.current_period_end).toLocaleDateString()}`
              : `Renews ${days.endDateFormatted ?? new Date(sub.current_period_end).toLocaleDateString()}${days.days != null ? ` · ${days.days} days left` : ''}`}
          </Text>

          {sub.cancelled_at ? (
            <Pressable
              onPress={onRestore}
              disabled={busy}
              className={`py-3 rounded-lg ${busy ? 'bg-gray-300' : 'bg-brand'}`}
            >
              <Text className="text-center text-white font-semibold">
                {busy ? 'Working…' : 'Restore subscription'}
              </Text>
            </Pressable>
          ) : (
            <View className="gap-2">
              <Pressable
                onPress={onSwitchCycle}
                disabled={busy}
                className="py-3 rounded-lg border border-brand"
              >
                <Text className="text-center text-brand font-semibold">
                  {sub.billing_cycle === 'monthly'
                    ? 'Switch to annual (save 20%)'
                    : 'Switch to monthly'}
                </Text>
              </Pressable>
              <Pressable
                onPress={onCancel}
                disabled={busy}
                className="py-3 rounded-lg border border-red-400"
              >
                <Text className="text-center text-red-600 font-semibold">
                  Cancel subscription
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Plan switch */}
      {sub && !sub.cancelled_at && (
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Change plan
          </Text>
          <View className="flex-row gap-2">
            {(['solo', 'pro', 'team'] as const).map((p) => {
              const on = sub.plan_type === p;
              const price = PRICING[p];
              return (
                <Pressable
                  key={p}
                  disabled={on || busy}
                  onPress={() => onChangePlan(p)}
                  className={`flex-1 py-3 rounded-lg border ${
                    on
                      ? 'border-brand bg-brand/10'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  <Text
                    className={`text-center text-sm font-semibold ${
                      on ? 'text-brand' : 'text-gray-700'
                    }`}
                  >
                    {p.toUpperCase()}
                  </Text>
                  <Text className="text-center text-xs text-gray-500">
                    ${price.monthly}/mo
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Billing history */}
      <Text className="text-sm font-semibold text-gray-700 mb-2">
        Billing history
      </Text>
      {bills.length === 0 ? (
        <Text className="text-sm text-gray-500 italic">
          No invoices yet.
        </Text>
      ) : (
        bills.map((b) => (
          <View
            key={b.id}
            className="bg-white border border-gray-200 rounded-xl p-3 mb-2 flex-row items-center justify-between"
          >
            <View className="flex-1 mr-3">
              <Text className="text-sm font-semibold text-gray-900">
                ${b.amount_paid.toFixed(2)} · {b.plan_type.toUpperCase()}
              </Text>
              <Text className="text-xs text-gray-500">
                {new Date(b.paid_at).toLocaleDateString()} ·{' '}
                {new Date(b.billing_period_start).toLocaleDateString()} →{' '}
                {new Date(b.billing_period_end).toLocaleDateString()}
              </Text>
            </View>
            {b.invoice_pdf_url ? (
              <Pressable onPress={() => Linking.openURL(b.invoice_pdf_url!)}>
                <Text className="text-brand font-semibold text-xs">View</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}
