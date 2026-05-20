// D6 Flow12 S19 — Force-upgrade detection.
// Reads app_config.min_supported_version (remote, migration 00008) and compares
// it to the bundled APP_VERSION. The gate is rendered in RootLayout. A network
// failure fails OPEN — a connectivity blip must never lock a user out.

import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { APP_VERSION, compareVersions } from '../constants/appVersion';

export interface MinVersionState {
  checked: boolean;
  needsUpgrade: boolean;
  required: string;
  current: string;
}

export function useMinVersion(): MinVersionState {
  const [state, setState] = useState<MinVersionState>({
    checked: false,
    needsUpgrade: false,
    required: APP_VERSION,
    current: APP_VERSION,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('min_supported_version')
          .maybeSingle();
        if (cancelled) return;
        const required = data?.min_supported_version ?? APP_VERSION;
        setState({
          checked: true,
          needsUpgrade: compareVersions(APP_VERSION, required) < 0,
          required,
          current: APP_VERSION,
        });
      } catch {
        // Fail open — never block on a network error.
        if (!cancelled) setState((s) => ({ ...s, checked: true }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
