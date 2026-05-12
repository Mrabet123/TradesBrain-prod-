// D2 Sign In Method 3, D6 Flow02 — Phone + OTP sign-in.
// Screen 1: phone entry → send SMS OTP.
// Screen 2: enter OTP → on success, signed in.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { signInWithPhoneStart, signInWithPhoneVerify } from '../../services/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function PhoneSignInScreen() {
  const nav = useNavigation<Nav>();
  const [phase, setPhase] = useState<'enter' | 'verify'>('enter');
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const fullPhone = `${countryCode}${phoneLocal}`;

  async function onSendCode() {
    if (phoneLocal.replace(/\D/g, '').length < 7) return;
    setBusy(true);
    const { error } = await signInWithPhoneStart(fullPhone);
    setBusy(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('no user')) {
        Alert.alert('Phone not registered', 'No account uses this number. Create one?', [
          { text: 'Create Account', onPress: () => nav.navigate('SignUp') },
          { text: 'Cancel' },
        ]);
        return;
      }
      Alert.alert('SMS failed', error.message);
      return;
    }
    setPhase('verify');
  }

  async function onVerify() {
    if (code.length < 4) return;
    setBusy(true);
    const { error } = await signInWithPhoneVerify(fullPhone, code);
    setBusy(false);
    if (error) {
      Alert.alert('Wrong code', 'SMS code is incorrect.');
      return;
    }
    nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }

  return (
    <View className="flex-1 bg-white px-5 pt-12">
      <Text className="text-2xl font-bold text-gray-900 mb-1">
        {phase === 'enter' ? 'Sign in with phone' : 'Enter SMS code'}
      </Text>
      <Text className="text-sm text-gray-600 mb-6">
        {phase === 'enter'
          ? 'We will send you a one-time code.'
          : `Sent to ${fullPhone}`}
      </Text>

      {phase === 'enter' ? (
        <>
          <Text className="text-sm font-medium text-gray-700 mb-1">Phone number</Text>
          <View className="flex-row gap-2 mb-4">
            <TextInput
              value={countryCode}
              onChangeText={setCountryCode}
              keyboardType="phone-pad"
              className="border border-gray-300 rounded-lg px-3 py-3 w-20 text-base"
            />
            <TextInput
              value={phoneLocal}
              onChangeText={setPhoneLocal}
              keyboardType="phone-pad"
              placeholder="555 123 4567"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base"
            />
          </View>
          <Pressable
            onPress={onSendCode}
            disabled={busy || phoneLocal.length === 0}
            className={`py-4 rounded-xl ${busy || !phoneLocal ? 'bg-gray-300' : 'bg-brand'}`}
          >
            <Text className="text-center text-white font-semibold">Send code</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-4 tracking-widest"
          />
          <Pressable
            onPress={onVerify}
            disabled={busy || code.length < 4}
            className={`py-4 rounded-xl ${busy || code.length < 4 ? 'bg-gray-300' : 'bg-brand'}`}
          >
            <Text className="text-center text-white font-semibold">Verify & sign in</Text>
          </Pressable>
        </>
      )}

      {busy && (
        <View className="mt-6 items-center">
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}
