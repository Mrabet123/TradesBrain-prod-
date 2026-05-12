// D6 Flow04 — Hold-to-record voice button with visible recording state.

import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface Props {
  isRecording: boolean;
  disabled?: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
}

export default function VoiceRecordButton({
  isRecording,
  disabled,
  onPressIn,
  onPressOut,
}: Props) {
  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      className={`flex-row items-center justify-center px-4 py-3 rounded-full ${
        disabled ? 'bg-gray-300' : isRecording ? 'bg-red-600' : 'bg-brand'
      }`}
    >
      <View
        className={`w-3 h-3 rounded-full mr-2 ${isRecording ? 'bg-white' : 'bg-white/80'}`}
      />
      <Text className="text-white font-semibold">
        {isRecording ? 'Recording — release to send' : 'Hold to record'}
      </Text>
    </Pressable>
  );
}
