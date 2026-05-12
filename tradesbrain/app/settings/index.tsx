// D2 F8 / D6 Flow10 — Settings navigation hub.
// Six sections: Profile · Trade · Team · Subscription · Legal · Account.
// Team is hidden for solopreneurs without a Team plan (D3 F8 onboarding rules).
// Account section hosts Sign Out + Delete account.

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { useAuthContext } from '../../context/AuthContext';
import { useSubscriptionContext } from '../../context/SubscriptionContext';
import { supabase } from '../../services/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ProfileSummary {
  fullName: string;
  email: string;
  tradeType: string;
  accountType: 'solopreneur' | 'team_owner';
  companyName: string | null;
  national_id_kyc_status: string;
  license_kyc_status: string;
}

function kycBadgeTone(nid: string, lic: string) {
  if (nid === 'verified' && lic === 'verified')
    return { tone: 'bg-green-100 text-green-700', label: 'Verified' };
  if (nid === 'rejected' || lic === 'rejected')
    return { tone: 'bg-red-100 text-red-700', label: 'Action needed' };
  if (nid === 'pending' || lic === 'pending')
    return { tone: 'bg-amber-100 text-amber-700', label: 'Under review' };
  return { tone: 'bg-gray-100 text-gray-700', label: 'Not uploaded' };
}

export default function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const { user, signOut } = useAuthContext();
  const { planType } = useSubscriptionContext();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select(
        'full_name, email, trade_type, account_type, company_name, national_id_kyc_status, license_kyc_status',
      )
      .eq('id', user.id)
      .single();
    if (data) {
      setProfile({
        fullName: data.full_name,
        email: data.email,
        tradeType: data.trade_type,
        accountType: data.account_type,
        companyName: data.company_name,
        national_id_kyc_status: data.national_id_kyc_status,
        license_kyc_status: data.license_kyc_status,
      });
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const showTeamSection =
    profile?.accountType === 'team_owner' || planType === 'team';

  function onSignOut() {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  async function onDeleteConfirmed() {
    if (deleteText !== 'DELETE') return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', {});
      if (error) throw error;
      Alert.alert(
        'Account deleted',
        'All your data has been permanently removed.',
        [{ text: 'OK', onPress: () => signOut() }],
      );
    } catch (e: any) {
      Alert.alert(
        'Could not delete',
        e?.message ??
          'The delete-account Edge Function may not be deployed yet. Contact support.',
      );
    } finally {
      setDeleting(false);
      setDeleteMode(false);
      setDeleteText('');
    }
  }

  if (loading || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  const kyc = kycBadgeTone(
    profile.national_id_kyc_status,
    profile.license_kyc_status,
  );

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="pt-12 px-5 pb-10">
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => nav.goBack()}>
          <Text className="text-brand text-base">← Back</Text>
        </Pressable>
        <Text className="text-base font-semibold">Settings</Text>
        <View className="w-12" />
      </View>

      {/* Identity card */}
      <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <Text className="text-lg font-bold text-gray-900">{profile.fullName}</Text>
        <Text className="text-sm text-gray-500">{profile.email}</Text>
        <View className="flex-row items-center gap-2 mt-2">
          <View className="bg-brand/10 rounded-full px-2 py-0.5">
            <Text className="text-[11px] text-brand font-medium uppercase">
              {profile.tradeType}
            </Text>
          </View>
          <View className={`rounded-full px-2 py-0.5 ${kyc.tone.split(' ')[0]}`}>
            <Text className={`text-[11px] font-medium ${kyc.tone.split(' ')[1]}`}>
              KYC · {kyc.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Sections */}
      <Section
        label="Profile"
        sub="Name, company, hourly rate, KYC"
        onPress={() => nav.navigate('SettingsProfile')}
      />
      <Section
        label="Trade & account"
        sub={`${profile.tradeType} · ${profile.accountType === 'team_owner' ? 'Team Owner' : 'Solopreneur'}`}
        onPress={() => nav.navigate('SettingsTrade')}
      />
      {showTeamSection && (
        <Section
          label="Team"
          sub="Manage members and KPIs"
          onPress={() => nav.navigate('SettingsTeam')}
        />
      )}
      <Section
        label="Subscription"
        sub="Plan, billing, history"
        onPress={() => nav.navigate('SubscriptionSettings')}
      />
      <Section
        label="Legal"
        sub="Terms of Use & Privacy Policy"
        onPress={() => nav.navigate('SettingsLegal')}
      />

      {/* Account */}
      <Text className="text-xs uppercase text-gray-500 font-medium mt-4 mb-2">
        Account
      </Text>
      <Pressable
        onPress={onSignOut}
        className="py-4 rounded-xl border border-gray-300 mb-3"
      >
        <Text className="text-center text-gray-800 font-semibold">Sign out</Text>
      </Pressable>

      {!deleteMode ? (
        <Pressable
          onPress={() => setDeleteMode(true)}
          className="py-4 rounded-xl border border-red-300"
        >
          <Text className="text-center text-red-600 font-semibold">
            Delete account
          </Text>
        </Pressable>
      ) : (
        <View className="border border-red-300 rounded-xl p-4">
          <Text className="text-sm font-semibold text-red-700 mb-1">
            Delete your account
          </Text>
          <Text className="text-xs text-red-600 mb-3">
            All your jobs, reports, quotes, photos and account record will be
            permanently destroyed. Your subscription billing continues until the
            current period ends (per D2 F8).
          </Text>
          <Text className="text-xs text-gray-700 mb-1">
            Type <Text className="font-bold">DELETE</Text> exactly to confirm.
          </Text>
          <TextInput
            value={deleteText}
            onChangeText={setDeleteText}
            autoCapitalize="characters"
            className="border border-red-300 rounded-lg px-3 py-2 text-base mb-3 bg-white"
          />
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setDeleteMode(false);
                setDeleteText('');
              }}
              className="flex-1 py-3 rounded-lg border border-gray-300"
            >
              <Text className="text-center text-gray-700 font-semibold">
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onDeleteConfirmed}
              disabled={deleteText !== 'DELETE' || deleting}
              className={`flex-1 py-3 rounded-lg ${
                deleteText !== 'DELETE' || deleting ? 'bg-gray-300' : 'bg-red-600'
              }`}
            >
              <Text className="text-center text-white font-semibold">
                {deleting ? 'Deleting…' : 'Confirm'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Section({
  label,
  sub,
  onPress,
}: {
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 mb-2"
    >
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900">{label}</Text>
        <Text className="text-xs text-gray-500">{sub}</Text>
      </View>
      <Text className="text-gray-400 text-xl">›</Text>
    </Pressable>
  );
}
