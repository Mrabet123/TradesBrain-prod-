// M0 — Project Scaffolding & Infrastructure
// See app/_layout.tsx for the full per-milestone Build Report stack.

import './global.css';

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';

import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { TradeProfileProvider } from './context/TradeProfileContext';
import { NetworkProvider } from './context/NetworkContext';
import ErrorBoundary from './components/shared/ErrorBoundary';
import RootLayout from './app/_layout';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function App() {
  return (
    <ErrorBoundary>
      <NetworkProvider>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier="merchant.app.tradesbrain"
          urlScheme="tradesbrain"
        >
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
