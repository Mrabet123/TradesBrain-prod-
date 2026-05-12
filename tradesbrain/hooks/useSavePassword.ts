// D6 Flow02 — Save Password toggle (off by default).
// When enabled: store email + password in Expo SecureStore (iOS Keychain /
// Android Keystore). Never AsyncStorage, never plain text.

import * as SecureStore from 'expo-secure-store';

const KEY_EMAIL = 'tb_saved_email';
const KEY_PASSWORD = 'tb_saved_password';

export async function saveCredentials(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_EMAIL, email);
  await SecureStore.setItemAsync(KEY_PASSWORD, password);
}

export async function loadCredentials(): Promise<{ email: string; password: string } | null> {
  const email = await SecureStore.getItemAsync(KEY_EMAIL);
  const password = await SecureStore.getItemAsync(KEY_PASSWORD);
  if (!email || !password) return null;
  return { email, password };
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_EMAIL);
  await SecureStore.deleteItemAsync(KEY_PASSWORD);
}
