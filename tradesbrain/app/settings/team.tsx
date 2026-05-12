// D3 F8 / D6 Flow11 — Team Management hub.
// Visible ONLY when the owner is on a Team plan AND has account_type='team_owner'
// (RULE 1 — settings/index controls navigation; this screen also defends in depth).
// KPI dashboard + members list + Add CTA (disabled at TEAM_MAX_SEATS = 10).

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { useAuthContext } from '../../context/AuthContext';
import { useSubscriptionContext } from '../../context/SubscriptionContext';
import {
  fetchTeamKpis,
  listMembers,
  removeMember,
  type TeamMember,
} from '../../services/team';
import { TEAM_MAX_SEATS, type KpiPeriod, type TeamKpiSnapshot } from '../../constants/teamMetrics';
import KpiDashboard from '../../components/team/KpiDashboard';
import MemberCard from '../../components/team/MemberCard';
import SkeletonCard from '../../components/history/SkeletonCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const EMPTY_SNAPSHOT: TeamKpiSnapshot = {
  perMember: [],
  total: { sessions: 0, reports: 0, quotes: 0, revenue: 0, photos: 0, hoursOnSite: 0 },
};

export default function TeamSettingsScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuthContext();
  const { planType, subscriptionStatus } = useSubscriptionContext();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [kpis, setKpis] = useState<TeamKpiSnapshot>(EMPTY_SNAPSHOT);
  const [period, setPeriod] = useState<KpiPeriod>('weekly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const allowed = planType === 'team' && subscriptionStatus === 'active';

  const reload = useCallback(async () => {
    if (!user || !allowed) {
      setLoading(false);
      return;
    }
    const [ms, snap] = await Promise.all([
      listMembers(user.id),
      fetchTeamKpis(user.id, period),
    ]);
    setMembers(ms);
    setKpis(snap);
    setLoading(false);
  }, [user, allowed, period]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reload();
    }, [reload]),
  );

  // Re-fetch KPIs when period changes
  useEffect(() => {
    if (!user || !allowed) return;
    fetchTeamKpis(user.id, period).then(setKpis);
  }, [period, user, allowed]);

  const atCap = members.length >= TEAM_MAX_SEATS;

  function onAdd() {
    if (atCap) return;
    nav.navigate('TeamAdd');
  }

  function confirmRemove(member: TeamMember) {
    Alert.alert(
      `Delete ${member.fullName}?`,
      'All of this member\'s sessions, reports, quotes and photos are destroyed. Stripe seat is removed and your team bill drops on the next invoice.',
      [
        { text: 'Cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setRemovingId(member.memberId);
            const result = await removeMember(member.memberId);
            setRemovingId(null);
            if (!result.ok) {
              Alert.alert(
                'Could not delete',
                result.error?.includes('not deployed')
                  ? 'delete-team-member Edge Function is not deployed yet.'
                  : result.error ?? 'Unknown error',
              );
              return;
            }
            await reload();
          },
        },
      ],
    );
  }

  if (!allowed) {
    return (
      <View className="flex-1 bg-white pt-12 px-5">
        <View className="flex-row items-center justify-between mb-4">
          <Pressable onPress={() => nav.goBack()}>
            <Text className="text-brand text-base">← Back</Text>
          </Pressable>
          <Text className="text-base font-semibold">Team Management</Text>
          <View className="w-12" />
        </View>
        <View className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <Text className="text-sm font-semibold text-amber-800 mb-1">
            Team plan required
          </Text>
          <Text className="text-xs text-amber-700 mb-3">
            Upgrade to the Team plan to add members and view team KPIs.
          </Text>
          <Pressable
            onPress={() => nav.navigate('Paywall', { preselectedPlan: 'team' })}
            className="bg-amber-500 py-3 rounded-lg"
          >
            <Text className="text-center text-white font-semibold">See Team plan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    // D6 Flow12 S21 — KPI + members skeleton.
    return (
      <View className="flex-1 bg-white pt-12 px-5">
        <View className="h-6 bg-gray-200 rounded w-40 mb-4" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="pt-12 px-5 pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await reload();
            setRefreshing(false);
          }}
        />
      }
    >
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => nav.goBack()}>
          <Text className="text-brand text-base">← Back</Text>
        </Pressable>
        <Text className="text-base font-semibold">Team Management</Text>
        <View className="w-12" />
      </View>

      <KpiDashboard period={period} onPeriodChange={setPeriod} snapshot={kpis} />

      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-semibold text-gray-700">
          Members ({members.length} / {TEAM_MAX_SEATS})
        </Text>
        <Pressable
          onPress={onAdd}
          disabled={atCap}
          className={`px-3 py-2 rounded-lg ${atCap ? 'bg-gray-300' : 'bg-brand'}`}
        >
          <Text className="text-white text-sm font-semibold">+ Add member</Text>
        </Pressable>
      </View>

      {atCap && (
        <View className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 mb-3">
          <Text className="text-xs text-amber-700">
            Maximum of {TEAM_MAX_SEATS} members reached.
          </Text>
        </View>
      )}

      {members.length === 0 ? (
        <Text className="text-sm text-gray-500 italic mt-4">
          No members yet. Tap Add member to invite your first technician.
        </Text>
      ) : (
        members.map((m) => (
          <MemberCard
            key={m.memberId}
            member={m}
            onPress={() => nav.navigate('TeamMemberDetail', { memberId: m.memberId })}
            onDeleteRequest={() => confirmRemove(m)}
          />
        ))
      )}

      {removingId && (
        <View className="mt-6 items-center">
          <ActivityIndicator />
          <Text className="text-xs text-gray-500 mt-2">Removing member…</Text>
        </View>
      )}
    </ScrollView>
  );
}
