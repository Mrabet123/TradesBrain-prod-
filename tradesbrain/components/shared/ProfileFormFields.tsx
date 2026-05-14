// Shared form controls for the sign-up form (app/(auth)/signup.tsx) and the
// post-OAuth complete-profile screen (app/(auth)/complete-profile.tsx).
// Extracted so both render identical trade / account / KYC inputs.

import React from 'react';
import { View, Text, TextInput, Pressable, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type TradeType = 'plumber' | 'electrician' | 'hvac' | 'roofer' | 'other';
export type AccountType = 'solopreneur' | 'team_owner';

export const TRADES: { value: TradeType; label: string }[] = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'hvac', label: 'HVAC Technician' },
  { value: 'roofer', label: 'Roofer' },
  { value: 'other', label: 'Other / General Contractor' },
];

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'solopreneur', label: 'Solopreneur' },
  { value: 'team_owner', label: 'Team Owner' },
];

// Camera-or-library photo picker used for license / national ID / company logo.
export async function pickImage(setter: (uri: string) => void) {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && !lib.granted) {
    Alert.alert('Permission needed', 'Allow camera or photo library access.');
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
  });
  if (!result.canceled && result.assets[0]) setter(result.assets[0].uri);
}

export function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  placeholder?: string;
  editable?: boolean;
}) {
  const editable = props.editable !== false;
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        placeholder={props.placeholder}
        editable={editable}
        className={`border border-gray-300 rounded-lg px-3 py-3 text-base ${
          editable ? '' : 'bg-gray-100 text-gray-500'
        }`}
      />
    </View>
  );
}

export function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center py-3 px-3 rounded-lg mb-2 border ${
        selected ? 'border-brand bg-brand/5' : 'border-gray-200'
      }`}
    >
      <View
        className={`w-5 h-5 rounded-full border-2 mr-3 ${
          selected ? 'border-brand bg-brand' : 'border-gray-400'
        }`}
      />
      <Text className="text-base text-gray-800">{label}</Text>
    </Pressable>
  );
}

export function PhotoPicker({ uri, onPick }: { uri: string | null; onPick: () => void }) {
  return (
    <Pressable
      onPress={onPick}
      className="border border-dashed border-gray-300 rounded-lg p-3 mb-4 items-center justify-center min-h-[120px]"
    >
      {uri ? (
        <Image source={{ uri }} className="w-32 h-32 rounded-md" resizeMode="cover" />
      ) : (
        <Text className="text-gray-500">Tap to upload photo</Text>
      )}
    </Pressable>
  );
}
