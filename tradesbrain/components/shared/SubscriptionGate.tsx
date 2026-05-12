import React, { ReactNode } from 'react';
import { useSubscriptionContext } from '../../context/SubscriptionContext';

interface SubscriptionGateProps {
  children: ReactNode;
  featureName?: string;
}

export default function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { subscriptionStatus, trialQueriesRemaining } = useSubscriptionContext();

  const hasAccess =
    subscriptionStatus === 'active' ||
    (subscriptionStatus === 'trial' && trialQueriesRemaining > 0);

  if (!hasAccess) {
    // Paywall will be shown in M8
    return null;
  }

  return <>{children}</>;
}
