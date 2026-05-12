// D3 F4 — Tappable code citation. Shows the document/section as a pill;
// expands inline on press to reveal the full code chunk text.

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { CodeCitation } from '../../services/codeLookup';

interface Props {
  citation: CodeCitation;
}

export default function CitationCard({ citation }: Props) {
  const [expanded, setExpanded] = useState(false);
  const label = `${citation.documentName} ${citation.version}${
    citation.sectionNumber ? ' § ' + citation.sectionNumber : ''
  }`;

  return (
    <View className="mb-2">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="bg-brand/10 border border-brand/30 rounded-lg px-3 py-2 flex-row items-center justify-between"
      >
        <Text className="text-brand text-sm font-medium flex-1 mr-2">{label}</Text>
        <Text className="text-brand text-xs">{expanded ? 'Hide' : 'View'}</Text>
      </Pressable>
      {expanded && (
        <View className="border border-gray-200 border-t-0 rounded-b-lg bg-white px-3 py-2 -mt-1">
          <Text className="text-xs text-gray-700 leading-5">{citation.content}</Text>
          <Text className="text-[10px] text-gray-400 mt-1">
            similarity {(citation.similarity * 100).toFixed(1)}%
          </Text>
        </View>
      )}
    </View>
  );
}
