// D2 Sign In Flow, D6 Flow02 S5-S6 — Forgot password.
// Request reset email → user receives Supabase password reset link → app
// re-opens via deep link → user enters new password → returns to Sign In.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { sendPasswordReset, updatePassword } from '../../services/auth';
import { supabase } from '../../services/supabase';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ForgotPasswordScreen() {
  const nav = useNavigation<Nav>();
  const [phase, setPhase] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPhase('reset');
    });
    return () => subscription.unsubscribe();
  }, []);

  async function onRequest() {
    if (!email) return;
    setBusy(true);
    const { error } = await sendPasswordReset(email.trim());
    setBusy(false);
    if (error) {
      Alert.alert('Reset failed', error.message);
      return;
    }
    Alert.alert(
      'Check your email',
      'A reset link has been sent. Open it on this device to set a new password.',
    );
  }

  async function onReset() {
    if (newPassword.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(newPassword);
    setBusy(false);
    if (error) {
      Alert.alert('Reset failed', error.message);
      return;
    }
    Alert.alert('Password updated', 'You can now sign in.', [
      { text: 'OK', onPress: () => (nav as any).navigate('SignIn') },
    ]);
  }

  return (
    <View className="flex-1 bg-white px-5 pt-12">
      <Text className="text-2xl font-bold text-gray-900 mb-1">
        {phase === 'request' ? 'Reset password' : 'Set new password'}
      </Text>
      <Text className="text-sm text-gray-600 mb-6">
        {phase === 'request'
          ? 'We will email you a link to reset your password.'
          : 'Enter a new password (min 8 chars).'}
      </Text>

      {phase === 'request' ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-4"
          />
          <Pressable
            onPress={onRequest}
            disabled={!email || busy}
            className={`py-4 rounded-xl ${!email || busy ? 'bg-gray-300' : 'bg-brand'}`}
          >
            <Text className="text-center text-white font-semibold">
              {busy ? 'Sending…' : 'Send reset email'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            secureTextEntry
            className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-4"
          />
          <Pressable
            onPress={onReset}
            disabled={busy}
            className={`py-4 rounded-xl ${busy ? 'bg-gray-300' : 'bg-brand'}`}
          >
            <Text className="text-center text-white font-semibold">
              {busy ? 'Saving…' : 'Update password'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
