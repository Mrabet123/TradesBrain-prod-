// D6 Flow04 — message bubble for Rex session.
// User messages: right-aligned, brand colour. Assistant: left-aligned, gray.
// Photos render inline above the text. Transcript shown for voice messages.

import React from 'react';
import { View, Text, Image } from 'react-native';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  photoUrl?: string | null;
  transcript?: string | null;
}

export default function MessageBubble({ role, content, photoUrl, transcript }: Props) {
  const isUser = role === 'user';
  return (
    <View
      className={`max-w-[82%] my-1 mx-3 rounded-2xl ${
        isUser ? 'self-end bg-brand' : 'self-start bg-gray-100'
      }`}
    >
      {photoUrl && (
        <Image
          source={{ uri: photoUrl }}
          className="w-full h-48 rounded-t-2xl"
          resizeMode="cover"
        />
      )}
      <View className="px-3 py-2">
        {transcript && (
          <Text
            className={`text-xs mb-1 italic ${isUser ? 'text-white/70' : 'text-gray-500'}`}
          >
            🎙 {transcript}
          </Text>
        )}
        <Text className={`text-[15px] leading-5 ${isUser ? 'text-white' : 'text-gray-800'}`}>
          {content}
        </Text>
      </View>
    </View>
  );
}
