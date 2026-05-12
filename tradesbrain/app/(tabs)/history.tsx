// D3 F5 / D6 Flow08 — History tab.
// Reverse-chronological list of confirmed-closed sessions. Filtered by
// services/history.fetchHistorySessions to "completed/reopened AND has
// confirmed doc". Search by job name / jobsite. Inline rename. Skeleton
// loading. Empty state with "Start first job" CTA.
// Accessible even when subscription is expired (RULE 6).

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';

import { useAuthContext } from '../../context/AuthContext';
import {
  fetchHistorySessions,
  updateJobName,
  type HistoryJob,
} from '../../services/history';
import JobCard from '../../components/history/JobCard';
import SkeletonCard from '../../components/history/SkeletonCard';
import EmptyState from '../../components/history/EmptyState';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HistoryScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuthContext();
  const [jobs, setJobs] = useState<HistoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const reload = useCallback(async () => {
    if (!user) return;
    const rows = await fetchHistorySessions(user.id, search);
    setJobs(rows);
    setLoading(false);
  }, [user, search]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reload();
    }, [reload]),
  );

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(reload, 250); // debounce search input
    return () => clearTimeout(t);
  }, [search, reload, user]);

  async function rename(jobId: string, name: string) {
    await updateJobName(jobId, name);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, jobName: name } : j)));
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pt-12 pb-10"
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
      <Text className="text-2xl font-bold text-gray-900 mb-1">Job History</Text>
      <Text className="text-sm text-gray-600 mb-4">
        Only confirmed-closed jobs appear here.
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search job name or address"
        className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-4"
      />

      {loading ? (
        <View>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : jobs.length === 0 ? (
        <EmptyState
          onStartFirstJob={() => nav.navigate('Job', { sessionId: 'new' })}
        />
      ) : (
        jobs.map((j) => (
          <JobCard
            key={j.id}
            job={j}
            onPress={() => nav.navigate('JobDetail', { jobId: j.id })}
            onRename={(name) => rename(j.id, name)}
          />
        ))
      )}
    </ScrollView>
  );
}
