// M1 — Authentication service helpers
// Wraps Supabase Auth + users table + KYC photo upload.
// Edge Function kyc-status-check is deferred (founder defer M0 deploy step) —
// KYC status fields default to 'pending' from the column default in D5.

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
