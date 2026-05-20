// D1 §7, D2 Sign Up Flow, D6 Flow01 — 3-step sign-up form.
// Step 1: full name, email, password (≥8 chars + strength), phone (country code).
// Step 2: trade type, account type, hourly rate, VAT number.
// Step 3: license proof photo + number, national ID photo, optional company name + logo.
// Create Account button disabled until all required fields valid.
// On Create Account: Terms overlay → on agree → startSignUp() → OtpVerify.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TermsOverlay from '../../components/shared/TermsOverlay';
import { startSignUp, signInWithGoogle } from '../../services/auth';
import { useAuthContext } from '../../context/AuthContext';
import {
  Field,
  RadioRow,
  PhotoPicker,
  pickImage,
  TRADES,
  ACCOUNT_TYPES,
  type TradeType,
  type AccountType,
} from '../../components/shared/ProfileFormFields';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DRAFT_KEY = 'tb_signup_draft';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < 8) return { score: 0, label: 'Too short' };
  let score: 0 | 1 | 2 | 3 = 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score = 2;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw) && pw.length >= 12) score = 3;
  const labels = ['Too short', 'Weak', 'OK', 'Strong'] as const;
  return { score, label: labels[score] };
}

export default function SignUpScreen() {
  const nav = useNavigation<Nav>();
  const { setProfileSetupPending } = useAuthContext();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneLocal, setPhoneLocal] = useState('');

  // Step 2
  const [tradeType, setTradeType] = useState<TradeType | ''>('');
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [vatNumber, setVatNumber] = useState('');

  // Step 3
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseProofUri, setLicenseProofUri] = useState<string | null>(null);
  const [nationalIdUri, setNationalIdUri] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUri, setCompanyLogoUri] = useState<string | null>(null);

  const fullPhone = `${countryCode}${phoneLocal}`;
  const pwInfo = passwordStrength(password);

  // Per-field "touched" tracking — an error only shows once a field has been
  // blurred (or otherwise marked touched) and is still invalid.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = (field: string) =>
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  const fieldErrors = {
    fullName:
      fullName.trim().length >= 2 ? '' : 'Enter your full name (min 2 characters).',
    email: EMAIL_RE.test(email) ? '' : 'Enter a valid email address.',
    password: password.length >= 8 ? '' : 'Password must be at least 8 characters.',
    phone:
      phoneLocal.replace(/\D/g, '').length >= 7
        ? ''
        : 'Enter a valid phone number (min 7 digits).',
  };

  // ── Restore in-progress draft on mount (password is never persisted) ──────
  const draftLoaded = useRef(false);
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const d = JSON.parse(raw);
            if (typeof d.fullName === 'string') setFullName(d.fullName);
            if (typeof d.email === 'string') setEmail(d.email);
            if (typeof d.countryCode === 'string') setCountryCode(d.countryCode);
            if (typeof d.phoneLocal === 'string') setPhoneLocal(d.phoneLocal);
            if (typeof d.tradeType === 'string') setTradeType(d.tradeType);
            if (typeof d.accountType === 'string') setAccountType(d.accountType);
            if (typeof d.hourlyRate === 'string') setHourlyRate(d.hourlyRate);
            if (typeof d.vatNumber === 'string') setVatNumber(d.vatNumber);
            if (typeof d.licenseNumber === 'string') setLicenseNumber(d.licenseNumber);
            if (typeof d.companyName === 'string') setCompanyName(d.companyName);
          } catch {
            /* ignore corrupt draft */
          }
        }
      })
      .finally(() => {
        draftLoaded.current = true;
      });
  }, []);

  // ── Persist in-progress fields on change (NOT the password) ───────────────
  useEffect(() => {
    if (!draftLoaded.current) return;
    AsyncStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        fullName,
        email,
        countryCode,
        phoneLocal,
        tradeType,
        accountType,
        hourlyRate,
        vatNumber,
        licenseNumber,
        companyName,
      }),
    ).catch(() => {});
  }, [
    fullName, email, countryCode, phoneLocal, tradeType, accountType,
    hourlyRate, vatNumber, licenseNumber, companyName,
  ]);

  const step1Valid =
    fullName.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    phoneLocal.replace(/\D/g, '').length >= 7;

  const step2Valid =
    tradeType !== '' &&
    accountType !== '' &&
    parseFloat(hourlyRate) > 0 &&
    vatNumber.trim().length > 0;

  const step3Valid =
    licenseNumber.trim().length > 0 &&
    !!licenseProofUri &&
    !!nationalIdUri;

  const allValid = step1Valid && step2Valid && step3Valid;

  const formSnapshot = useMemo(
    () => ({
      fullName,
      email,
      password,
      phone: fullPhone,
      tradeType: tradeType as TradeType,
      accountType: accountType as AccountType,
      hourlyRate: parseFloat(hourlyRate || '0'),
      vatNumber,
      licenseNumber,
      licenseProofUri: licenseProofUri ?? '',
      nationalIdUri: nationalIdUri ?? '',
      companyName: companyName || undefined,
      companyLogoUri: companyLogoUri ?? undefined,
    }),
    [
      fullName, email, password, fullPhone, tradeType, accountType, hourlyRate,
      vatNumber, licenseNumber, licenseProofUri, nationalIdUri, companyName, companyLogoUri,
    ],
  );

  async function onCreateAccount() {
    setShowTerms(false);
    setSubmitting(true);
    try {
      const { error } = await startSignUp(email, password, fullPhone);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('user already')) {
          Alert.alert(
            'Email already registered',
            'This email is already registered — sign in instead?',
            [{ text: 'Sign In', onPress: () => nav.navigate('SignIn') }, { text: 'Cancel' }],
          );
        } else {
          Alert.alert('Sign up failed', error.message);
        }
        return;
      }
      // Account created — drop the persisted draft so it doesn't reappear.
      await AsyncStorage.removeItem(DRAFT_KEY);
      // Hold the RootLayout onboarding gate — OtpVerify creates the profile
      // right after the session is established.
      setProfileSetupPending(true);
      nav.navigate('OtpVerify', { signUpData: formSnapshot } as any);
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleSignup() {
    setAuthBusy(true);
    try {
      const { error, cancelled } = await signInWithGoogle();
      if (cancelled) return;
      if (error) throw error;
      // New Google user → no public.users row → RootLayout's gate routes them
      // to the complete-profile screen to finish trade type + KYC.
    } catch (e: any) {
      Alert.alert('Google sign-up failed', e?.message ?? 'Please try again.');
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pt-12 pb-10">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Create your account</Text>
      <Text className="text-sm text-gray-500 mb-5">Step {step} of 3</Text>

      {step === 1 && (
        <View>
          <Field
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            onBlur={() => markTouched('fullName')}
            error={touched.fullName ? fieldErrors.fullName : ''}
          />
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            onBlur={() => markTouched('email')}
            error={touched.email ? fieldErrors.email : ''}
          />
          <Field
            label="Password (min 8 chars)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            onBlur={() => markTouched('password')}
            error={touched.password ? fieldErrors.password : ''}
          />
          {password.length > 0 && (
            <View className="-mt-2 mb-3">
              <View className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <View
                  style={{ width: `${(pwInfo.score / 3) * 100}%` }}
                  className={`h-full ${
                    pwInfo.score === 3 ? 'bg-green-500'
                      : pwInfo.score === 2 ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />
              </View>
              <Text className="text-xs text-gray-500 mt-1">{pwInfo.label}</Text>
            </View>
          )}

          <Text className="text-sm font-medium text-gray-700 mb-1">Phone number</Text>
          <View className="flex-row gap-2 mb-1">
            <TextInput
              value={countryCode}
              onChangeText={setCountryCode}
              className="border border-gray-300 rounded-lg px-3 py-3 w-20 text-base"
              keyboardType="phone-pad"
            />
            <TextInput
              value={phoneLocal}
              onChangeText={setPhoneLocal}
              onBlur={() => markTouched('phone')}
              placeholder="555 123 4567"
              className={`flex-1 border rounded-lg px-3 py-3 text-base ${
                touched.phone && fieldErrors.phone ? 'border-red-400' : 'border-gray-300'
              }`}
              keyboardType="phone-pad"
            />
          </View>
          {touched.phone && !!fieldErrors.phone && (
            <Text className="text-xs text-red-600 mb-3">{fieldErrors.phone}</Text>
          )}
          <View className="mb-1" />

          {/* Social / phone sign-up — same providers as the Sign In screen.
              Both authenticate first, then RootLayout's gate routes the new
              user to the complete-profile screen for trade type + KYC. */}
          <View className="flex-row items-center my-1">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="mx-3 text-xs text-gray-400">OR SIGN UP WITH</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>
          <Pressable
            onPress={onGoogleSignup}
            disabled={authBusy}
            className="py-4 rounded-xl border border-gray-300 mb-3 mt-2"
          >
            <Text className="text-center text-gray-800 font-semibold">
              Continue with Google
            </Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('PhoneSignIn')}
            disabled={authBusy}
            className="py-4 rounded-xl border border-gray-300"
          >
            <Text className="text-center text-gray-800 font-semibold">
              Sign up with phone OTP
            </Text>
          </Pressable>
          {authBusy && (
            <View className="mt-4 items-center">
              <ActivityIndicator />
            </View>
          )}
        </View>
      )}

      {step === 2 && (
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-2">Trade type</Text>
          <View className="mb-4">
            {TRADES.map((t) => (
              <RadioRow
                key={t.value}
                label={t.label}
                selected={tradeType === t.value}
                onPress={() => setTradeType(t.value)}
              />
            ))}
          </View>

          <Text className="text-sm font-medium text-gray-700 mb-2">Account type</Text>
          <View className="mb-4">
            {ACCOUNT_TYPES.map((t) => (
              <RadioRow
                key={t.value}
                label={t.label}
                selected={accountType === t.value}
                onPress={() => setAccountType(t.value)}
              />
            ))}
          </View>

          <Field
            label="Hourly rate (USD)"
            value={hourlyRate}
            onChangeText={setHourlyRate}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />

          <Field
            label="VAT number (locked after account creation)"
            value={vatNumber}
            onChangeText={setVatNumber}
            autoCapitalize="characters"
          />
        </View>
      )}

      {step === 3 && (
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1">License proof (required)</Text>
          <PhotoPicker uri={licenseProofUri} onPick={() => pickImage(setLicenseProofUri)} />
          <Field
            label="License number"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            autoCapitalize="characters"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1 mt-2">National ID (required)</Text>
          <PhotoPicker uri={nationalIdUri} onPick={() => pickImage(setNationalIdUri)} />

          <Text className="text-sm font-medium text-gray-700 mb-1 mt-2">Company name (optional)</Text>
          <TextInput
            value={companyName}
            onChangeText={setCompanyName}
            className="border border-gray-300 rounded-lg px-3 py-3 text-base mb-4"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">Company logo (optional)</Text>
          <PhotoPicker uri={companyLogoUri} onPick={() => pickImage(setCompanyLogoUri)} />
        </View>
      )}

      <View className="flex-row gap-3 mt-2">
        {step > 1 && (
          <Pressable
            onPress={() => setStep((step - 1) as 1 | 2 | 3)}
            className="flex-1 py-4 rounded-xl border border-gray-300"
          >
            <Text className="text-center text-gray-800 font-semibold">Back</Text>
          </Pressable>
        )}
        {step < 3 ? (
          <Pressable
            disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
            onPress={() => setStep((step + 1) as 1 | 2 | 3)}
            className={`flex-1 py-4 rounded-xl ${
              (step === 1 ? step1Valid : step2Valid) ? 'bg-brand' : 'bg-gray-300'
            }`}
          >
            <Text className="text-center text-white font-semibold">Continue</Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={!allValid || submitting}
            onPress={() => setShowTerms(true)}
            className={`flex-1 py-4 rounded-xl ${allValid && !submitting ? 'bg-brand' : 'bg-gray-300'}`}
          >
            <Text className="text-center text-white font-semibold">
              {submitting ? 'Creating…' : 'Create Account'}
            </Text>
          </Pressable>
        )}
      </View>

      <TermsOverlay
        visible={showTerms}
        onClose={() => setShowTerms(false)}
        onAgree={onCreateAccount}
      />
    </ScrollView>
  );
}

// Field / RadioRow / PhotoPicker / pickImage / TRADES / ACCOUNT_TYPES now live
// in components/shared/ProfileFormFields.tsx — shared with complete-profile.tsx.
