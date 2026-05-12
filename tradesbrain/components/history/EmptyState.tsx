// D6 Flow08 — Empty state for new users with no archived jobs.

import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface Props {
  onStartFirstJob: () => void;
}

export default function EmptyState({ onStartFirstJob }: Props) {
  return (
    <View className="items-center mt-16 px-6">
      <Text className="text-5xl mb-4">📂</Text>
      <Text className="text-lg font-semibold text-gray-900 mb-1">No jobs yet</Text>
      <Text className="text-sm text-gray-600 text-center mb-6">
        Closed Rex sessions with a confirmed report or quote land here.
      </Text>
      <Pressable
        onPress={onStartFirstJob}
        className="bg-brand py-3 px-6 rounded-xl"
      >
        <Text className="text-white font-semibold">Start your first job</Text>
      </Pressable>
    </View>
  );
}
