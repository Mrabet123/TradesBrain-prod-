// M1 — Authentication service helpers
// Wraps Supabase Auth + users table + KYC photo upload.
// Edge Function kyc-status-check is deferred (founder defer M0 deploy step) —
// KYC status fields default to 'pending' from the column default in D5.

import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

// Configure once at module load. The webClientId is what Supabase verifies the
// returned ID token against — it must also be added to the Supabase dashboard
// under Auth → Providers → Google → "Authorized Client IDs". The iosClientId is
// only needed on iOS; Android picks up its client from the SHA-1 fingerprint
// registered in Google Cloud Console + the package name in app.json.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

const TERMS_VERSION = 'v1.0';

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  tradeType: 'plumber' | 'electrician' | 'hvac' | 'roofer' | 'other';
  accountType: 'solopreneur' | 'team_owner';
  hourlyRate: number;
  vatNumber: string;
  licenseNumber: string;
  licenseProofUri: string;
  nationalIdUri: string;
  companyName?: string;
  companyLogoUri?: string;
}

export async function startSignUp(email: string, password: string, phone: string) {
  // Supabase signUp with both email and phone triggers email confirmation
  // and SMS OTP simultaneously when phone provider is configured.
  return supabase.auth.signUp({
    email,
    password,
    phone,
    options: {
      channel: 'sms',
    },
  });
}

export async function verifyEmailOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'signup' });
}

export async function verifyPhoneOtp(phone: string, token: string) {
  return supabase.auth.verifyOtp({ phone, token, type: 'sms' });
}

export async function resendEmailOtp(email: string) {
  return supabase.auth.resend({ type: 'signup', email });
}

export async function resendPhoneOtp(phone: string) {
  return supabase.auth.resend({ type: 'sms', phone });
}

export async function uploadKycPhoto(
  userId: string,
  kind: 'license' | 'national_id' | 'company_logo',
  localUri: string,
): Promise<string> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const res = await fetch(localUri);
  const blob = await res.blob();

  const { error } = await supabase.storage
    .from('kyc-documents')
    .upload(path, blob, { contentType, upsert: false });

  if (error) throw error;
  return path;
}

export async function createUserProfile(input: SignUpInput): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error('No authenticated user — verify OTPs first.');

  const licensePath = await uploadKycPhoto(user.id, 'license', input.licenseProofUri);
  const nationalIdPath = await uploadKycPhoto(user.id, 'national_id', input.nationalIdUri);
  const logoPath = input.companyLogoUri
    ? await uploadKycPhoto(user.id, 'company_logo', input.companyLogoUri)
    : null;

  const { error } = await supabase.from('users').insert({
    id: user.id,
    full_name: input.fullName,
    email: input.email,
    phone_number: input.phone,
    trade_type: input.tradeType,
    account_type: input.accountType,
    hourly_rate: input.hourlyRate,
    vat_number: input.vatNumber,
    company_name: input.companyName ?? null,
    company_logo_url: logoPath,
    license_number: input.licenseNumber,
    license_proof_url: licensePath,
    national_id_url: nationalIdPath,
    national_id_kyc_status: 'pending',
    license_kyc_status: 'pending',
    terms_accepted_at: new Date().toISOString(),
    terms_version: TERMS_VERSION,
  });

  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

// Shared Google sign-in flow used by both the Sign In and Create Account
// screens. Uses the native Google account picker (iOS/Android) rather than a
// web redirect, so the consent sheet shows the "Trades Brain" OAuth client
// instead of the Supabase project domain. The ID token is exchanged with
// Supabase via signInWithIdToken. On success onAuthStateChange fires and
// RootLayout routes — to the app for existing users, or to the complete-profile
// screen for brand-new Google users (no public.users row yet).
export async function signInWithGoogle(): Promise<{
  error: Error | null;
  cancelled: boolean;
}> {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response: any = await GoogleSignin.signIn();

    // v13+ shape: { type: 'success' | 'cancelled', data: { idToken, ... } }
    // Older shape (defensive): { idToken } at the top level.
    if (response?.type === 'cancelled') return { error: null, cancelled: true };
    const idToken: string | undefined = response?.data?.idToken ?? response?.idToken;
    if (!idToken) {
      return {
        error: new Error('Google did not return an ID token.'),
        cancelled: false,
      };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    return { error: error ?? null, cancelled: false };
  } catch (e: any) {
    if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
      return { error: null, cancelled: true };
    }
    if (e?.code === statusCodes.IN_PROGRESS) {
      return { error: null, cancelled: true };
    }
    const err = e instanceof Error ? e : new Error(String(e?.message ?? e));
    return { error: err, cancelled: false };
  }
}

// True when the signed-in auth user already has a row in public.users (i.e. they
// finished the trade + KYC profile). Drives the RootLayout onboarding gate.
export async function profileExists(): Promise<boolean> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return false;
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  return !error && !!data;
}

export async function signInWithPhoneStart(phone: string) {
  return supabase.auth.signInWithOtp({ phone });
}

export async function signInWithPhoneVerify(phone: string, token: string) {
  return supabase.auth.verifyOtp({ phone, token, type: 'sms' });
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

export { TERMS_VERSION };
