// D2 Sign Up Step 5, D6 Flow01 S5 — Dual OTP verification.
// Single screen with two code inputs (email + SMS).
// Both must be verified before proceeding. Resend per channel after 60s.
// Wrong OTP × 3 → lock OTP input 5 min with countdown.
// On both verified → createUserProfile() → Home tabs.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import {
  verifyEmailOtp,
  verifyPhoneOtp,
  resendEmailOtp,
  resendPhoneOtp,
  createUserProfile,
  type SignUpInput,
} from '../../services/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Params = { OtpVerify: { signUpData: SignUpInput } };

const RESEND_COOLDOWN_S = 60;
const LOCKOUT_S = 300; // 5 minutes
const MAX_WRONG = 3;

export default function OtpVerifyScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<Params, 'OtpVerify'>>();
  const data = route.params.signUpData;

  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [emailWrong, setEmailWrong] = useState(0);
  const [phoneWrong, setPhoneWrong] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const [emailCooldown, setEmailCooldown] = useState(RESEND_COOLDOWN_S);
  const [phoneCooldown, setPhoneCooldown] = useState(RESEND_COOLDOWN_S);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setEmailCooldown((s) => (s > 0 ? s - 1 : 0));
      setPhoneCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const lockSecondsLeft = lockedUntil
    ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
    : 0;
  const isLocked = lockSecondsLeft > 0;

  async function tryVerifyEmail() {
    if (isLocked || emailVerified || emailCode.length < 4) return;
    setBusy(true);
    const { error } = await verifyEmailOtp(data.email, emailCode);
    setBusy(false);
    if (error) {
      const next = emailWrong + 1;
      setEmailWrong(next);
      if (next >= MAX_WRONG) setLockedUntil(Date.now() + LOCKOUT_S * 1000);
      Alert.alert('Wrong code', 'Email code is incorrect.');
      return;
    }
    setEmailVerified(true);
  }

  async function tryVerifyPhone() {
    if (isLocked || phoneVerified || phoneCode.length < 4) return;
    setBusy(true);
    const { error } = await verifyPhoneOtp(data.phone, phoneCode);
    setBusy(false);
    if (error) {
      const next = phoneWrong + 1;
      setPhoneWrong(next);
      if (next >= MAX_WRONG) setLockedUntil(Date.now() + LOCKOUT_S * 1000);
      Alert.alert('Wrong code', 'SMS code is incorrect.');
      return;
    }
    setPhoneVerified(true);
  }

  useEffect(() => {
    if (emailVerified && phoneVerified) {
      (async () => {
        setBusy(true);
        try {
          await createUserProfile(data);
          nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
        } catch (e: any) {
          Alert.alert('Sign up incomplete', e?.message ?? 'Could not create profile.');
        } finally {
          setBusy(false);
        }
      })();
    }
  }, [emailVerified, phoneVerified]);

  async function resendEmail() {
    if (emailCooldown > 0) return;
    setEmailCooldown(RESEND_COOLDOWN_S);
    const { error } = await resendEmailOtp(data.email);
    if (error) Alert.alert('Resend failed', error.message);
  }
  async function resendPhone() {
    if (phoneCooldown > 0) return;
    setPhoneCooldown(RESEND_COOLDOWN_S);
    const { error } = await resendPhoneOtp(data.phone);
    if (error) Alert.alert('Resend failed', error.message);
  }

  return (
    <View className="flex-1 bg-white px-5 pt-12">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Verify your identity</Text>
      <Text className="text-sm text-gray-600 mb-6">
        Enter the codes we sent to your email and phone.
      </Text>

      {isLocked && (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <Text className="text-red-700 font-semibold">Too many wrong attempts</Text>
          <Text className="text-red-700 text-sm">
            Try again in {Math.floor(lockSecondsLeft / 60)}m {lockSecondsLeft % 60}s.
          </Text>
        </View>
      )}

      <OtpRow
        label="Email code"
        target={data.email}
        value={emailCode}
        onChangeText={setEmailCode}
        onVerify={tryVerifyEmail}
        onResend={resendEmail}
        verified={emailVerified}
        cooldown={emailCooldown}
        disabled={isLocked || busy || emailVerified}
      />

      <OtpRow
        label="SMS code"
        target={data.phone}
        value={phoneCode}
        onChangeText={setPhoneCode}
        onVerify={tryVerifyPhone}
        onResend={resendPhone}
        verified={phoneVerified}
        cooldown={phoneCooldown}
        disabled={isLocked || busy || phoneVerified}
      />

      {busy && (
        <View className="mt-6 items-center">
          <ActivityIndicator />
          <Text className="text-gray-500 text-sm mt-2">Working…</Text>
        </View>
      )}
    </View>
  );
}

function OtpRow(props: {
  label: string;
  target: string;
  value: string;
  onChangeText: (v: string) => void;
  onVerify: () => void;
  onResend: () => void;
  verified: boolean;
  cooldown: number;
  disabled: boolean;
}) {
  return (
    <View className="mb-5">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-medium text-gray-700">{props.label}</Text>
        {props.verified && (
          <Text className="text-green-600 text-sm font-semibold">verified ✓</Text>
        )}
      </View>
      <Text className="text-xs text-gray-500 mb-2">Sent to {props.target}</Text>
      <View className="flex-row gap-2">
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          editable={!props.verified && !props.disabled}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base tracking-widest"
        />
        <Pressable
          onPress={props.onVerify}
          disabled={props.disabled || props.value.length < 4}
          className={`px-4 py-3 rounded-lg ${
            props.disabled || props.value.length < 4 ? 'bg-gray-300' : 'bg-brand'
          }`}
        >
          <Text className="text-white font-semibold">Verify</Text>
        </Pressable>
      </View>
      <Pressable onPress={props.onResend} disabled={props.cooldown > 0 || props.verified} className="mt-2">
        <Text className={`text-sm ${props.cooldown > 0 ? 'text-gray-400' : 'text-brand'}`}>
          {props.cooldown > 0 ? `Resend in ${props.cooldown}s` : 'Resend code'}
        </Text>
      </Pressable>
    </View>
  );
}
