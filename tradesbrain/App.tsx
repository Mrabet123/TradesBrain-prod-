// M0 — Project Scaffolding & Infrastructure
// See app/_layout.tsx for the full per-milestone Build Report stack.

import './global.css';

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';

// ─── TEMPORARY: Stripe stubbed for Expo Go testing (2026-05-16) ─────────────
// <StripeProvider> requires the @stripe/stripe-react-native native module
// which is not in Expo Go. Replaced with a pass-through wrapper so the bundle
// boots. TO REVERT: re-add the import below + restore the real <StripeProvider>
// wrapper (publishableKey / merchantIdentifier / urlScheme) around <AuthProvider>.
// import { StripeProvider } from '@stripe/stripe-react-native';
const StripeProvider = ({ children }: { children: React.ReactNode } & Record<string, unknown>) => <>{children}</>;
// ─────────────────────────────────────────────────────────────────────────────

import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { TradeProfileProvider } from './context/TradeProfileContext';
import { NetworkProvider } from './context/NetworkContext';
import ErrorBoundary from './components/shared/ErrorBoundary';
import RootLayout from './app/_layout';

export default function App() {
  return (
    <ErrorBoundary>
      <NetworkProvider>
        <StripeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <TradeProfileProvider>
                <NavigationContainer>
                  <RootLayout />
                </NavigationContainer>
                <StatusBar style="auto" />
              </TradeProfileProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </StripeProvider>
      </NetworkProvider>
    </ErrorBoundary>
  );
}
