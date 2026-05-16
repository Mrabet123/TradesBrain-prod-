// M1 — Authentication service helpers
// Wraps Supabase Auth + users table + KYC photo upload.
// Edge Function kyc-status-check is deferred (founder defer M0 deploy step) —
// KYC status fields default to 'pending' from the column default in D5.

// ─── TEMPORARY: Google Sign-In stubbed for Expo Go testing (2026-05-16) ──────
// `@react-native-google-signin/google-signin` is a native module not present
// in Expo Go. To unblock M1/M2/M3/M4 testing in plain Expo Go while the EAS
// dev client builds, the native import + signInWithGoogle body are stubbed.
//
// TO REVERT once the dev build is installed:
//   1. Restore the import block below to:
//        import { GoogleSignin, statusCodes }
//          from '@react-native-google-signin/google-signin';
//   2. Restore GoogleSignin.configure({...}) call.
//   3. Restore the real signInWithGoogle() body (see git history).
//   4. Re-add the "@react-native-google-signin/google-signin" plugin entry to
//      app.json → plugins.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

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
  // STUBBED for Expo Go — see TEMPORARY notice at top of file.
  return {
    error: new Error(
      'Google sign-in requires the TradesBrain dev build. Use email or phone OTP for now.',
    ),
    cancelled: false,
  };
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
