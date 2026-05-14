import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // React Native has no localStorage. AsyncStorage persists the session so
    // returning users stay signed in (M1), and keeps the PKCE code verifier
    // alive across the Google OAuth browser round-trip.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL bar in React Native: the Google OAuth redirect is captured by
    // expo-web-browser and exchanged manually via exchangeCodeForSession
    // (see app/(auth)/signin.tsx). Must stay false.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
