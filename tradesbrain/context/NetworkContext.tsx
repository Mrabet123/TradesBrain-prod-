// D6 Flow12 S4-S7 — App-wide network status.
// Wraps @react-native-community/netinfo so every screen can react to offline
// state via a single hook. Subscribers update synchronously when connectivity
// flips. Used by:
//   • OfflineBanner (top-of-screen indicator)
//   • useRexSession (queue messages while offline, flush on reconnect)
//   • Any screen that needs to gate destructive actions on connectivity

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextValue {
  isConnected: boolean;
  /** Connectivity assumed available until NetInfo reports otherwise — avoids
   * a flash of the offline banner on cold start when NetInfo hasn't emitted yet. */
  initialized: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  isConnected: true,
  initialized: false,
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      setIsConnected(connected);
      setInitialized(true);
    });
    NetInfo.fetch().then((state) => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      setIsConnected(connected);
      setInitialized(true);
    });
    return () => unsub();
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected, initialized }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetworkContext = () => useContext(NetworkContext);
