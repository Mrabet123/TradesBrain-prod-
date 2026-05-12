// D6 Flow11 — Member card.
// Badges: Active · First login pending · KYC pending · KYC rejected.
// Long-press → confirm delete (D6 calls for swipe-left, but long-press is a
// dep-free fallback that maps cleanly to the same destructive action.
// react-native-gesture-handler's Swipeable is the future-polish swap).

import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import type { TeamMember } from '../../services/team';

interface Props {
  member: TeamMember;
  onPress: () => void;
  onDeleteRequest: () => void;
}

export default function MemberCard({ member, onPress, onDeleteRequest }: Props) {
  function onLongPress() {
    Alert.alert(member.fullName, undefined, [
      { text: 'Cancel' },
      {
        text: 'Delete member',
        style: 'destructive',
        onPress: onDeleteRequest,
      },
    ]);
  }

  const kycPending =
    member.nationalIdKycStatus === 'pending' || member.licenseKycStatus === 'pending';
  const kycRejected =
    member.nationalIdKycStatus === 'rejected' || member.licenseKycStatus === 'rejected';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      className="bg-white border border-gray-200 rounded-xl p-4 mb-2"
    >
      <View className="flex-row items-start justify-between mb-1">
        <View className="flex-1 mr-2">
          <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
            {member.fullName}
          </Text>
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            {member.tradeType} · {member.email}
          </Text>
        </View>
        {member.isActive ? (
          <View className="bg-green-100 rounded-full px-2 py-0.5">
            <Text className="text-[10px] text-green-700 font-semibold uppercase">
              Active
            </Text>
          </View>
        ) : (
          <View className="bg-gray-100 rounded-full px-2 py-0.5">
            <Text className="text-[10px] text-gray-700 font-semibold uppercase">
              Inactive
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row flex-wrap gap-1 mt-1">
        {member.temporaryPasswordSet && (
          <Badge tone="amber" label="First login pending" />
        )}
        {kycRejected && <Badge tone="red" label="KYC rejected" />}
        {kycPending && !kycRejected && <Badge tone="amber" label="KYC pending" />}
      </View>

      <Text className="text-[10px] text-gray-400 mt-2">
        Long-press to delete
      </Text>
    </Pressable>
  );
}

function Badge({
  tone,
  label,
}: {
  tone: 'amber' | 'red' | 'green';
  label: string;
}) {
  const palette =
    tone === 'amber'
      ? { bg: 'bg-amber-100', fg: 'text-amber-700' }
      : tone === 'red'
      ? { bg: 'bg-red-100', fg: 'text-red-700' }
      : { bg: 'bg-green-100', fg: 'text-green-700' };
  return (
    <View className={`rounded-full px-2 py-0.5 ${palette.bg}`}>
      <Text className={`text-[10px] font-semibold ${palette.fg}`}>{label}</Text>
    </View>
  );
}
