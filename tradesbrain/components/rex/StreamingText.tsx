// D6 Flow04 — Assistant streaming bubble shown while Rex is responding.
// Word-by-word display with a blinking cursor while isStreaming is true.

import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

interface Props {
  text: string;
  isStreaming: boolean;
}

export default function StreamingText({ text, isStreaming }: Props) {
  const [showCursor, setShowCursor] = useState(true);
  useEffect(() => {
    if (!isStreaming) return;
    const t = setInterval(() => setShowCursor((v) => !v), 500);
    return () => clearInterval(t);
  }, [isStreaming]);

  if (!text && !isStreaming) return null;

  return (
    <View className="max-w-[82%] my-1 mx-3 rounded-2xl self-start bg-gray-100 px-3 py-2">
      <Text className="text-[15px] leading-5 text-gray-800">
        {text}
        {isStreaming && (
          <Text className="text-brand font-bold">{showCursor ? '▎' : ' '}</Text>
        )}
      </Text>
    </View>
  );
}
