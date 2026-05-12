// D3 F2 Section Management — first-time section picker.
// Shown ONCE when worker_preferences has no row for this document_type.
// Selection saved to worker_preferences on confirm so it never appears again.

import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, TextInput } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  defaultSections: readonly string[];
  onConfirm: (sections: string[]) => void;
  onCancel: () => void;
}

export default function SectionPicker({
  visible,
  title,
  defaultSections,
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSections));
  const [custom, setCustom] = useState('');
  const [customs, setCustoms] = useState<string[]>([]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (!trimmed || customs.includes(trimmed) || (defaultSections as readonly string[]).includes(trimmed)) return;
    setCustoms((c) => [...c, trimmed]);
    setSelected((prev) => new Set([...prev, trimmed]));
    setCustom('');
  }

  function done() {
    const all = [...(defaultSections as readonly string[]), ...customs];
    const final = all.filter((n) => selected.has(n));
    onConfirm(final);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 bg-white pt-12 px-5 pb-6">
        <Text className="text-2xl font-bold text-gray-900 mb-1">{title}</Text>
        <Text className="text-sm text-gray-600 mb-4">
          Pick the sections you want by default — saved permanently for next time.
        </Text>

        <ScrollView className="flex-1">
          {[...(defaultSections as readonly string[]), ...customs].map((name) => {
            const on = selected.has(name);
            return (
              <Pressable
                key={name}
                onPress={() => toggle(name)}
                className={`flex-row items-center py-3 px-3 rounded-lg mb-2 border ${
                  on ? 'border-brand bg-brand/5' : 'border-gray-200'
                }`}
              >
                <View
                  className={`w-5 h-5 rounded mr-3 border-2 ${
                    on ? 'border-brand bg-brand' : 'border-gray-400'
                  }`}
                />
                <Text className="text-base text-gray-800">{name}</Text>
              </Pressable>
            );
          })}

          <View className="mt-4 flex-row gap-2">
            <TextInput
              value={custom}
              onChangeText={setCustom}
              placeholder="Add a custom section"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base"
            />
            <Pressable
              onPress={addCustom}
              disabled={!custom.trim()}
              className={`px-4 py-3 rounded-lg ${custom.trim() ? 'bg-brand' : 'bg-gray-300'}`}
            >
              <Text className="text-white font-semibold">Add</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View className="flex-row gap-3 mt-4">
          <Pressable onPress={onCancel} className="flex-1 py-4 rounded-xl border border-gray-300">
            <Text className="text-center text-gray-700 font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={done}
            disabled={selected.size === 0}
            className={`flex-1 py-4 rounded-xl ${selected.size === 0 ? 'bg-gray-300' : 'bg-brand'}`}
          >
            <Text className="text-center text-white font-semibold">Save defaults</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
