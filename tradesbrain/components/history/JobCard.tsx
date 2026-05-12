// D3 F5 — Job card in the History list. No customer name (RULE 5). Trade
// badge, status, counts, optional inline-editable job name.

import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import type { HistoryJob } from '../../services/history';

interface Props {
  job: HistoryJob;
  onPress: () => void;
  onRename: (newName: string) => void | Promise<void>;
}

export default function JobCard({ job, onPress, onRename }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(job.jobName ?? '');

  async function commit() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== job.jobName) await onRename(trimmed);
  }

  return (
    <Pressable
      onPress={onPress}
      className="bg-white border border-gray-200 rounded-xl p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-1">
        {editing ? (
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            onBlur={commit}
            onSubmitEditing={commit}
            autoFocus
            className="flex-1 text-base font-semibold border-b border-brand pb-0.5"
          />
        ) : (
          <Pressable onPress={() => setEditing(true)} className="flex-1">
            <Text className="text-base font-semibold text-gray-900">
              {job.jobName || 'Untitled job'} <Text className="text-xs text-gray-400">✎</Text>
            </Text>
          </Pressable>
        )}
        <View className="bg-brand/10 rounded-full px-2 py-0.5 ml-2">
          <Text className="text-[11px] text-brand font-medium uppercase">
            {job.tradeType}
          </Text>
        </View>
      </View>

      {job.jobsite && (
        <Text className="text-xs text-gray-500 mb-1">📍 {job.jobsite}</Text>
      )}

      <Text className="text-xs text-gray-500">
        {new Date(job.updatedAt).toLocaleDateString()} ·{' '}
        {job.status === 'reopened' ? 'Reopened' : 'Completed'} · {job.messageCount} msgs ·{' '}
        {job.reportCount} report{job.reportCount === 1 ? '' : 's'} ·{' '}
        {job.quoteCount} quote{job.quoteCount === 1 ? '' : 's'}
      </Text>
    </Pressable>
  );
}
