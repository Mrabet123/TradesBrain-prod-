// D6 Flow04 — Tap to capture (or pick) a photo. Stage-aware compression is
// applied inside usePhotoCapture before the base64 is sent.

import React from 'react';
import { Pressable, Text } from 'react-native';

interface Props {
  disabled?: boolean;
  onCapture: () => void;
}

export default function PhotoCapture({ disabled, onCapture }: Props) {
  return (
    <Pressable
      onPress={onCapture}
      disabled={disabled}
      className={`px-4 py-3 rounded-full ${disabled ? 'bg-gray-300' : 'bg-green-600'}`}
    >
      <Text className="text-white font-semibold">📷 Photo</Text>
    </Pressable>
  );
}
