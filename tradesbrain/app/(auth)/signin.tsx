// D2 Sign In Flow, D6 Flow02 — Sign In with 3 methods, all equally visible.
// Method 1: email + password (with optional Save Password toggle → SecureStore).
// Method 2: Google OAuth.
// Method 3: Phone + OTP.
// Error states (D6 Flow02 S10):
//   wrong password / account not found / suspended / 5x lockout 15min / no internet / phone not registered

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import { signInWithPassword } from '../../services/auth';
import { supabase } from '../../services/supabase';
import {
  saveCredentials,
  loadCredentials,
  clearCredentials,
} from '../../hooks/useSavePassword';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export default function SignInScreen() {
  const nav = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savePassword, setSavePassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const [failed, setFailed] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    loadCredentials().then((c) => {
      if (c) {
        setEmail(c.email);
        setPassword(c.password);
        setSavePassword(true);
      }
    });
  }, []);

  const lockSecondsLeft = lockedUntil
    ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
    : 0;
  const isLocked = lockSecondsLeft > 0;

  async function onEmailSignIn() {
    if (isLocked) return;

    setBusy(true);
    const { error } = await signInWithPassword(email.trim(), password);
    setBusy(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
        Alert.alert('No connection', 'Sign in requires internet access.');
        return;
      }
      const next = failed + 1;
      setFailed(next);
      if (next >= MAX_FAILED) setLockedUntil(Date.now() + LOCKOUT_MS);

      if (msg.includes('suspended')) {
        Alert.alert('Account suspended', 'Your account has been suspended — contact support.');
      } else if (msg.includes('user not found') || msg.includes('no user')) {
        Alert.alert(
          'No account',
          'No account found with this email — create one instead?',
          [{ text: 'Create Account', onPress: () => nav.navigate('SignUp') }, { text: 'Cancel' }],
        );
      } else if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('password')) {
        Alert.alert(
          'Incorrect password',
          'Incorrect password — try again or reset your password.',
          [{ text: 'Reset', onPress: () => (nav as any).navigate('ForgotPassword') }, { text: 'Try again' }],
        );
      } else {
        Alert.alert('Sign in failed', error.message);
      }
      return;
    }

    setFailed(0);
    if (savePassword) await saveCredentials(email.trim(), password);
    else await clearCredentials();
    nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }

  async function onGoogleSignIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'tradesbrain://auth-callback' },
    });
    setBusy(false);
    if (error) Alert.alert('Google sign-in failed', error.message);
  }

  return (
    <View className="flex-1 bg-white px-5 pt-12">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Sign in</Text>
      <Text className="text-sm text-gray-600 mb-6">Welcome back.</Text>

      {isLocked && (
        <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <Text className="text-red-700 font-semibold">Sign-in locked</Text>
          <Text className="text-red-700 text-sm">
            Too many failed attempts — try again in {Math.floor(lockSecondsLeft / 60)}m{' '}
            {lockSecondsLeft % 60}s.
          </Text>
        </View>
      )}

      {/* METHOD 1 — Email + Password */}
      <Text className="text-sm font-semibold text-gray-700 mb-2">Email & password</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLocked && !busy}
        className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-3"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        editable={!isLocked && !busy}
        className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-3"
      />
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Switch value={savePassword} onValueChange={setSavePassword} />
          <Text className="text-sm text-gray-700 ml-2">Save password</Text>
        </View>
        <Pressable onPress={() => (nav as any).navigate('ForgotPassword')}>
          <Text className="text-sm text-brand">Forgot password?</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={onEmailSignIn}
        disabled={isLocked || busy || !email || !password}
        className={`py-4 rounded-xl ${
          isLocked || busy || !email || !password ? 'bg-gray-300' : 'bg-brand'
        }`}
      >
        <Text className="text-center text-white font-semibold">Sign in</Text>
      </Pressable>

      <View className="flex-row items-center my-5">
        <View className="flex-1 h-px bg-gray-200" />
        <Text className="mx-3 text-xs text-gray-400">OR</Text>
        <View className="flex-1 h-px bg-gray-200" />
      </View>

      {/* METHOD 2 — Google */}
      <Pressable
        onPress={onGoogleSignIn}
        disabled={busy}
        className="py-4 rounded-xl border border-gray-300 mb-3"
      >
        <Text className="text-center text-gray-800 font-semibold">Continue with Google</Text>
      </Pressable>

      {/* METHOD 3 — Phone OTP */}
      <Pressable
        onPress={() => (nav as any).navigate('PhoneSignIn')}
        disabled={busy}
        className="py-4 rounded-xl border border-gray-300"
      >
        <Text className="text-center text-gray-800 font-semibold">Sign in with phone OTP</Text>
      </Pressable>

      {busy && (
        <View className="mt-6 items-center">
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}
