// D6 Flow12 S19 — Minimum supported app version.
// Bump this when shipping a release that breaks older clients. The mobile app
// reads its own version from app.json via expo-constants (if installed) or
// falls back to the constant baked into the bundle.
// Force-upgrade detection lives in the ForceUpgradeScreen gate.

export const APP_VERSION = '1.0.0';
// Bump this server-side (a Supabase `app_config` table) when you want to force
// older clients to upgrade. For M10 the gate compares APP_VERSION to a value
// pulled from getMinSupportedVersion(); a one-row config table is the simplest
// place to control it.

export interface MinVersionResult {
  required: string;
  current: string;
  needsUpgrade: boolean;
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
