// D6 Flow11 — Add team member.
// Owner uploads member's KYC docs to kyc-documents bucket first (under their
// own user folder for now — the function copies/moves on the server side).
// All fields required. create-team-member runs the full Auth + DB + Stripe
// seat + KYC + email flow with rollback on failure (RULE 6).

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import type { RootStackParamList } from '../_layout';
import { useAuthContext } from '../../context/AuthContext';
import { addMember, generateTempPassword } from '../../services/team';
import { uploadKycPhoto } from '../../services/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Trade = 'plumber' | 'electrician' | 'hvac' | 'roofer' | 'other';
const TRADES: { value: Trade; label: string }[] = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'hvac', label: 'HVAC Technician' },
  { value: 'roofer', label: 'Roofer' },
  { value: 'other', label: 'Other / General Contractor' },
];

export default function TeamAddScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuthContext();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [trade, setTrade] = useState<Trade>('plumber');
  const [vat, setVat] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [nationalIdUri, setNationalIdUri] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState(generateTempPassword());

  const [busy, setBusy] = useState(false);

  const valid =
    fullName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    phone.replace(/\D/g, '').length >= 7 &&
    vat.trim().length > 0 &&
    licenseNumber.trim().length > 0 &&
    !!licenseUri &&
    !!nationalIdUri;

  async function pickFor(set: (uri: string) => void) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    set(result.assets[0].uri);
  }

  async function onSubmit() {
    if (!user || !valid || busy) return;
    setBusy(true);
    try {
      // Upload KYC docs under the OWNER's folder. The function will be able to
      // read the paths via the service role; member will be assigned ownership
      // server-side after their auth user is created.
      const licensePath = await uploadKycPhoto(user.id, 'license', licenseUri!);
      const nidPath = await uploadKycPhoto(user.id, 'national_id', nationalIdUri!);

      const result = await addMember({
        full_name: fullName.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        trade_type: trade,
        vat_number: vat.trim(),
        license_number: licenseNumber.trim(),
        license_proof_url: licensePath,
        national_id_url: nidPath,
        temp_password: tempPassword,
      });

      if (!result.ok) {
        Alert.alert(
          'Could not add member',
          result.error?.includes('max_seats_reached')
            ? 'Maximum of 10 members reached.'
            : result.error?.includes('team_plan_required')
            ? 'A Team plan is required to add members.'
            : result.error?.includes('not deployed')
            ? 'create-team-member Edge Function is not deployed yet.'
            : result.error ?? 'Unknown error',
        );
        return;
      }

      Alert.alert(
        'Member added',
        `${fullName} will receive an email and SMS with their temporary password.`,
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Could not add member', e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="pt-12 px-5 pb-10">
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => nav.goBack()}>
          <Text className="text-brand text-base">← Back</Text>
        </Pressable>
        <Text className="text-base font-semibold">Add member</Text>
        <View className="w-12" />
      </View>

      <Field label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Phone (with country code)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+1 555 123 4567"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Trade type</Text>
      {TRADES.map((t) => {
        const on = t.value === trade;
        return (
          <Pressable
            key={t.value}
            onPress={() => setTrade(t.value)}
            className={`flex-row items-center py-3 px-3 rounded-lg mb-2 border ${
              on ? 'border-brand bg-brand/5' : 'border-gray-200'
            }`}
          >
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 ${
                on ? 'border-brand bg-brand' : 'border-gray-400'
              }`}
            />
            <Text className="text-base text-gray-800">{t.label}</Text>
          </Pressable>
        );
      })}

      <Field label="VAT number" value={vat} onChangeText={setVat} autoCapitalize="characters" />
      <Field
        label="License number"
        value={licenseNumber}
        onChangeText={setLicenseNumber}
        autoCapitalize="characters"
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">License proof photo</Text>
      <PhotoPick uri={licenseUri} onPick={() => pickFor(setLicenseUri)} />

      <Text className="text-sm font-medium text-gray-700 mb-1 mt-2">National ID photo</Text>
      <PhotoPick uri={nationalIdUri} onPick={() => pickFor(setNationalIdUri)} />

      <View className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
        <Text className="text-xs text-gray-500 mb-1">Temporary password (auto-generated)</Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-mono text-gray-900 flex-1">{tempPassword}</Text>
          <Pressable onPress={() => setTempPassword(generateTempPassword())}>
            <Text className="text-brand text-sm font-semibold">Regenerate</Text>
          </Pressable>
        </View>
        <Text className="text-xs text-gray-500 mt-1">
          Sent by SMS + email. Member must change it on first sign-in.
        </Text>
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={!valid || busy}
        className={`py-4 rounded-xl ${!valid || busy ? 'bg-gray-300' : 'bg-brand'}`}
      >
        <Text className="text-center text-white font-semibold text-base">
          {busy ? 'Creating account…' : 'Add member'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  placeholder?: string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        placeholder={props.placeholder}
        className="border border-gray-300 rounded-lg px-3 py-3 text-base"
      />
    </View>
  );
}

function PhotoPick({ uri, onPick }: { uri: string | null; onPick: () => void }) {
  return (
    <Pressable
      onPress={onPick}
      className="border border-dashed border-gray-300 rounded-lg p-3 mb-4 items-center justify-center min-h-[110px]"
    >
      {uri ? (
        <Image source={{ uri }} className="w-28 h-28 rounded-md" resizeMode="cover" />
      ) : (
        <Text className="text-gray-500">Tap to upload photo</Text>
      )}
    </Pressable>
  );
}
