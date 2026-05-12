// D3 F2 — Report preview: inline-editable sections + VAT/license toggles +
// confirmed amount input. Used in the report builder screen.

import React from 'react';
import { View, Text, TextInput, Pressable, Switch } from 'react-native';
import type { ReportSection } from '../../services/documents';

interface Props {
  sections: ReportSection[];
  confirmedAmount: number | null;
  includesVat: boolean;
  includesLicense: boolean;
  suggestedAmount?: number | null;
  onSectionContentChange: (id: string, content: string) => void;
  onAddCustomSection: () => void;
  onRemoveSection: (id: string) => void;
  onConfirmedAmountChange: (n: number | null) => void;
  onIncludesVatChange: (v: boolean) => void;
  onIncludesLicenseChange: (v: boolean) => void;
}

export default function ReportPreview(props: Props) {
  return (
    <View>
      {props.sections.map((s) => (
        <View key={s.id} className="mb-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-sm font-semibold text-brand">
              {s.name}{s.custom ? ' · custom' : ''}
            </Text>
            {s.custom && (
              <Pressable onPress={() => props.onRemoveSection(s.id)}>
                <Text className="text-red-600 text-xs">Remove</Text>
              </Pressable>
            )}
          </View>
          <TextInput
            value={s.content}
            onChangeText={(t) => props.onSectionContentChange(s.id, t)}
            multiline
            placeholder={`Edit ${s.name.toLowerCase()}…`}
            className="border border-gray-300 rounded-lg px-3 py-2 text-base min-h-[80px]"
          />
        </View>
      ))}

      <Pressable
        onPress={props.onAddCustomSection}
        className="py-3 rounded-lg border border-dashed border-gray-300 mb-4"
      >
        <Text className="text-center text-gray-600">+ Add custom section</Text>
      </Pressable>

      <Text className="text-sm font-semibold text-gray-700 mb-1">Confirmed amount</Text>
      {props.suggestedAmount != null && (
        <Text className="text-xs text-gray-500 mb-1">
          Rex suggests around ${props.suggestedAmount.toFixed(2)}
        </Text>
      )}
      <TextInput
        value={props.confirmedAmount?.toString() ?? ''}
        onChangeText={(t) =>
          props.onConfirmedAmountChange(t.length === 0 ? null : Number(t) || 0)
        }
        keyboardType="decimal-pad"
        placeholder="0.00"
        className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-4"
      />

      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm text-gray-700">Include VAT number</Text>
        <Switch value={props.includesVat} onValueChange={props.onIncludesVatChange} />
      </View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm text-gray-700">Include license number</Text>
        <Switch value={props.includesLicense} onValueChange={props.onIncludesLicenseChange} />
      </View>
    </View>
  );
}
