// D6 Flow12 S4-S7 — Offline message queue for Rex.
// Stores pending sendMessage payloads per-session in AsyncStorage. The Rex
// session screen renders a queued indicator when this hook reports queued > 0,
// and flushes on reconnect.

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkContext } from '../context/NetworkContext';

export interface QueuedMessage {
  id: string;
  enqueuedAt: number;
  text: string;
  photoUri?: string | null;
  photoBase64?: string | null;
  photoMime?: string | null;
  transcriptOriginal?: string | null;
  transcriptEdited?: string | null;
}

const keyFor = (sessionId: string) => `tb_rex_queue_${sessionId}`;

export function useOfflineQueue(
  sessionId: string | null,
  flush: (msg: QueuedMessage) => Promise<void>,
) {
  const { isConnected } = useNetworkContext();
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(keyFor(sessionId));
        if (raw) setQueue(JSON.parse(raw));
      } catch {
        // corrupt cache; overwrite on next persist
      }
    })();
  }, [sessionId]);

  const persist = useCallback(
    async (next: QueuedMessage[]) => {
      if (!sessionId) return;
      setQueue(next);
      await AsyncStorage.setItem(keyFor(sessionId), JSON.stringify(next));
    },
    [sessionId],
  );

  const enqueue = useCallback(
    async (msg: Omit<QueuedMessage, 'id' | 'enqueuedAt'>) => {
      const entry: QueuedMessage = {
        ...msg,
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        enqueuedAt: Date.now(),
      };
      await persist([...queue, entry]);
    },
    [queue, persist],
  );

  const clearOne = useCallback(
    async (id: string) => {
      await persist(queue.filter((q) => q.id !== id));
    },
    [queue, persist],
  );

  // Flush whenever we transition to online
  useEffect(() => {
    if (!isConnected || queue.length === 0 || flushing) return;
    let cancelled = false;
    (async () => {
      setFlushing(true);
      // Snapshot the queue at flush-start; flush one-by-one and remove on success.
      const snapshot = [...queue];
      for (const item of snapshot) {
        if (cancelled) break;
        try {
          await flush(item);
          await clearOne(item.id);
        } catch {
          // Stop the flush on first failure — items remain queued
          break;
        }
      }
      if (!cancelled) setFlushing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, queue, flushing, flush, clearOne]);

  return {
    queued: queue.length,
    flushing,
    enqueue,
    isConnected,
  };
}
