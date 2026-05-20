// Push-notification token registration.
// Obtains the Expo push token for this device and stores it on the user's row
// so the send-push-notification Edge Function can deliver to them. Best-effort:
// a denied permission or any failure is swallowed — push must never block use.

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

export async function registerPushToken(userId: string): Promise<void> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResp?.data;
    if (!token) return;

    await supabase.from('users').update({ expo_push_token: token }).eq('id', userId);
  } catch {
    // Best-effort — never throw to the caller.
  }
}
