// hooks/useCodeLookupCache.ts — last-10 offline cache for Trade Code Lookup.
// D3 F4 / BuildGuide M4 item 11. AsyncStorage-backed (per-user key).

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CodeLookupResult } from '../services/codeLookup';
import { RECENT_CACHE_LIMIT } from '../constants/codeLookup';

const keyFor = (userId: string) => `tb_code_lookups_${userId}`;

export function useCodeLookupCache(userId: string | null) {
  const [recent, setRecent] = useState<CodeLookupResult[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(keyFor(userId));
        if (raw) setRecent(JSON.parse(raw));
      } catch {
        // ignore — corrupt cache, will be overwritten on next save
      }
    })();
  }, [userId]);

  const record = useCallback(
    async (result: CodeLookupResult) => {
      if (!userId) return;
      const next = [result, ...recent.filter((r) => r.ranAt !== result.ranAt)].slice(
        0,
        RECENT_CACHE_LIMIT,
      );
      setRecent(next);
      try {
        await AsyncStorage.setItem(keyFor(userId), JSON.stringify(next));
      } catch {
        // best-effort
      }
    },
    [recent, userId],
  );

  const clear = useCallback(async () => {
    if (!userId) return;
    setRecent([]);
    await AsyncStorage.removeItem(keyFor(userId));
  }, [userId]);

  return { recent, record, clear };
}
