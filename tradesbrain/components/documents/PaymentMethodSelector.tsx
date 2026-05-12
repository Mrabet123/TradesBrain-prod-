// D3 F3 / BuildGuide M3 RULE 6 — multi-select of the 6 payment methods.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { PAYMENT_METHODS, type PaymentMethod } from '../../constants/paymentMethods';

interface Props {
  selected: PaymentMethod[];
  onChange: (next: PaymentMethod[]) => void;
}

export default function PaymentMethodSelector({ selected, onChange }: Props) {
  function toggle(m: PaymentMethod) {
    onChange(selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m]);
  }
  return (
    <View className="flex-row flex-wrap gap-2">
      {PAYMENT_METHODS.map((m) => {
        const on = selected.includes(m);
        return (
          <Pressable
            key={m}
            onPress={() => toggle(m)}
            className={`px-3 py-2 rounded-full border ${
              on ? 'border-brand bg-brand/10' : 'border-gray-300 bg-white'
            }`}
          >
            <Text className={`text-sm ${on ? 'text-brand font-medium' : 'text-gray-700'}`}>
              {on ? '✓ ' : ''}{m}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
