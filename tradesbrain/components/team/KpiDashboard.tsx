// D3 F8 / D6 Flow11 — KPI Dashboard.
// 6 metrics × 3 periods. Aggregate card on top, per-member rows below.

import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { PERIODS, type KpiPeriod, type TeamKpiSnapshot } from '../../constants/teamMetrics';

interface Props {
  period: KpiPeriod;
  onPeriodChange: (p: KpiPeriod) => void;
  snapshot: TeamKpiSnapshot;
  loading?: boolean;
}

export default function KpiDashboard({ period, onPeriodChange, snapshot, loading }: Props) {
  return (
    <View className="mb-4">
      {/* Period toggle */}
      <View className="flex-row bg-gray-100 rounded-xl p-1 mb-3 self-start">
        {PERIODS.map((p) => (
          <Pressable
            key={p.value}
            onPress={() => onPeriodChange(p.value)}
            className={`px-3 py-1.5 rounded-lg ${period === p.value ? 'bg-white shadow-sm' : ''}`}
          >
            <Text
              className={`text-xs ${
                period === p.value ? 'text-brand font-semibold' : 'text-gray-600'
              }`}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Aggregate card */}
      <View className="bg-brand/5 border border-brand/30 rounded-2xl p-4 mb-3">
        <Text className="text-xs uppercase text-brand font-medium mb-2">
          Team total {loading ? '…' : ''}
        </Text>
        <View className="flex-row flex-wrap">
          <MetricTile label="Sessions" value={String(snapshot.total.sessions)} />
          <MetricTile label="Reports" value={String(snapshot.total.reports)} />
          <MetricTile label="Quotes" value={String(snapshot.total.quotes)} />
          <MetricTile label="Revenue" value={`$${snapshot.total.revenue.toFixed(0)}`} />
          <MetricTile label="Photos" value={String(snapshot.total.photos)} />
          <MetricTile label="On-site" value={`${snapshot.total.hoursOnSite.toFixed(1)} h`} />
        </View>
      </View>

      {/* Per-member rows */}
      {snapshot.perMember.length > 0 && (
        <>
          <Text className="text-xs uppercase text-gray-500 font-medium mb-2">
            By member
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {snapshot.perMember.map((m) => (
              <View
                key={m.memberId}
                className="bg-white border border-gray-200 rounded-xl p-3 mr-2 min-w-[160px]"
              >
                <Text className="text-sm font-semibold text-gray-900 mb-2" numberOfLines={1}>
                  {m.fullName}
                </Text>
                <Text className="text-xs text-gray-500">Sessions {m.sessions}</Text>
                <Text className="text-xs text-gray-500">Reports {m.reports}</Text>
                <Text className="text-xs text-gray-500">Quotes {m.quotes}</Text>
                <Text className="text-xs text-gray-500">Revenue ${m.revenue.toFixed(0)}</Text>
                <Text className="text-xs text-gray-500">Photos {m.photos}</Text>
                <Text className="text-xs text-gray-500">On-site {m.hoursOnSite.toFixed(1)} h</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/3 mb-2">
      <Text className="text-xl font-bold text-brand">{value}</Text>
      <Text className="text-[11px] uppercase text-gray-500">{label}</Text>
    </View>
  );
}
