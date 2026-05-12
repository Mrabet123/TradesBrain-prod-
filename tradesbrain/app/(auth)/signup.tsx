// D1 §7, D2 Sign Up Flow, D6 Flow01 — 3-step sign-up form.
// Step 1: full name, email, password (≥8 chars + strength), phone (country code).
// Step 2: trade type, account type, hourly rate, VAT number.
// Step 3: license proof photo + number, national ID photo, optional company name + logo.
// Create Account button disabled until all required fields valid.
// On Create Account: Terms overlay → on agree → startSignUp() → OtpVerify.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import type { RootStackParamList } from '../_layout';
import TermsOverlay from '../../components/shared/TermsOverlay';
import { startSignUp } from '../../services/auth';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type TradeType = 'plumber' | 'electrician' | 'hvac' | 'roofer' | 'other';
type AccountType = 'solopreneur' | 'team_owner';

const TRADES: { value: TradeType; label: string }[] = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'hvac', label: 'HVAC Technician' },
  { value: 'roofer', label: 'Roofer' },
  { value: 'other', label: 'Other / General Contractor' },
];

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'solopreneur', label: 'Solopreneur' },
  { value: 'team_owner', label: 'Team Owner' },
];

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

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  async function pickImage(setter: (uri: string) => void) {
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
      nav.navigate('OtpVerify', { signUpData: formSnapshot } as any);
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 pt-12 pb-10">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Create your account</Text>
      <Text className="text-sm text-gray-500 mb-5">Step {step} of 3</Text>

      {step === 1 && (
        <View>
          <Field label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
          <Field
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Password (min 8 chars)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
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
          <View className="flex-row gap-2 mb-4">
            <TextInput
              value={countryCode}
              onChangeText={setCountryCode}
              className="border border-gray-300 rounded-lg px-3 py-3 w-20 text-base"
              keyboardType="phone-pad"
            />
            <TextInput
              value={phoneLocal}
              onChangeText={setPhoneLocal}
              placeholder="555 123 4567"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-3 text-base"
              keyboardType="phone-pad"
            />
          </View>
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

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
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
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        placeholder={props.placeholder}
        className="border border-gray-300 rounded-lg px-3 py-3 text-base"
      />
    </View>
  );
}

function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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

function PhotoPicker({ uri, onPick }: { uri: string | null; onPick: () => void }) {
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
