// D6 Flow04 — Stage-aware contextual buttons that appear below Rex's response.
// Stage 1: "Looks right" / "Disagree" / "Need more detail"
// Stage 2: "Agree with diagnosis" / "Disagree" / "Ask follow-up"
// Stage 3: "Step done — next" / "Pushback" / "Pause"
// Stage 4: "Final check passed" / "Found an issue"
// Stage 5: "Close job"

import React from 'react';
import { View, Pressable, Text } from 'react-native';

interface Props {
  stage: 1 | 2 | 3 | 4 | 5;
  disabled?: boolean;
  onPress: (action: string) => void;
}

const BUTTONS: Record<number, { action: string; label: string; tone?: 'primary' | 'warn' }[]> = {
  1: [
    { action: 'looks_right', label: 'Looks right', tone: 'primary' },
    { action: 'disagree', label: 'Disagree' },
    { action: 'more_detail', label: 'Need more detail' },
  ],
  2: [
    { action: 'agree_diagnosis', label: 'Agree with diagnosis', tone: 'primary' },
    { action: 'disagree', label: 'Disagree' },
    { action: 'followup', label: 'Ask follow-up' },
  ],
  3: [
    { action: 'step_done', label: 'Step done — next', tone: 'primary' },
    { action: 'pushback', label: 'Pushback' },
    { action: 'pause', label: 'Pause' },
  ],
  4: [
    { action: 'final_pass', label: 'Final check passed', tone: 'primary' },
    { action: 'found_issue', label: 'Found an issue', tone: 'warn' },
  ],
  5: [{ action: 'close_job', label: 'Close job', tone: 'primary' }],
};

export default function ContextualButtons({ stage, disabled, onPress }: Props) {
  const list = BUTTONS[stage] ?? [];
  return (
    <View className="flex-row flex-wrap gap-2 px-3 mt-2 mb-1">
      {list.map((b) => (
        <Pressable
          key={b.action}
          disabled={disabled}
          onPress={() => onPress(b.action)}
          className={`px-3 py-2 rounded-full border ${
            disabled
              ? 'border-gray-200 bg-gray-100'
              : b.tone === 'primary'
              ? 'border-brand bg-brand/10'
              : b.tone === 'warn'
              ? 'border-amber-400 bg-amber-50'
              : 'border-gray-300 bg-white'
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              disabled
                ? 'text-gray-400'
                : b.tone === 'primary'
                ? 'text-brand'
                : b.tone === 'warn'
                ? 'text-amber-700'
                : 'text-gray-700'
            }`}
          >
            {b.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
